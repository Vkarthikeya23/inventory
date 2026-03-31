#!/usr/bin/env node

/**
 * Data Migration Script: SQLite → PostgreSQL
 * 
 * Usage:
 * 1. Set up your Railway PostgreSQL database
 * 2. Add DATABASE_URL to your .env file
 * 3. Run: node src/db/migrate-to-postgres.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

function generateUUID() {
  return crypto.randomUUID();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

// Load SQLite data
async function loadSqliteData() {
  // Read the SQLite database file
  const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/tyreshop.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error('SQLite database not found:', dbPath);
    return null;
  }
  
  // We'll need to use sql.js to read the SQLite file
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);
  
  const data = {
    users: [],
    categories: [],
    products: [],
    sales: [],
    sale_items: []
  };
  
  // Extract users
  try {
    const stmt = db.prepare('SELECT * FROM users');
    while (stmt.step()) {
      data.users.push(stmt.getAsObject());
    }
    stmt.free();
    console.log(`Found ${data.users.length} users`);
  } catch (e) {
    console.log('No users table or empty');
  }
  
  // Extract categories
  try {
    const stmt = db.prepare('SELECT * FROM categories');
    while (stmt.step()) {
      data.categories.push(stmt.getAsObject());
    }
    stmt.free();
    console.log(`Found ${data.categories.length} categories`);
  } catch (e) {
    console.log('No categories table or empty');
  }
  
  // Extract products
  try {
    const stmt = db.prepare('SELECT * FROM products');
    while (stmt.step()) {
      data.products.push(stmt.getAsObject());
    }
    stmt.free();
    console.log(`Found ${data.products.length} products`);
  } catch (e) {
    console.log('No products table or empty');
  }
  
  // Extract sales
  try {
    const stmt = db.prepare('SELECT * FROM sales');
    while (stmt.step()) {
      data.sales.push(stmt.getAsObject());
    }
    stmt.free();
    console.log(`Found ${data.sales.length} sales`);
  } catch (e) {
    console.log('No sales table or empty');
  }
  
  // Extract sale_items
  try {
    const stmt = db.prepare('SELECT * FROM sale_items');
    while (stmt.step()) {
      data.sale_items.push(stmt.getAsObject());
    }
    stmt.free();
    console.log(`Found ${data.sale_items.length} sale items`);
  } catch (e) {
    console.log('No sale_items table or empty');
  }
  
  db.close();
  return data;
}

// Migrate data to PostgreSQL
async function migrateToPostgres(data) {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL not set!');
    console.error('Set it like: export DATABASE_URL=postgresql://user:pass@host:5432/dbname');
    process.exit(1);
  }
  
  console.log('\nConnecting to PostgreSQL...');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    console.log('Creating tables...');
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'postgres_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    console.log('Schema created successfully');
    
    // Migrate users
    console.log('\nMigrating users...');
    for (const user of data.users) {
      try {
        // Generate UUID if id is null or invalid
        const userId = user.id && user.id !== 'null' ? user.id : generateUUID();
        const isActive = user.is_active === 1 || user.is_active === true ? true : false;
        const createdAt = user.created_at ? new Date(user.created_at) : new Date();
        
        await client.query(`
          INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (email) DO NOTHING
        `, [userId, user.name, user.email, user.password_hash, user.role, isActive, createdAt]);
        console.log('  ✓ Migrated user:', user.email);
      } catch (err) {
        console.error('Error migrating user:', user.email, err.message);
      }
    }
    
    // Migrate categories
    console.log('Migrating categories...');
    for (const cat of data.categories) {
      try {
        const catId = cat.id && cat.id !== 'null' ? cat.id : generateUUID();
        const isActive = cat.is_active === 1 || cat.is_active === true ? true : false;
        const createdAt = cat.created_at ? new Date(cat.created_at) : new Date();
        
        await client.query(`
          INSERT INTO categories (id, name, description, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (name) DO NOTHING
        `, [catId, cat.name, cat.description, isActive, createdAt]);
        console.log('  ✓ Migrated category:', cat.name);
      } catch (err) {
        console.error('Error migrating category:', cat.name, err.message);
      }
    }
    
    // Migrate products
    console.log('Migrating products...');
    for (const prod of data.products) {
      try {
        await client.query(`
          INSERT INTO products (id, category_id, display_name, company_name, size_spec, hsn_code, cost_price, selling_price_excl_gst, gst_rate, stock_qty, min_stock, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO NOTHING
        `, [prod.id, prod.category_id, prod.display_name, prod.company_name, prod.size_spec, prod.hsn_code, prod.cost_price, prod.selling_price_excl_gst, prod.gst_rate, prod.stock_qty, prod.min_stock, prod.is_active, prod.created_at]);
      } catch (err) {
        console.error('Error migrating product:', prod.display_name, err.message);
      }
    }
    
    // Migrate sales
    console.log('Migrating sales...');
    for (const sale of data.sales) {
      try {
        await client.query(`
          INSERT INTO sales (id, invoice_number, customer_name, customer_phone, vehicle_reg, user_id, subtotal, cgst_amount, sgst_amount, total_amount, received_amount, balance_amount, sale_date, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING
        `, [sale.id, sale.invoice_number, sale.customer_name, sale.customer_phone, sale.vehicle_reg, sale.user_id, sale.subtotal, sale.cgst_amount, sale.sgst_amount, sale.total_amount, sale.received_amount, sale.balance_amount, sale.sale_date, sale.created_at]);
      } catch (err) {
        console.error('Error migrating sale:', sale.invoice_number, err.message);
      }
    }
    
    // Migrate sale items
    console.log('Migrating sale items...');
    for (const item of data.sale_items) {
      try {
        await client.query(`
          INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price, unit_cost, gst_rate, subtotal, gst_amount, total_amount, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [item.id, item.sale_id, item.product_id, item.qty, item.unit_price, item.unit_cost, item.gst_rate, item.subtotal, item.gst_amount, item.total_amount, item.created_at]);
      } catch (err) {
        console.error('Error migrating sale item:', item.id, err.message);
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log(`Migrated: ${data.users.length} users, ${data.categories.length} categories, ${data.products.length} products, ${data.sales.length} sales, ${data.sale_items.length} sale items`);
    
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Main execution
async function main() {
  console.log('=== TyreShop Pro: SQLite → PostgreSQL Migration ===\n');
  
  const data = await loadSqliteData();
  if (!data) {
    console.error('Failed to load SQLite data');
    process.exit(1);
  }
  
  await migrateToPostgres(data);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
