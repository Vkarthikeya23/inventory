/**
 * Categories Route Tests
 * 
 * Tests category management:
 * - GET /categories - List categories
 * - POST /categories - Create category
 */

import request from 'supertest';
import app from '../../src/app.js';
import { 
  initTestDatabase, 
  clearTestDatabase, 
  createTestUser,
  createTestCategory,
  getTestDb
} from '../setup.js';

jest.mock('../../src/db/pool.js', () => ({
  getDb: jest.fn()
}));

describe('Categories Routes', () => {
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

  describe('GET /categories', () => {
    test('should return 200 and list all categories', async () => {
      // Arrange
      createTestCategory('Tyres', 'Car and bike tyres');
      createTestCategory('Tubes', 'Tyre tubes');
      createTestCategory('Rims', 'Alloy rims');

      // Act
      const response = await request(app)
        .get('/categories')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      expect(response.body[0].name).toBeDefined();
      expect(response.body[0].description).toBeDefined();
    });

    test('should return empty array when no categories exist', async () => {
      // Act
      const response = await request(app)
        .get('/categories')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app).get('/categories');

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should work for all user roles', async () => {
      // Arrange
      createTestCategory('Test Category');

      // Test for each role
      const tokens = [ownerToken, managerToken, cashierToken];
      for (const token of tokens) {
        const response = await request(app)
          .get('/categories')
          .set('Authorization', `Bearer ${token}`);
        expect(response.statusCode).toBe(200);
      }
    });

    test('should order categories by name', async () => {
      // Arrange
      createTestCategory('Zebra');
      createTestCategory('Alpha');
      createTestCategory('Beta');

      // Act
      const response = await request(app)
        .get('/categories')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.body[0].name).toBe('Alpha');
      expect(response.body[1].name).toBe('Beta');
      expect(response.body[2].name).toBe('Zebra');
    });
  });

  describe('POST /categories', () => {
    test('should return 201 and create category as owner', async () => {
      // Act
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'New Category', description: 'Test description' });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('New Category');
      expect(response.body.description).toBe('Test description');
    });

    test('should return 201 and create category as manager', async () => {
      // Act
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Manager Category' });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('Manager Category');
    });

    test('should return 403 when cashier tries to create category', async () => {
      // Act
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'Unauthorized' });

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should return 400 when name is missing', async () => {
      // Act
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ description: 'No name provided' });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Category name required');
    });

    test('should return 400 when category name already exists', async () => {
      // Arrange
      createTestCategory('Unique Category');

      // Act
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Unique Category' });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Category name already exists');
    });

    test('should create category without description', async () => {
      // Act
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'No Description Category' });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('No Description Category');
      expect(response.body.description).toBeNull();
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app)
        .post('/categories')
        .send({ name: 'Test' });

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should handle special characters in category name', async () => {
      // Act
      const response = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Tyres & Tubes (All Sizes)', description: 'Special chars: é à ü' });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('Tyres & Tubes (All Sizes)');
    });
  });
});
