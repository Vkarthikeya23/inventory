/**
 * Purchase Orders Route Tests
 * 
 * Tests purchase order management:
 * - GET /purchase-orders - List purchase orders
 * - GET /purchase-orders/:id - Get PO details
 * - POST /purchase-orders - Create PO
 * - PUT /purchase-orders/:id/receive - Mark as received
 */

import request from 'supertest';
import app from '../../src/app.js';
import { 
  initTestDatabase, 
  clearTestDatabase, 
  createTestUser,
  createTestCategory,
  createTestProduct,
  createTestSupplier,
  getTestDb
} from '../setup.js';

jest.mock('../../src/db/pool.js', () =>> ({
  getDb: jest.fn()
}));

describe('Purchase Orders Routes', () => {
  let ownerToken;
  let managerToken;
  let cashierToken;
  let supplierId;
  let productId;

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
    
    // Create supplier and product
    const supplier = createTestSupplier({ name: 'MRF Ltd', phone: '9999999999', gstin: '27AABCM1234L1Z5' });
    supplierId = supplier.id;
    
    const cat = createTestCategory('Tyres');
    const product = createTestProduct({ name: 'MRF Zapper', category_id: cat.id, unit_price: 2500, cost_price: 1800, stock_qty: 50 });
    productId = product.id;
  });

  describe('GET /purchase-orders', () => {
    test('should return 200 and list POs as owner', async () => {
      // Act
      const response = await request(app)
        .get('/purchase-orders')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 200 and list POs as manager', async () => {
      // Act
      const response = await request(app)
        .get('/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
    });

    test('should return 403 for cashier', async () => {
      // Act
      const response = await request(app)
        .get('/purchase-orders')
        .set('Authorization', `Bearer ${cashierToken}`);

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app).get('/purchase-orders');

      // Assert
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /purchase-orders/:id', () => {
    test('should return 200 and PO details as owner', async () => {
      // Arrange - Create a PO first
      const createRes = await request(app)
        .post('/purchase-orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          supplier_id: supplierId,
          items: [{ product_id: productId, qty_ordered: 10, unit_cost: 1800 }]
        });
      const poId = createRes.body.id;

      // Act
      const response = await request(app)
        .get(`/purchase-orders/${poId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(poId);
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    test('should return 404 for non-existent PO', async () => {
      // Act
      const response = await request(app)
        .get('/purchase-orders/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /purchase-orders', () => {
    test('should return 201 and create PO as owner', async () => {
      // Act
      const response = await request(app)
        .post('/purchase-orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          supplier_id: supplierId,
          items: [{ product_id: productId, qty_ordered: 10, unit_cost: 1800 }],
          notes: 'Urgent order'
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.status).toBe('draft');
    });

    test('should return 201 and create PO as manager', async () => {
      // Act
      const response = await request(app)
        .post('/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          supplier_id: supplierId,
          items: [{ product_id: productId, qty_ordered: 5, unit_cost: 1800 }]
        });

      // Assert
      expect(response.statusCode).toBe(201);
    });

    test('should return 403 for cashier', async () => {
      // Act
      const response = await request(app)
        .post('/purchase-orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          supplier_id: supplierId,
          items: [{ product_id: productId, qty_ordered: 5 }]
        });

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should return 400 when supplier_id is missing', async () => {
      // Act
      const response = await request(app)
        .post('/purchase-orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          items: [{ product_id: productId, qty_ordered: 5 }]
        });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Supplier and items required');
    });

    test('should return 400 when items are empty', async () => {
      // Act
      const response = await request(app)
        .post('/purchase-orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          supplier_id: supplierId,
          items: []
        });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /purchase-orders/:id/receive', () => {
    let poId;
    let poItemId;

    beforeEach(async () => {
      // Create a PO first
      const createRes = await request(app)
        .post('/purchase-orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          supplier_id: supplierId,
          items: [{ product_id: productId, qty_ordered: 10, unit_cost: 1800 }]
        });
      poId = createRes.body.id;
      
      // Get the PO to find the item ID
      const getRes = await request(app)
        .get(`/purchase-orders/${poId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      poItemId = getRes.body.items[0]?.id;
    });

    test('should return 200 and mark as received as owner', async () => {
      // Act
      const response = await request(app)
        .put(`/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          items: [{ po_item_id: poItemId, qty_received: 10 }]
        });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('received');
    });

    test('should return 200 and mark as received as manager', async () => {
      // Act
      const response = await request(app)
        .put(`/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          items: [{ po_item_id: poItemId, qty_received: 10 }]
        });

      // Assert
      expect(response.statusCode).toBe(200);
    });

    test('should increase stock after receiving', async () => {
      // Arrange
      const initialStock = 50;

      // Act
      await request(app)
        .put(`/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          items: [{ po_item_id: poItemId, qty_received: 10 }]
        });

      // Assert
      const { getDb } = await import('../../src/db/pool.js');
      const db = getDb();
      const stmt = db.prepare('SELECT stock_qty FROM products WHERE id = ?');
      stmt.bind([productId]);
      stmt.step();
      const result = stmt.getAsObject();
      stmt.free();
      
      expect(result.stock_qty).toBe(initialStock + 10);
    });

    test('should return 403 for cashier', async () => {
      // Act
      const response = await request(app)
        .put(`/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          items: [{ po_item_id: poItemId, qty_received: 10 }]
        });

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should return 400 when items are missing', async () => {
      // Act
      const response = await request(app)
        .put(`/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Items required');
    });
  });
});
