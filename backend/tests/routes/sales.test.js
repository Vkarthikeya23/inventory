/**
 * Sales Route Tests
 * 
 * Tests sales management:
 * - POST /sales - Create sale
 * - GET /sales - List sales
 * - GET /sales/:id - Get sale details
 */

import request from 'supertest';
import app from '../../src/app.js';
import { 
  initTestDatabase, 
  clearTestDatabase, 
  createTestUser,
  createTestCategory,
  createTestProduct,
  createTestCustomer,
  createTestSale,
  createTestSaleItem,
  getTestDb
} from '../setup.js';

jest.mock('../../src/db/pool.js', () => ({
  getDb: jest.fn()
}));

describe('Sales Routes', () => {
  let ownerToken;
  let managerToken;
  let cashierToken;
  let categoryId;
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
    
    // Create users
    createTestUser({ name: 'Owner', email: 'owner@test.com', password: 'password', role: 'owner' });
    createTestUser({ name: 'Manager', email: 'manager@test.com', password: 'password', role: 'manager' });
    createTestUser({ name: 'Cashier', email: 'cashier@test.com', password: 'password', role: 'cashier' });
    
    const ownerRes = await request(app).post('/auth/login').send({ email: 'owner@test.com', password: 'password' });
    ownerToken = ownerRes.body.token;
    
    const managerRes = await request(app).post('/auth/login').send({ email: 'manager@test.com', password: 'password' });
    managerToken = managerRes.body.token;
    
    const cashierRes = await request(app).post('/auth/login').send({ email: 'cashier@test.com', password: 'password' });
    cashierToken = cashierRes.body.token;
    
    // Create category and product
    const cat = createTestCategory('Tyres');
    categoryId = cat.id;
    
    const prod = createTestProduct({
      name: 'MRF Zapper',
      brand: 'MRF',
      category_id: categoryId,
      unit_price: 2500,
      cost_price: 1800,
      stock_qty: 50
    });
    productId = prod.id;
  });

  describe('POST /sales', () => {
    test('should return 201 and create sale as cashier', async () => {
      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { name: 'Rahul Sharma', phone: '9876543210', email: 'rahul@test.com' },
          items: [{ product_id: productId, qty: 2 }],
          notes: 'First sale'
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.sale_id).toBeDefined();
      expect(response.body.invoice_number).toBeDefined();
      expect(response.body.invoice_number).toMatch(/^TYR-\d{4}-\d{5}$/);
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.invoice_url).toContain('/invoice/');
    });

    test('should return 201 and create sale as owner', async () => {
      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer: { name: 'Owner Customer', phone: '9999999999' },
          items: [{ product_id: productId, qty: 1 }]
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.sale_id).toBeDefined();
    });

    test('should return 400 when customer name is missing', async () => {
      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { phone: '9876543210' },
          items: [{ product_id: productId, qty: 1 }]
        });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('Customer name');
    });

    test('should return 400 when customer phone is missing', async () => {
      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { name: 'Test Customer' },
          items: [{ product_id: productId, qty: 1 }]
        });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('phone');
    });

    test('should return 400 when items are empty', async () => {
      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { name: 'Test', phone: '9876543210' },
          items: []
        });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('items');
    });

    test('should return 400 for insufficient stock', async () => {
      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { name: 'Test', phone: '9876543210' },
          items: [{ product_id: productId, qty: 1000 }] // More than stock
        });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('Insufficient stock');
    });

    test('should return 400 for non-existent product', async () => {
      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { name: 'Test', phone: '9876543210' },
          items: [{ product_id: 'nonexistent-id', qty: 1 }]
        });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('Product not found');
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app)
        .post('/sales')
        .send({
          customer: { name: 'Test', phone: '9876543210' },
          items: [{ product_id: productId, qty: 1 }]
        });

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should decrement stock after sale', async () => {
      // Arrange
      const initialStock = 50;

      // Act
      await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { name: 'Test', phone: '9876543210' },
          items: [{ product_id: productId, qty: 5 }]
        });

      // Assert
      const { getDb } = await import('../../src/db/pool.js');
      const db = getDb();
      const stmt = db.prepare('SELECT stock_qty FROM products WHERE id = ?');
      stmt.bind([productId]);
      stmt.step();
      const result = stmt.getAsObject();
      stmt.free();
      
      expect(result.stock_qty).toBe(45); // 50 - 5
    });

    test('should create new customer if phone not found', async () => {
      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { 
            name: 'New Customer', 
            phone: '8888888888',
            email: 'new@customer.com',
            vehicle_make: 'Maruti',
            vehicle_model: 'Swift',
            vehicle_reg: 'MH01AB1234'
          },
          items: [{ product_id: productId, qty: 1 }]
        });

      // Assert
      expect(response.statusCode).toBe(201);
      
      // Verify customer was created
      const { getDb } = await import('../../src/db/pool.js');
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM customers WHERE phone = ?');
      stmt.bind(['8888888888']);
      stmt.step();
      const customer = stmt.getAsObject();
      stmt.free();
      
      expect(customer).toBeDefined();
      expect(customer.name).toBe('New Customer');
      expect(customer.vehicle_make).toBe('Maruti');
    });

    test('should use existing customer if phone exists', async () => {
      // Arrange
      const existingCustomer = createTestCustomer({
        name: 'Existing Customer',
        phone: '7777777777',
        email: 'existing@test.com'
      });

      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { name: 'Different Name', phone: '7777777777' },
          items: [{ product_id: productId, qty: 1 }]
        });

      // Assert
      expect(response.statusCode).toBe(201);
      
      // Should use existing customer (not create duplicate)
      const { getDb } = await import('../../src/db/pool.js');
      const db = getDb();
      const result = db.exec('SELECT COUNT(*) as count FROM customers WHERE phone = ?', ['7777777777']);
      expect(result[0].values[0][0]).toBe(1);
    });

    test('should calculate GST correctly', async () => {
      // Arrange
      const unitPrice = 1000;
      const qty = 2;
      const expectedSubtotal = unitPrice * qty;
      const expectedCGST = expectedSubtotal * 0.14;
      const expectedSGST = expectedSubtotal * 0.14;
      const expectedTotal = expectedSubtotal + expectedCGST + expectedSGST;

      // Act
      const response = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { name: 'GST Test', phone: '6666666666' },
          items: [{ product_id: productId, qty: qty }]
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.total).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('GET /sales', () => {
    beforeEach(async () => {
      // Create some test sales
      const customer = createTestCustomer({ name: 'Test Customer', phone: '5555555555' });
      const sale = createTestSale({
        customer_id: customer.id,
        user_id: ownerToken.user?.id,
        invoice_number: 'TYR-2401-00001',
        subtotal: 5000,
        cgst: 700,
        sgst: 700,
        total: 6400
      });
    });

    test('should return 200 and list sales as owner', async () => {
      // Act
      const response = await request(app)
        .get('/sales')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 200 and list sales as manager', async () => {
      // Act
      const response = await request(app)
        .get('/sales')
        .set('Authorization', `Bearer ${managerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
    });

    test('should return 403 for cashier', async () => {
      // Act
      const response = await request(app)
        .get('/sales')
        .set('Authorization', `Bearer ${cashierToken}`);

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should filter by date range', async () => {
      // Act
      const response = await request(app)
        .get('/sales?from=2024-01-01&to=2024-12-31')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app).get('/sales');

      // Assert
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /sales/:id', () => {
    let saleId;

    beforeEach(async () => {
      const customer = createTestCustomer({ name: 'Detail Test', phone: '4444444444' });
      const sale = createTestSale({
        customer_id: customer.id,
        user_id: ownerToken.user?.id,
        invoice_number: 'TYR-2401-00002',
        subtotal: 3000,
        cgst: 420,
        sgst: 420,
        total: 3840
      });
      saleId = sale.id;
      
      createTestSaleItem({
        sale_id: saleId,
        product_id: productId,
        qty: 1,
        unit_price: 2500,
        amount: 2500
      });
    });

    test('should return 200 and sale details as owner', async () => {
      // Act
      const response = await request(app)
        .get(`/sales/${saleId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(saleId);
      expect(response.body.invoice_number).toBeDefined();
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    test('should return 200 and sale details as manager', async () => {
      // Act
      const response = await request(app)
        .get(`/sales/${saleId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
    });

    test('should return 403 for cashier', async () => {
      // Act
      const response = await request(app)
        .get(`/sales/${saleId}`)
        .set('Authorization', `Bearer ${cashierToken}`);

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should return 404 for non-existent sale', async () => {
      // Act
      const response = await request(app)
        .get('/sales/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Sale not found');
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app).get(`/sales/${saleId}`);

      // Assert
      expect(response.statusCode).toBe(401);
    });
  });
});
