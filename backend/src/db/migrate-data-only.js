#!/usr/bin/env node

/**
 * Data-Only Migration: Migrate SQLite data to existing PostgreSQL database
 * 
 * Use this if PostgreSQL tables already exist and you just want to migrate data
 * 
 * Usage:
 * export DATABASE_URL=postgresql://...
 * export SQLITE_DB_PATH=./data/tyreshop.db
 * node src/db/migrate-data-only.js
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
  const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/tyreshop.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error('SQLite database not found:', dbPath);
    return null;
  }
  
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
async function migrateDataToPostgres(data) {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL not set!');
    process.exit(1);
  }
  
  console.log('\nConnecting to PostgreSQL...');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    console.log('Migrating data only (assuming tables exist)...\n');
    
    // Migrate users
    if (data.users.length > 0) {
      console.log('Migrating users...');
      for (const user of data.users) {
        try {
          const userId = user.id && user.id !== 'null' && user.id !== '' ? user.id : generateUUID();
          const isActive = user.is_active === 1 || user.is_active === true ? true : false;
          const createdAt = user.created_at ? new Date(user.created_at) : new Date();
          
          await client.query(`
            INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) DO NOTHING
          `, [userId, user.name, user.email, user.password_hash, user.role, isActive, createdAt]);
          console.log('  ✓ Migrated user:', user.email);
        } catch (err) {
          console.error('  ✗ Error migrating user:', user.email, err.message);
        }
      }
    }
    
    // Migrate categories
    if (data.categories.length > 0) {
      console.log('\nMigrating categories...');
      for (const cat of data.categories) {
        try {
          const catId = cat.id && cat.id !== 'null' && cat.id !== '' ? cat.id : generateUUID();
          const isActive = cat.is_active === 1 || cat.is_active === true ? true : false;
          const createdAt = cat.created_at ? new Date(cat.created_at) : new Date();
          
          await client.query(`
            INSERT INTO categories (id, name, description, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (name) DO NOTHING
          `, [catId, cat.name, cat.description, isActive, createdAt]);
          console.log('  ✓ Migrated category:', cat.name);
        } catch (err) {
          console.error('  ✗ Error migrating category:', cat.name, err.message);
        }
      }
    }
    
    // Migrate products
    if (data.products.length > 0) {
      console.log('\nMigrating products...');
      let migrated = 0;
      for (const prod of data.products) {
        try {
          const prodId = prod.id && prod.id !== 'null' && prod.id !== '' ? prod.id : generateUUID();
          const catId = prod.category_id && prod.category_id !== 'null' ? prod.category_id : null;
          const isActive = prod.is_active === 1 || prod.is_active === true ? true : false;
          const createdAt = prod.created_at ? new Date(prod.created_at) : new Date();
          
          await client.query(`
            INSERT INTO products (id, category_id, display_name, company_name, size_spec, hsn_code, cost_price, selling_price_excl_gst, gst_rate, stock_qty, min_stock, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING
          `, [prodId, catId, prod.display_name, prod.company_name, prod.size_spec, prod.hsn_code, prod.cost_price, prod.selling_price_excl_gst, prod.gst_rate, prod.stock_qty, prod.min_stock, isActive, createdAt]);
          migrated++;
        } catch (err) {
          console.error('  ✗ Error migrating product:', prod.display_name, err.message);
        }
      }
      console.log(`  ✓ Migrated ${migrated}/${data.products.length} products`);
    }
    
    // Migrate sales
    if (data.sales.length > 0) {
      console.log('\nMigrating sales...');
      let migrated = 0;
      for (const sale of data.sales) {
        try {
          const saleId = sale.id && sale.id !== 'null' && sale.id !== '' ? sale.id : generateUUID();
          const userId = sale.user_id && sale.user_id !== 'null' ? sale.user_id : null;
          const saleDate = sale.sale_date ? new Date(sale.sale_date) : new Date();
          const createdAt = sale.created_at ? new Date(sale.created_at) : new Date();
          
          await client.query(`
            INSERT INTO sales (id, invoice_number, customer_name, customer_phone, vehicle_reg, user_id, subtotal, cgst_amount, sgst_amount, total_amount, received_amount, balance_amount, sale_date, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (invoice_number) DO NOTHING
          `, [saleId, sale.invoice_number, sale.customer_name, sale.customer_phone, sale.vehicle_reg, userId, sale.subtotal, sale.cgst_amount, sale.sgst_amount, sale.total_amount, sale.received_amount, sale.balance_amount, saleDate, createdAt]);
          migrated++;
        } catch (err) {
          console.error('  ✗ Error migrating sale:', sale.invoice_number, err.message);
        }
      }
      console.log(`  ✓ Migrated ${migrated}/${data.sales.length} sales`);
    }
    
    // Migrate sale items
    if (data.sale_items.length > 0) {
      console.log('\nMigrating sale items...');
      let migrated = 0;
      for (const item of data.sale_items) {
        try {
          const itemId = item.id && item.id !== 'null' && item.id !== '' ? item.id : generateUUID();
          const saleId = item.sale_id && item.sale_id !== 'null' ? item.sale_id : null;
          const prodId = item.product_id && item.product_id !== 'null' ? item.product_id : null;
          const createdAt = item.created_at ? new Date(item.created_at) : new Date();
          
          await client.query(`
            INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price, unit_cost, gst_rate, subtotal, gst_amount, total_amount, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO NOTHING
          `, [itemId, saleId, prodId, item.qty, item.unit_price, item.unit_cost, item.gst_rate, item.subtotal, item.gst_amount, item.total_amount, createdAt]);
          migrated++;
        } catch (err) {
          console.error('  ✗ Error migrating sale item:', item.id, err.message);
        }
      }
      console.log(`  ✓ Migrated ${migrated}/${data.sale_items.length} sale items`);
    }
    
    console.log('\n✅ Data migration completed!');
    console.log(`Summary: ${data.users.length} users, ${data.categories.length} categories, ${data.products.length} products, ${data.sales.length} sales, ${data.sale_items.length} sale items found in SQLite`);
    
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
  console.log('=== TyreShop Pro: Data-Only Migration (SQLite → PostgreSQL) ===\n');
  
  const data = await loadSqliteData();
  if (!data) {
    console.error('Failed to load SQLite data');
    process.exit(1);
  }
  
  await migrateDataToPostgres(data);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
