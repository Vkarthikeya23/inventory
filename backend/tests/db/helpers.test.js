/**
 * Database Helper Tests
 * 
 * Tests database utility functions
 */

import { 
  initTestDatabase, 
  clearTestDatabase,
  query,
  queryOne,
  run,
  getTestDb
} from '../setup.js';

describe('Database Helpers', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  beforeEach(() => {
    clearTestDatabase();
  });

  describe('query()', () => {
    test('should execute SELECT and return array of results', () => {
      // Arrange
      const { getDb } = require('../../src/db/pool.js');
      const db = getDb();
      db.run(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ('1', 'User 1', 'user1@test.com', 'hash', 'owner'),
        ('2', 'User 2', 'user2@test.com', 'hash', 'manager')
      `);

      // Act
      const results = query('SELECT * FROM users ORDER BY name');

      // Assert
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0].name).toBe('User 1');
      expect(results[1].name).toBe('User 2');
    });

    test('should return empty array for no results', () => {
      // Act
      const results = query('SELECT * FROM users WHERE 1=0');

      // Assert
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should handle parameterized queries', () => {
      // Arrange
      const { getDb } = require('../../src/db/pool.js');
      const db = getDb();
      db.run(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ('1', 'User 1', 'user1@test.com', 'hash', 'owner')
      `);

      // Act
      const results = query('SELECT * FROM users WHERE role = ?', ['owner']);

      // Assert
      expect(results.length).toBe(1);
      expect(results[0].role).toBe('owner');
    });
  });

  describe('queryOne()', () => {
    test('should return single result', () => {
      // Arrange
      const { getDb } = require('../../src/db/pool.js');
      const db = getDb();
      db.run(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ('1', 'Test User', 'test@test.com', 'hash', 'owner')
      `);

      // Act
      const result = queryOne('SELECT * FROM users WHERE id = ?', ['1']);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Test User');
    });

    test('should return null for no results', () => {
      // Act
      const result = queryOne('SELECT * FROM users WHERE id = ?', ['nonexistent']);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('run()', () => {
    test('should execute INSERT statement', () => {
      // Act
      run('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', 
        ['1', 'New User', 'new@test.com', 'hash', 'cashier']);

      // Assert
      const result = queryOne('SELECT * FROM users WHERE id = ?', ['1']);
      expect(result).toBeDefined();
      expect(result.name).toBe('New User');
    });

    test('should execute UPDATE statement', () => {
      // Arrange
      const { getDb } = require('../../src/db/pool.js');
      const db = getDb();
      db.run(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ('1', 'Old Name', 'test@test.com', 'hash', 'owner')
      `);

      // Act
      run('UPDATE users SET name = ? WHERE id = ?', ['New Name', '1']);

      // Assert
      const result = queryOne('SELECT * FROM users WHERE id = ?', ['1']);
      expect(result.name).toBe('New Name');
    });

    test('should execute DELETE statement', () => {
      // Arrange
      const { getDb } = require('../../src/db/pool.js');
      const db = getDb();
      db.run(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ('1', 'To Delete', 'test@test.com', 'hash', 'owner')
      `);

      // Act
      run('DELETE FROM users WHERE id = ?', ['1']);

      // Assert
      const result = queryOne('SELECT * FROM users WHERE id = ?', ['1']);
      expect(result).toBeNull();
    });
  });
});
