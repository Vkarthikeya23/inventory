/**
 * Test Setup and Configuration
 * 
 * This file sets up the testing environment with SQLite database
 * and provides utilities for creating test data.
 */

import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcrypt';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test database path
export const TEST_DB_PATH = path.join(__dirname, '../data/test.db');

// Global test database instance
let testDb = null;

/**
 * Initialize test database
 */
export async function initTestDatabase() {
  // Remove existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const SQL = await initSqlJs();
  testDb = new SQL.Database();
  
  // Load schema
  const schemaPath = path.join(__dirname, '../src/db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  testDb.run(schema);
  
  return testDb;
}

/**
 * Get test database instance
 */
export function getTestDb() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call initTestDatabase() first.');
  }
  return testDb;
}

/**
 * Save test database to file
 */
export function saveTestDatabase() {
  if (testDb) {
    const data = testDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(TEST_DB_PATH, buffer);
  }
}

/**
 * Clear all data from test database
 */
export function clearTestDatabase() {
  if (!testDb) return;
  
  const tables = [
    'invoices',
    'sale_items',
    'sales',
    'purchase_order_items',
    'purchase_orders',
    'products',
    'categories',
    'suppliers',
    'customers',
    'users',
    'invoice_sequences'
  ];
  
  for (const table of tables) {
    try {
      testDb.run(`DELETE FROM ${table}`);
    } catch (e) {
      // Table might not exist, ignore
    }
  }
}

/**
 * Create a test user
 */
export function createTestUser({ name, email, password, role }) {
  const passwordHash = bcrypt.hashSync(password, 10);
  const id = generateTestId();
  
  testDb.run(`
    INSERT INTO users (id, name, email, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `, [id, name, email, passwordHash, role]);
  
  return { id, name, email, password, role };
}

/**
 * Create a test category
 */
export function createTestCategory(name, description = null) {
  const id = generateTestId();
  
  testDb.run(`
    INSERT INTO categories (id, name, description)
    VALUES (?, ?, ?)
  `, [id, name, description]);
  
  return { id, name, description };
}

/**
 * Create a test product
 */
export function createTestProduct({ name, brand, category_id, size_spec, hsn_code = '4011', unit_price, cost_price = null, stock_qty = 0, low_stock_threshold = 5 }) {
  const id = generateTestId();
  
  testDb.run(`
    INSERT INTO products (id, name, brand, category_id, size_spec, hsn_code, unit_price, cost_price, stock_qty, low_stock_threshold, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [id, name, brand, category_id, size_spec, hsn_code, unit_price, cost_price, stock_qty, low_stock_threshold]);
  
  return { id, name, brand, category_id, size_spec, hsn_code, unit_price, cost_price, stock_qty, low_stock_threshold };
}

/**
 * Create a test supplier
 */
export function createTestSupplier({ name, contact_person = null, phone = null, email = null, gstin = null }) {
  const id = generateTestId();
  
  testDb.run(`
    INSERT INTO suppliers (id, name, contact_person, phone, email, gstin)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, name, contact_person, phone, email, gstin]);
  
  return { id, name, contact_person, phone, email, gstin };
}

/**
 * Create a test customer
 */
export function createTestCustomer({ name, phone, email = null, vehicle_make = null, vehicle_model = null, vehicle_reg = null }) {
  const id = generateTestId();
  
  testDb.run(`
    INSERT INTO customers (id, name, phone, email, vehicle_make, vehicle_model, vehicle_reg)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, name, phone, email, vehicle_make, vehicle_model, vehicle_reg]);
  
  return { id, name, phone, email, vehicle_make, vehicle_model, vehicle_reg };
}

/**
 * Create a test sale
 */
export function createTestSale({ customer_id, user_id, invoice_number, subtotal, cgst, sgst, total, notes = null }) {
  const id = generateTestId();
  const created_at = new Date().toISOString();
  
  testDb.run(`
    INSERT INTO sales (id, customer_id, user_id, invoice_number, subtotal, cgst, sgst, total, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, customer_id, user_id, invoice_number, subtotal, cgst, sgst, total, notes, created_at]);
  
  return { id, customer_id, user_id, invoice_number, subtotal, cgst, sgst, total, notes, created_at };
}

/**
 * Create a test sale item
 */
export function createTestSaleItem({ sale_id, product_id, qty, unit_price, unit_cost = null, amount }) {
  const id = generateTestId();
  
  testDb.run(`
    INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price, unit_cost, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, sale_id, product_id, qty, unit_price, unit_cost, amount]);
  
  return { id, sale_id, product_id, qty, unit_price, unit_cost, amount };
}

/**
 * Generate a test ID (UUID-like)
 */
function generateTestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Query helper functions
 */
export function query(sql, params = []) {
  const stmt = testDb.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(sql, params = []) {
  const stmt = testDb.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
  stmt.free();
  return null;
}

export function run(sql, params = []) {
  testDb.run(sql, params);
}

// Jest setup
global.beforeAll = beforeAll;
global.afterAll = afterAll;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
