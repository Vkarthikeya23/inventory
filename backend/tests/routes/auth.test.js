/**
 * Auth Route Tests
 * 
 * Tests authentication endpoints:
 * - POST /auth/login - Login with credentials
 * - GET /auth/me - Get current user info
 */

import request from 'supertest';
import app from '../src/app.js';
import { 
  initTestDatabase, 
  clearTestDatabase, 
  createTestUser,
  getTestDb 
} from './setup.js';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock database
jest.mock('../src/db/pool.js', () => ({
  getDb: jest.fn(),
  initDatabase: jest.fn(),
  saveDatabase: jest.fn()
}));

describe('Auth Routes', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  afterEach(() => {
    clearTestDatabase();
  });

  beforeEach(() => {
    // Reset getDb mock to return test database
    const { getDb } = await import('../src/db/pool.js');
    getDb.mockReturnValue(getTestDb());
  });

  describe('POST /auth/login', () => {
    test('should return 200 and token with valid credentials', async () => {
      // Arrange
      const user = createTestUser({
        name: 'Test Owner',
        email: 'test@owner.com',
        password: 'testpassword',
        role: 'owner'
      });

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@owner.com', password: 'testpassword' });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@owner.com');
      expect(response.body.user.role).toBe('owner');
      expect(response.body.user.password_hash).toBeUndefined();
    });

    test('should return 401 with invalid password', async () => {
      // Arrange
      createTestUser({
        name: 'Test User',
        email: 'test@user.com',
        password: 'correctpassword',
        role: 'cashier'
      });

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@user.com', password: 'wrongpassword' });

      // Assert
      expect(response.statusCode).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.token).toBeUndefined();
    });

    test('should return 401 with non-existent email', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'anypassword' });

      // Assert
      expect(response.statusCode).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should return 400 when email is missing', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ password: 'somepassword' });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Email and password required');
    });

    test('should return 400 when password is missing', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com' });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Email and password required');
    });

    test('should return 401 when user is inactive', async () => {
      // Arrange
      const user = createTestUser({
        name: 'Inactive User',
        email: 'inactive@test.com',
        password: 'password',
        role: 'cashier'
      });
      
      // Set user to inactive
      run('UPDATE users SET is_active = 0 WHERE id = ?', [user.id]);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'inactive@test.com', password: 'password' });

      // Assert
      expect(response.statusCode).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should return 400 when both email and password are missing', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({});

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Email and password required');
    });

    test('should return 400 with empty email string', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: '', password: 'somepassword' });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Email and password required');
    });

    test('should return 400 with empty password string', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: '' });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Email and password required');
    });

    test('should work for all user roles (owner, manager, cashier)', async () => {
      // Arrange
      const roles = ['owner', 'manager', 'cashier'];
      
      for (const role of roles) {
        const email = `${role}@test.com`;
        createTestUser({
          name: `Test ${role}`,
          email: email,
          password: 'testpass',
          role: role
        });

        // Act
        const response = await request(app)
          .post('/auth/login')
          .send({ email: email, password: 'testpass' });

        // Assert
        expect(response.statusCode).toBe(200);
        expect(response.body.user.role).toBe(role);
        expect(response.body.token).toBeDefined();
      }
    });
  });

  describe('GET /auth/me', () => {
    test('should return 200 and user data with valid token', async () => {
      // Arrange
      const user = createTestUser({
        name: 'Test Owner',
        email: 'owner@test.com',
        password: 'password',
        role: 'owner'
      });
      
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'owner@test.com', password: 'password' });
      const token = loginRes.body.token;

      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(user.id);
      expect(response.body.name).toBe('Test Owner');
      expect(response.body.email).toBe('owner@test.com');
      expect(response.body.role).toBe('owner');
      expect(response.body.password_hash).toBeUndefined();
    });

    test('should return 401 without token', async () => {
      // Act
      const response = await request(app)
        .get('/auth/me');

      // Assert
      expect(response.statusCode).toBe(401);
      expect(response.body.error).toContain('Authorization');
    });

    test('should return 401 with invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should return 401 with malformed authorization header', async () => {
      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'NotBearer token');

      // Assert
      expect(response.statusCode).toBe(401);
    });

    test('should return 401 when user no longer exists', async () => {
      // Arrange
      const user = createTestUser({
        name: 'Deleted User',
        email: 'deleted@test.com',
        password: 'password',
        role: 'manager'
      });
      
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'deleted@test.com', password: 'password' });
      const token = loginRes.body.token;
      
      // Delete user
      run('DELETE FROM users WHERE id = ?', [user.id]);

      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    test('should work for all user roles', async () => {
      // Arrange
      const roles = ['owner', 'manager', 'cashier'];
      
      for (const role of roles) {
        const email = `${role}2@test.com`;
        createTestUser({
          name: `Test ${role}`,
          email: email,
          password: 'testpass',
          role: role
        });

        const loginRes = await request(app)
          .post('/auth/login')
          .send({ email: email, password: 'testpass' });
        const token = loginRes.body.token;

        // Act
        const response = await request(app)
          .get('/auth/me')
          .set('Authorization', `Bearer ${token}`);

        // Assert
        expect(response.statusCode).toBe(200);
        expect(response.body.role).toBe(role);
      }
    });

    test('should return 401 with expired token', async () => {
      // Arrange - Create expired token manually
      const user = createTestUser({
        name: 'Test User',
        email: 'expired@test.com',
        password: 'password',
        role: 'cashier'
      });
      
      const expiredToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'testsecret',
        { expiresIn: '-1s' } // Already expired
      );

      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      // Assert
      expect(response.statusCode).toBe(401);
    });
  });

  describe('JWT Token Validation', () => {
    test('token should contain correct user information', async () => {
      // Arrange
      createTestUser({
        name: 'Token Test',
        email: 'token@test.com',
        password: 'password',
        role: 'manager'
      });

      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'token@test.com', password: 'password' });
      const token = loginRes.body.token;

      // Decode token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'testsecret');

      // Assert
      expect(decoded.email).toBe('token@test.com');
      expect(decoded.role).toBe('manager');
      expect(decoded.id).toBeDefined();
      expect(decoded.exp).toBeDefined(); // Has expiration
    });

    test('token should expire after specified time', async () => {
      // This test verifies the JWT_EXPIRES_IN is working
      // By default tokens expire in 7 days
      
      // Arrange
      createTestUser({
        name: 'Expiry Test',
        email: 'expiry@test.com',
        password: 'password',
        role: 'owner'
      });

      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'expiry@test.com', password: 'password' });
      const token = loginRes.body.token;

      // Decode and check expiration
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'testsecret');
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - now;
      
      // Should be approximately 7 days (604800 seconds)
      expect(expiresIn).toBeGreaterThan(604700); // Just under 7 days
      expect(expiresIn).toBeLessThanOrEqual(604800); // 7 days
    });
  });
});
