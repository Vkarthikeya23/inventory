/**
 * Reports Route Tests
 * 
 * Tests reporting endpoints:
 * - GET /reports/daily - Daily sales report
 * - GET /reports/weekly - Weekly sales report
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

describe('Reports Routes', () => {
  let ownerToken;
  let managerToken;
  let cashierToken;

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
  });

  describe('GET /reports/daily', () => {
    beforeEach(() => {
      // Setup test data
      const customer = createTestCustomer({ name: 'Report Customer', phone: '3333333333' });
      const cat = createTestCategory('Tyres');
      const product = createTestProduct({
        name: 'Test Tyre',
        category_id: cat.id,
        unit_price: 2000,
        cost_price: 1400,
        stock_qty: 100
      });
      
      const today = new Date().toISOString().split('T')[0];
      
      // Create a sale for today
      const sale = createTestSale({
        customer_id: customer.id,
        user_id: ownerToken.user?.id,
        invoice_number: 'TYR-2401-00001',
        subtotal: 4000,
        cgst: 560,
        sgst: 560,
        total: 5120
      });
      
      createTestSaleItem({
        sale_id: sale.id,
        product_id: product.id,
        qty: 2,
        unit_price: 2000,
        unit_cost: 1400,
        amount: 4000
      });
    });

    test('should return 200 and daily report as owner', async () => {
      // Act
      const response = await request(app)
        .get('/reports/daily')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.date).toBeDefined();
      expect(response.body.total_revenue).toBeGreaterThan(0);
      expect(response.body.total_profit).toBeDefined();
      expect(response.body.total_transactions).toBeGreaterThan(0);
      expect(Array.isArray(response.body.top_products)).toBe(true);
      expect(Array.isArray(response.body.hourly_sales)).toBe(true);
    });

    test('should return 200 and daily report as manager', async () => {
      // Act
      const response = await request(app)
        .get('/reports/daily')
        .set('Authorization', `Bearer ${managerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.total_revenue).toBeDefined();
    });

    test('should return 403 for cashier', async () => {
      // Act
      const response = await request(app)
        .get('/reports/daily')
        .set('Authorization', `Bearer ${cashierToken}`);

      // Assert
      expect(response.statusCode).toBe(403);
      expect(response.body.error).toBe('Insufficient privileges');
    });

    test('should accept specific date parameter', async () => {
      // Act
      const response = await request(app)
        .get('/reports/daily?date=2024-01-15')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.date).toBe('2024-01-15');
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app).get('/reports/daily');

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should calculate profit correctly', async () => {
      // Act
      const response = await request(app)
        .get('/reports/daily')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      // Profit = (Selling price - Cost) * Qty
      // In our test: (2000 - 1400) * 2 = 1200
      expect(response.body.total_profit).toBeGreaterThan(0);
    });

    test('should include units sold', async () => {
      // Act
      const response = await request(app)
        .get('/reports/daily')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.units_sold).toBeGreaterThan(0);
    });
  });

  describe('GET /reports/weekly', () => {
    beforeEach(() => {
      // Setup test data for last 7 days
      const customer = createTestCustomer({ name: 'Weekly Customer', phone: '2222222222' });
      const cat = createTestCategory('Tyres');
      const product = createTestProduct({
        name: 'Test Tyre',
        category_id: cat.id,
        unit_price: 2000,
        cost_price: 1400,
        stock_qty: 100
      });
      
      // Create sales for multiple days
      for (let i = 0; i < 3; i++) {
        const sale = createTestSale({
          customer_id: customer.id,
          user_id: ownerToken.user?.id,
          invoice_number: `TYR-2401-${String(i + 1).padStart(5, '0')}`,
          subtotal: 2000,
          cgst: 280,
          sgst: 280,
          total: 2560
        });
        
        createTestSaleItem({
          sale_id: sale.id,
          product_id: product.id,
          qty: 1,
          unit_price: 2000,
          unit_cost: 1400,
          amount: 2000
        });
      }
    });

    test('should return 200 and weekly report as owner', async () => {
      // Act
      const response = await request(app)
        .get('/reports/weekly')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check structure of daily entries
      if (response.body.length > 0) {
        expect(response.body[0].date).toBeDefined();
        expect(response.body[0].revenue).toBeDefined();
        expect(response.body[0].profit).toBeDefined();
        expect(response.body[0].transactions).toBeDefined();
      }
    });

    test('should return 200 and weekly report as manager', async () => {
      // Act
      const response = await request(app)
        .get('/reports/weekly')
        .set('Authorization', `Bearer ${managerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 403 for cashier', async () => {
      // Act
      const response = await request(app)
        .get('/reports/weekly')
        .set('Authorization', `Bearer ${cashierToken}`);

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app).get('/reports/weekly');

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should return last 7 days of data', async () => {
      // Act
      const response = await request(app)
        .get('/reports/weekly')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeLessThanOrEqual(7);
    });
  });
});
