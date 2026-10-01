/**
 * Purchase Orders Route Tests
 *
 * Tests the saved PO API:
 * - POST /purchase-orders - Save a generated PO
 * - GET /purchase-orders - List saved POs
 * - DELETE /purchase-orders/:id - Delete a saved PO
 * - GET /po/:po_number - Public PO page
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

// In-memory mock of the PostgreSQL helpers
const mockDb = {
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
  transaction: jest.fn()
};

jest.unstable_mockModule('../../src/db/db.js', () => mockDb);

const { default: app } = await import('../../src/app.js');

const makeToken = (role, id = 'user-1') =>
  jwt.sign({ id, email: `${role}@test.com`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

const currentPeriod = () => {
  const now = new Date();
  return String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');
};

const samplePoData = () => ({
  date: new Date().toISOString(),
  columns: { current_stock: true, cost_price: true, quantity: true },
  items: [
    { product_id: 'p1', name: 'MRF ZAPPER 165/65 R15', current_stock: 3, qty: 10, cost_price: 1800, line_total: 18000 },
    { product_id: 'p2', name: 'APOLLO AMPLIFY 205/55 R16', current_stock: 1, qty: 4, cost_price: 3200, line_total: 12800 }
  ],
  total_amount: 30800
});

beforeEach(() => {
  mockDb.all.mockReset();
  mockDb.get.mockReset();
  mockDb.run.mockReset();
  mockDb.transaction.mockReset();
  mockDb.get.mockResolvedValue(null);
  mockDb.run.mockResolvedValue(undefined);
  mockDb.all.mockResolvedValue([]);
});

describe('POST /purchase-orders', () => {
  test('should save a PO and return po_number and po_url', async () => {
    const response = await request(app)
      .post('/purchase-orders')
      .set('Authorization', `Bearer ${makeToken('owner')}`)
      .send({ po_data: samplePoData(), supplier_phone: '9876543210' });

    expect(response.statusCode).toBe(201);
    expect(response.body.po_number).toMatch(new RegExp(`^PO-${currentPeriod()}-\\d{5}$`));
    expect(response.body.po_url).toContain(`/po/${response.body.po_number}`);
    expect(mockDb.run).toHaveBeenCalledTimes(1);
    const insertSql = mockDb.run.mock.calls[0][0];
    expect(insertSql).toContain('INSERT INTO purchase_orders');
  });

  test('should allow cashier to save (matches Download PO button visibility)', async () => {
    const response = await request(app)
      .post('/purchase-orders')
      .set('Authorization', `Bearer ${makeToken('cashier')}`)
      .send({ po_data: samplePoData() });

    expect(response.statusCode).toBe(201);
  });

  test('should increment sequence when a PO already exists this period', async () => {
    mockDb.get.mockResolvedValue({ po_number: `PO-${currentPeriod()}-00004` });

    const response = await request(app)
      .post('/purchase-orders')
      .set('Authorization', `Bearer ${makeToken('owner')}`)
      .send({ po_data: samplePoData() });

    expect(response.statusCode).toBe(201);
    expect(response.body.po_number).toBe(`PO-${currentPeriod()}-00005`);
  });

  test('should return 400 when items are missing', async () => {
    const response = await request(app)
      .post('/purchase-orders')
      .set('Authorization', `Bearer ${makeToken('owner')}`)
      .send({ po_data: { items: [] } });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('PO items required');
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  test('should return 400 when an item has no product name', async () => {
    const response = await request(app)
      .post('/purchase-orders')
      .set('Authorization', `Bearer ${makeToken('owner')}`)
      .send({ po_data: { items: [{}], total_amount: 0 } });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Each PO item requires a product name');
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  test('should return 401 without a token', async () => {
    const response = await request(app)
      .post('/purchase-orders')
      .send({ po_data: samplePoData() });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /purchase-orders', () => {
  test('should return list with po_url as owner', async () => {
    mockDb.all.mockResolvedValue([{
      id: 'po-1',
      po_number: `PO-${currentPeriod()}-00001`,
      supplier_phone: '9876543210',
      total_amount: '30800.00',
      item_count: '2',
      created_by: 'user-1',
      created_at: new Date().toISOString()
    }]);

    const response = await request(app)
      .get('/purchase-orders')
      .set('Authorization', `Bearer ${makeToken('owner')}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].po_number).toBe(`PO-${currentPeriod()}-00001`);
    expect(response.body[0].total_amount).toBe(30800);
    expect(response.body[0].item_count).toBe(2);
    expect(response.body[0].po_url).toContain('/po/');
  });

  test('should return 200 as manager', async () => {
    const response = await request(app)
      .get('/purchase-orders')
      .set('Authorization', `Bearer ${makeToken('manager')}`);

    expect(response.statusCode).toBe(200);
  });

  test('should return 403 for cashier', async () => {
    const response = await request(app)
      .get('/purchase-orders')
      .set('Authorization', `Bearer ${makeToken('cashier')}`);

    expect(response.statusCode).toBe(403);
  });

  test('should return 401 without a token', async () => {
    const response = await request(app).get('/purchase-orders');

    expect(response.statusCode).toBe(401);
  });
});

describe('DELETE /purchase-orders/:id', () => {
  test('should delete as owner', async () => {
    mockDb.get.mockResolvedValue({ id: 'po-1' });

    const response = await request(app)
      .delete('/purchase-orders/po-1')
      .set('Authorization', `Bearer ${makeToken('owner')}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should return 404 when PO does not exist', async () => {
    mockDb.get.mockResolvedValue(null);

    const response = await request(app)
      .delete('/purchase-orders/missing-id')
      .set('Authorization', `Bearer ${makeToken('owner')}`);

    expect(response.statusCode).toBe(404);
  });

  test('should return 403 for manager (owner only)', async () => {
    const response = await request(app)
      .delete('/purchase-orders/po-1')
      .set('Authorization', `Bearer ${makeToken('manager')}`);

    expect(response.statusCode).toBe(403);
  });
});

describe('GET /po/:po_number (public page)', () => {
  test('should render the saved PO', async () => {
    mockDb.get.mockResolvedValue({
      po_number: `PO-${currentPeriod()}-00001`,
      po_data: JSON.stringify(samplePoData()),
      supplier_phone: '9876543210',
      total_amount: '30800.00',
      item_count: 2,
      created_at: new Date().toISOString()
    });

    const response = await request(app).get(`/po/PO-${currentPeriod()}-00001`);

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('SRI MAHALAKSHMI TYRES');
    expect(response.text).toContain(`PO-${currentPeriod()}-00001`);
    expect(response.text).toContain('MRF ZAPPER 165/65 R15');
    expect(response.text).toContain('30800');
  });

  test('should return 404 for unknown PO', async () => {
    mockDb.get.mockResolvedValue(null);

    const response = await request(app).get('/po/PO-0000-99999');

    expect(response.statusCode).toBe(404);
    expect(response.text).toContain('Purchase Order Not Found');
  });

  test('should not require authentication', async () => {
    mockDb.get.mockResolvedValue(null);

    const response = await request(app).get('/po/PO-0000-99999');

    expect(response.statusCode).toBe(404);
  });
});
