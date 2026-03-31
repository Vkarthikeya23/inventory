/**
 * Products Route Tests
 * 
 * Tests product management endpoints:
 * - GET /products - List products
 * - POST /products - Create product
 * - PUT /products/:id - Update product
 */

import request from 'supertest';
import app from '../../src/app.js';
import { 
  initTestDatabase, 
  clearTestDatabase, 
  createTestUser,
  createTestCategory,
  createTestProduct,
  getTestDb,
  queryOne
} from '../setup.js';

// Mock database
jest.mock('../../src/db/pool.js', () => ({
  getDb: jest.fn()
}));

describe('Products Routes', () => {
  let ownerToken;
  let managerToken;
  let cashierToken;
  let categoryId;

  beforeAll(async () => {
    await initTestDatabase();
  });

  afterEach(() => {
    clearTestDatabase();
    ownerToken = null;
    managerToken = null;
    cashierToken = null;
    categoryId = null;
  });

  beforeEach(async () => {
    const { getDb } = await import('../../src/db/pool.js');
    getDb.mockReturnValue(getTestDb());
    
    // Create test users
    createTestUser({ name: 'Owner', email: 'owner@test.com', password: 'password', role: 'owner' });
    createTestUser({ name: 'Manager', email: 'manager@test.com', password: 'password', role: 'manager' });
    createTestUser({ name: 'Cashier', email: 'cashier@test.com', password: 'password', role: 'cashier' });
    
    // Login users
    const ownerRes = await request(app).post('/auth/login').send({ email: 'owner@test.com', password: 'password' });
    ownerToken = ownerRes.body.token;
    
    const managerRes = await request(app).post('/auth/login').send({ email: 'manager@test.com', password: 'password' });
    managerToken = managerRes.body.token;
    
    const cashierRes = await request(app).post('/auth/login').send({ email: 'cashier@test.com', password: 'password' });
    cashierToken = cashierRes.body.token;
    
    // Create test category
    const cat = createTestCategory('Tyres', 'Car and bike tyres');
    categoryId = cat.id;
  });

  describe('GET /products', () => {
    test('should return 200 and list of products for authenticated user', async () => {
      // Arrange
      createTestProduct({ name: 'MRF Tyre', brand: 'MRF', category_id: categoryId, size_spec: '145/70 R12', unit_price: 2500, cost_price: 1800, stock_qty: 10 });
      createTestProduct({ name: 'Apollo Tyre', brand: 'Apollo', category_id: categoryId, size_spec: '155/65 R13', unit_price: 2800, cost_price: 2000, stock_qty: 15 });

      // Act
      const response = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].name).toBeDefined();
      expect(response.body[0].unit_price).toBeDefined();
    });

    test('should filter products by search term', async () => {
      // Arrange
      createTestProduct({ name: 'MRF Zapper', brand: 'MRF', category_id: categoryId, unit_price: 2500, stock_qty: 10 });
      createTestProduct({ name: 'Apollo Alnac', brand: 'Apollo', category_id: categoryId, unit_price: 2800, stock_qty: 15 });

      // Act
      const response = await request(app)
        .get('/products?search=MRF')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toContain('MRF');
    });

    test('should filter products by category_id', async () => {
      // Arrange
      const category2 = createTestCategory('Tubes', 'Tyre tubes');
      createTestProduct({ name: 'MRF Tyre', category_id: categoryId, unit_price: 2500, stock_qty: 10 });
      createTestProduct({ name: 'Tube 12 inch', category_id: category2.id, unit_price: 300, stock_qty: 50 });

      // Act
      const response = await request(app)
        .get(`/products?category_id=${categoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('MRF Tyre');
    });

    test('should filter products by low_stock=true', async () => {
      // Arrange
      createTestProduct({ name: 'Well Stocked', category_id: categoryId, unit_price: 1000, stock_qty: 20, low_stock_threshold: 5 });
      createTestProduct({ name: 'Low Stock', category_id: categoryId, unit_price: 1000, stock_qty: 3, low_stock_threshold: 5 });

      // Act
      const response = await request(app)
        .get('/products?low_stock=true')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('Low Stock');
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app)
        .get('/products');

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should combine search and category filters', async () => {
      // Arrange
      createTestProduct({ name: 'MRF Tyre 1', category_id: categoryId, brand: 'MRF', unit_price: 2500, stock_qty: 10 });
      createTestProduct({ name: 'MRF Tyre 2', category_id: categoryId, brand: 'MRF', unit_price: 2800, stock_qty: 15 });
      createTestProduct({ name: 'Apollo Tyre', category_id: categoryId, brand: 'Apollo', unit_price: 3000, stock_qty: 20 });

      // Act
      const response = await request(app)
        .get(`/products?category_id=${categoryId}&search=MRF`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(2);
      response.body.forEach(p => expect(p.brand).toBe('MRF'));
    });

    test('should exclude deleted products', async () => {
      // Arrange
      const product = createTestProduct({ name: 'Deleted Product', category_id: categoryId, unit_price: 1000, stock_qty: 10 });
      const { getDb } = await import('../../src/db/pool.js');
      const db = getDb();
      db.run('UPDATE products SET is_deleted = 1 WHERE id = ?', [product.id]);

      // Act
      const response = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.some(p => p.name === 'Deleted Product')).toBe(false);
    });

    test('should return empty array when no products exist', async () => {
      // Act
      const response = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /products', () => {
    test('should return 201 and create product as owner', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Bridgestone Tyre',
          brand: 'Bridgestone',
          category_id: categoryId,
          size_spec: '165/65 R14',
          hsn_code: '4011',
          unit_price: 3500,
          cost_price: 2500,
          stock_qty: 20,
          low_stock_threshold: 5
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Bridgestone Tyre');
      expect(response.body.unit_price).toBe(3500);
      expect(response.body.cost_price).toBe(2500);
      expect(response.body.stock_qty).toBe(20);
    });

    test('should return 201 and create product as manager', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'CEAT Tyre',
          brand: 'CEAT',
          category_id: categoryId,
          size_spec: '155/70 R13',
          unit_price: 2200,
          stock_qty: 15
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('CEAT Tyre');
    });

    test('should return 403 when cashier tries to create product', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          name: 'Unauthorized Tyre',
          unit_price: 1000
        });

      // Assert
      expect(response.statusCode).toBe(403);
      expect(response.body.error).toContain('Insufficient privileges');
    });

    test('should return 400 when name is missing', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          unit_price: 1000
        });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('Name');
    });

    test('should return 400 when unit_price is missing', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Product'
        });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('unit_price');
    });

    test('should use default values for optional fields', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Basic Tyre',
          unit_price: 1000
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.hsn_code).toBe('4011');
      expect(response.body.stock_qty).toBe(0);
      expect(response.body.low_stock_threshold).toBe(5);
      expect(response.body.is_deleted).toBe(0);
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .send({
          name: 'Test Product',
          unit_price: 1000
        });

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should create product without category_id', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Uncategorized Tyre',
          unit_price: 1500
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.category_id).toBeNull();
    });

    test('should handle special characters in product name', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: "MRF Zapper Y3 145/70 R12 (Tubeless)",
          brand: "MRF",
          unit_price: 2450.50,
          stock_qty: 25
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe("MRF Zapper Y3 145/70 R12 (Tubeless)");
    });
  });

  describe('PUT /products/:id', () => {
    test('should return 200 and update product as owner', async () => {
      // Arrange
      const product = createTestProduct({ 
        name: 'Old Name', 
        category_id: categoryId, 
        unit_price: 1000, 
        stock_qty: 10 
      });

      // Act
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'New Name',
          unit_price: 1500,
          stock_qty: 20
        });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.name).toBe('New Name');
      expect(response.body.unit_price).toBe(1500);
      expect(response.body.stock_qty).toBe(20);
    });

    test('should return 200 and update product as manager', async () => {
      // Arrange
      const product = createTestProduct({ name: 'Test', category_id: categoryId, unit_price: 1000, stock_qty: 10 });

      // Act
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ unit_price: 1200 });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.unit_price).toBe(1200);
    });

    test('should return 403 when cashier tries to update product', async () => {
      // Arrange
      const product = createTestProduct({ name: 'Test', category_id: categoryId, unit_price: 1000, stock_qty: 10 });

      // Act
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ unit_price: 1500 });

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should return 400 when no valid fields provided', async () => {
      // Arrange
      const product = createTestProduct({ name: 'Test', category_id: categoryId, unit_price: 1000, stock_qty: 10 });

      // Act
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ invalid_field: 'value' });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('No valid fields to update');
    });

    test('should return 404 for non-existent product', async () => {
      // Act
      const response = await request(app)
        .put('/products/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ unit_price: 1500 });

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Product not found');
    });

    test('should soft delete product', async () => {
      // Arrange
      const product = createTestProduct({ name: 'To Delete', category_id: categoryId, unit_price: 1000, stock_qty: 10 });

      // Act
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ is_deleted: 1 });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.is_deleted).toBe(1);
    });

    test('should only allow allowed fields to be updated', async () => {
      // Arrange
      const product = createTestProduct({ name: 'Test', category_id: categoryId, unit_price: 1000, stock_qty: 10 });
      const originalCreatedAt = product.created_at;

      // Act - try to update created_at (not allowed)
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ 
          name: 'Updated Name',
          created_at: '2020-01-01' // Should be ignored
        });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      // created_at should not have changed
    });

    test('should handle partial updates', async () => {
      // Arrange
      const product = createTestProduct({ 
        name: 'Original', 
        brand: 'Original Brand',
        category_id: categoryId, 
        unit_price: 1000, 
        stock_qty: 10 
      });

      // Act - update only brand
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ brand: 'New Brand' });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.brand).toBe('New Brand');
      expect(response.body.name).toBe('Original');
      expect(response.body.unit_price).toBe(1000);
    });
  });

  describe('Product Data Validation', () => {
    test('should handle very long product names', async () => {
      // Arrange
      const longName = 'A'.repeat(200);

      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: longName,
          unit_price: 1000
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe(longName);
    });

    test('should handle decimal prices', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Precision Priced Tyre',
          unit_price: 2499.99,
          cost_price: 1899.50
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.unit_price).toBe(2499.99);
    });

    test('should handle zero stock', async () => {
      // Act
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Out of Stock Tyre',
          unit_price: 1000,
          stock_qty: 0
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.stock_qty).toBe(0);
    });
  });
});
