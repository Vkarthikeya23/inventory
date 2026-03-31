/**
 * Suppliers Route Tests
 * 
 * Tests supplier management:
 * - GET /suppliers - List suppliers
 * - POST /suppliers - Create supplier
 */

import request from 'supertest';
import app from '../../src/app.js';
import { 
  initTestDatabase, 
  clearTestDatabase, 
  createTestUser,
  createTestSupplier,
  getTestDb
} from '../setup.js';

jest.mock('../../src/db/pool.js', () => ({
  getDb: jest.fn()
}));

describe('Suppliers Routes', () => {
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

  describe('GET /suppliers', () => {
    test('should return 200 and list all suppliers', async () => {
      // Arrange
      createTestSupplier({ name: 'MRF Ltd', contact_person: 'John Doe', phone: '9999999999', email: 'john@mrf.com', gstin: '27AABCM1234L1Z5' });
      createTestSupplier({ name: 'Apollo Tyres', contact_person: 'Jane Smith', phone: '8888888888', gstin: '27AABCM5678M2Z6' });

      // Act
      const response = await request(app)
        .get('/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].name).toBeDefined();
      expect(response.body[0].gstin).toBeDefined();
    });

    test('should return empty array when no suppliers exist', async () => {
      // Act
      const response = await request(app)
        .get('/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app).get('/suppliers');

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should return 403 for cashier', async () => {
      // Act
      const response = await request(app)
        .get('/suppliers')
        .set('Authorization', `Bearer ${cashierToken}`);

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should work for owner and manager', async () => {
      // Arrange
      createTestSupplier({ name: 'Test Supplier' });

      // Test owner
      const ownerRes = await request(app)
        .get('/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerRes.statusCode).toBe(200);

      // Test manager
      const managerRes = await request(app)
        .get('/suppliers')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(managerRes.statusCode).toBe(200);
    });
  });

  describe('POST /suppliers', () => {
    test('should return 201 and create supplier as owner', async () => {
      // Act
      const response = await request(app)
        .post('/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Bridgestone India',
          contact_person: 'Rajesh Kumar',
          phone: '7777777777',
          email: 'rajesh@bridgestone.com',
          gstin: '27AABCM9012N3Z7'
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Bridgestone India');
      expect(response.body.contact_person).toBe('Rajesh Kumar');
      expect(response.body.phone).toBe('7777777777');
      expect(response.body.email).toBe('rajesh@bridgestone.com');
      expect(response.body.gstin).toBe('27AABCM9012N3Z7');
    });

    test('should return 201 and create supplier as manager', async () => {
      // Act
      const response = await request(app)
        .post('/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'CEAT Ltd', phone: '6666666666' });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('CEAT Ltd');
    });

    test('should return 403 when cashier tries to create supplier', async () => {
      // Act
      const response = await request(app)
        .post('/suppliers')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'Unauthorized' });

      // Assert
      expect(response.statusCode).toBe(403);
    });

    test('should return 400 when name is missing', async () => {
      // Act
      const response = await request(app)
        .post('/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ phone: '9999999999' });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Supplier name required');
    });

    test('should create supplier with minimal data', async () => {
      // Act
      const response = await request(app)
        .post('/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Minimal Supplier' });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('Minimal Supplier');
      expect(response.body.contact_person).toBeNull();
      expect(response.body.phone).toBeNull();
    });

    test('should return 401 for unauthenticated request', async () => {
      // Act
      const response = await request(app)
        .post('/suppliers')
        .send({ name: 'Test' });

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should handle special characters in supplier data', async () => {
      // Act
      const response = await request(app)
        .post('/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'JK Tyre & Industries Ltd.',
          contact_person: 'Ramesh P. Singh',
          address: '123, Industrial Area, Phase-2'
        });

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('JK Tyre & Industries Ltd.');
    });
  });
});
