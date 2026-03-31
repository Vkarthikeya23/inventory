/**
 * Invoices Route Tests
 * 
 * Tests invoice endpoints:
 * - POST /invoices/:sale_id/send - Get invoice URL
 * - GET /invoice/:invoice_number - Public invoice HTML
 */

import request from 'supertest';
import app from '../../src/app.js';
import { 
  initTestDatabase, 
  clearTestDatabase, 
  createTestUser,
  createTestCategory,
  createTestProduct,
  getTestDb
} from '../setup.js';

jest.mock('../../src/db/pool.js', () => ({
  getDb: jest.fn()
}));

describe('Invoices Routes', () => {
  let ownerToken;
  let managerToken;
  let cashierToken;
  let saleId;
  let invoiceNumber;

  beforeAll(async () => {
    await initTestDatabase();
  });

  afterEach(() => {
    clearTestDatabase();
  });

  beforeEach(async () => {
    const { getDb } = await import('../../src/db/pool.js');
    getDb.mockReturnValue(getTestDb());
    
    createTestUser({ name: 'Owner', email: 'owner@test.com', password: 'password', role: 'owner' });
    createTestUser({ name: 'Manager', email: 'manager@test.com', password: 'password', role: 'manager' });
    createTestUser({ name: 'Cashier', email: 'cashier@test.com', password: 'password', role: 'cashier' });
    
    const ownerRes = await request(app).post('/auth/login').send({ email: 'owner@test.com', password: 'password' });
    ownerToken = ownerRes.body.token;
    
    const managerRes = await request(app).post('/auth/login').send({ email: 'manager@test.com', password: 'password' });
    managerToken = managerRes.body.token;
    
    const cashierRes = await request(app).post('/auth/login').send({ email: 'cashier@test.com', password: 'password' });
    cashierToken = cashierRes.body.token;
    
    // Create a sale with invoice
    const cat = createTestCategory('Tyres');
    const product = createTestProduct({ name: 'Test Tyre', category_id: cat.id, unit_price: 2000, stock_qty: 50 });
    
    const saleRes = await request(app)
      .post('/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        customer: { name: 'Invoice Test Customer', phone: '9999999999' },
        items: [{ product_id: product.id, qty: 1 }]
      });
    
    saleId = saleRes.body.sale_id;
    invoiceNumber = saleRes.body.invoice_number;
  });

  describe('POST /invoices/:sale_id/send', () => {
    test('should return 200 and invoice URL as owner', async () => {
      // Act
      const response = await request(app)
        .post(`/invoices/${saleId}/send`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.invoice_url).toBeDefined();
      expect(response.body.invoice_url).toContain(`/invoice/${invoiceNumber}`);
    });

    test('should return 200 and invoice URL as manager', async () => {
      // Act
      const response = await request(app)
        .post(`/invoices/${saleId}/send`)
        .set('Authorization', `Bearer ${managerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
    });

    test('should return 403 for cashier', async () => {
      // Act
      const response = await request(app)
        .post(`/invoices/${saleId}/send`)
        .set('Authorization', `Bearer ${cashierToken}`);

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should return 404 for non-existent sale', async () => {
      // Act
      const response = await request(app)
        .post('/invoices/nonexistent-id/send')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(404);
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app)
        .post(`/invoices/${saleId}/send`);

      // Assert
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /invoice/:invoice_number (Public)', () => {
    test('should return 200 with HTML for valid invoice', async () => {
      // Act
      const response = await request(app)
        .get(`/invoice/${invoiceNumber}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain(invoiceNumber);
      expect(response.text).toContain('Invoice Test Customer');
    });

    test('should return 404 for non-existent invoice', async () => {
      // Act
      const response = await request(app)
        .get('/invoice/INVALID-9999-99999');

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.text).toContain('Invoice Not Found');
    });

    test('should be accessible without authentication', async () => {
      // Act
      const response = await request(app)
        .get(`/invoice/${invoiceNumber}`);

      // Assert
      expect(response.statusCode).toBe(200);
      // No Authorization header needed
    });

    test('should contain shop details in HTML', async () => {
      // Act
      const response = await request(app)
        .get(`/invoice/${invoiceNumber}`);

      // Assert
      expect(response.text).toContain('GSTIN');
      expect(response.text).toContain('CGST');
      expect(response.text).toContain('SGST');
    });

    test('should contain print and download buttons', async () => {
      // Act
      const response = await request(app)
        .get(`/invoice/${invoiceNumber}`);

      // Assert
      expect(response.text).toContain('Print');
      expect(response.text).toContain('Download PDF');
    });

    test('should handle invoice number with special characters gracefully', async () => {
      // Act
      const response = await request(app)
        .get('/invoice/TYR-2401-00099'); // Non-existent

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });
});
