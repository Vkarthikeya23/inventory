/**
 * Integration Tests
 * 
 * Tests complete workflows:
 * - Full sale workflow
 * - Full purchase order workflow
 * - Complete business day workflow
 */

import request from 'supertest';
import app from '../../src/app.js';
import { 
  initTestDatabase, 
  clearTestDatabase, 
  createTestUser,
  getTestDb
} from '../setup.js';

jest.mock('../../src/db/pool.js', () => ({
  getDb: jest.fn()
}));

describe('Integration Tests - Complete Workflows', () => {
  let ownerToken;
  let cashierToken;

  beforeAll(async () => {
    await initTestDatabase();
  });

  beforeEach(async () => {
    clearTestDatabase();
    const { getDb } = await import('../../src/db/pool.js');
    getDb.mockReturnValue(getTestDb());
    
    createTestUser({ name: 'Owner', email: 'owner@test.com', password: 'password', role: 'owner' });
    createTestUser({ name: 'Cashier', email: 'cashier@test.com', password: 'password', role: 'cashier' });
    
    const ownerRes = await request(app).post('/auth/login').send({ email: 'owner@test.com', password: 'password' });
    ownerToken = ownerRes.body.token;
    
    const cashierRes = await request(app).post('/auth/login').send({ email: 'cashier@test.com', password: 'password' });
    cashierToken = cashierRes.body.token;
  });

  describe('Complete Sale Workflow', () => {
    test('should create category, product, make sale, and view invoice', async () => {
      // Step 1: Create category (as owner)
      const catRes = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Car Tyres', description: 'Premium car tyres' });
      expect(catRes.statusCode).toBe(201);
      const categoryId = catRes.body.id;

      // Step 2: Create product (as owner)
      const prodRes = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'MRF Zapper Y3',
          brand: 'MRF',
          category_id: categoryId,
          size_spec: '145/70 R12',
          unit_price: 2450,
          cost_price: 1800,
          stock_qty: 20,
          low_stock_threshold: 5
        });
      expect(prodRes.statusCode).toBe(201);
      const productId = prodRes.body.id;

      // Step 3: Make sale (as cashier)
      const saleRes = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          customer: { 
            name: 'Rahul Sharma', 
            phone: '9876543210',
            email: 'rahul@email.com',
            vehicle_make: 'Maruti',
            vehicle_model: 'Alto',
            vehicle_reg: 'MH01AB1234'
          },
          items: [{ product_id: productId, qty: 2 }],
          notes: 'Regular customer'
        });
      expect(saleRes.statusCode).toBe(201);
      expect(saleRes.body.invoice_number).toBeDefined();
      expect(saleRes.body.invoice_url).toBeDefined();

      // Step 4: View invoice (public, no auth needed)
      const invoiceNumber = saleRes.body.invoice_number;
      const invoiceRes = await request(app).get(`/invoice/${invoiceNumber}`);
      expect(invoiceRes.statusCode).toBe(200);
      expect(invoiceRes.text).toContain('Rahul Sharma');
      expect(invoiceRes.text).toContain('MH01AB1234');
      expect(invoiceRes.text).toContain('MRF Zapper Y3');

      // Step 5: Check stock decreased
      const prodCheckRes = await request(app)
        .get(`/products`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const updatedProduct = prodCheckRes.body.find(p => p.id === productId);
      expect(updatedProduct.stock_qty).toBe(18); // 20 - 2
    });
  });

  describe('Complete Purchase Order Workflow', () => {
    test('should create supplier, create PO, and receive stock', async () => {
      // Step 1: Create supplier (as owner)
      const supRes = await request(app)
        .post('/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'MRF India Ltd',
          contact_person: 'Rajesh Kumar',
          phone: '9999999999',
          email: 'orders@mrf.com',
          gstin: '27AABCM1234L1Z5'
        });
      expect(supRes.statusCode).toBe(201);
      const supplierId = supRes.body.id;

      // Step 2: Create category and product
      const catRes = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Bike Tyres' });
      const categoryId = catRes.body.id;

      const prodRes = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'CEAT Gripp',
          brand: 'CEAT',
          category_id: categoryId,
          size_spec: '90/90 R17',
          unit_price: 1850,
          cost_price: 1350,
          stock_qty: 10
        });
      const productId = prodRes.body.id;

      // Step 3: Create PO (as owner)
      const poRes = await request(app)
        .post('/purchase-orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          supplier_id: supplierId,
          items: [{ product_id: productId, qty_ordered: 50, unit_cost: 1300 }],
          notes: 'Monthly stock order'
        });
      expect(poRes.statusCode).toBe(201);
      expect(poRes.body.status).toBe('draft');
      const poId = poRes.body.id;

      // Step 4: Receive PO (as owner)
      const poGetRes = await request(app)
        .get(`/purchase-orders/${poId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const poItemId = poGetRes.body.items[0].id;

      const receiveRes = await request(app)
        .put(`/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          items: [{ po_item_id: poItemId, qty_received: 50 }]
        });
      expect(receiveRes.statusCode).toBe(200);
      expect(receiveRes.body.status).toBe('received');

      // Step 5: Verify stock increased
      const prodCheckRes = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${ownerToken}`);
      const updatedProduct = prodCheckRes.body.find(p => p.id === productId);
      expect(updatedProduct.stock_qty).toBe(60); // 10 + 50
    });
  });

  describe('Daily Business Workflow', () => {
    test('should simulate a complete day of business', async () => {
      // Setup: Create products
      const catRes = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Tyres' });
      
      const prod1Res = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'MRF Tyre',
          unit_price: 2500,
          stock_qty: 30
        });
      const prod1Id = prod1Res.body.id;

      const prod2Res = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Apollo Tyre',
          unit_price: 2800,
          stock_qty: 20
        });
      const prod2Id = prod2Res.body.id;

      // Multiple sales throughout the day
      const sales = [
        { customer: 'Customer A', phone: '1111111111', items: [{ product_id: prod1Id, qty: 2 }] },
        { customer: 'Customer B', phone: '2222222222', items: [{ product_id: prod2Id, qty: 1 }] },
        { customer: 'Customer C', phone: '3333333333', items: [
          { product_id: prod1Id, qty: 1 },
          { product_id: prod2Id, qty: 2 }
        ]}
      ];

      for (const sale of sales) {
        const saleRes = await request(app)
          .post('/sales')
          .set('Authorization', `Bearer ${cashierToken}`)
          .send({
            customer: { name: sale.customer, phone: sale.phone },
            items: sale.items
          });
        expect(saleRes.statusCode).toBe(201);
      }

      // Owner checks daily report
      const reportRes = await request(app)
        .get('/reports/daily')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(reportRes.statusCode).toBe(200);
      expect(reportRes.body.total_transactions).toBe(3);
      expect(reportRes.body.total_revenue).toBeGreaterThan(0);
      expect(reportRes.body.units_sold).toBe(6); // 2 + 1 + 1 + 2

      // Check inventory levels
      const invRes = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${ownerToken}`);
      const mrfTyre = invRes.body.find(p => p.id === prod1Id);
      const apolloTyre = invRes.body.find(p => p.id === prod2Id);
      
      expect(mrfTyre.stock_qty).toBe(27); // 30 - 2 - 1
      expect(apolloTyre.stock_qty).toBe(17); // 20 - 1 - 2
    });
  });
});
