-- SQLite schema for Tyre Shop Inventory Management System

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  company_name VARCHAR(100),
  size_spec VARCHAR(50) NOT NULL DEFAULT '',
  cost_price NUMERIC(10,2),
  selling_price_excl_gst NUMERIC(10,2),
  selling_price_incl_gst NUMERIC(10,2),
  gst_rate NUMERIC(5,2) DEFAULT 12.00,
  price_entry_mode VARCHAR(10) DEFAULT 'excl' CHECK (price_entry_mode IN ('excl', 'incl')),
  stock_qty INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  email VARCHAR(150),
  vehicle_make VARCHAR(50),
  vehicle_model VARCHAR(50),
  vehicle_reg VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  user_id TEXT REFERENCES users(id),
  invoice_number VARCHAR(30) UNIQUE NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  cgst NUMERIC(10,2) NOT NULL,
  sgst NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  received_amount NUMERIC(10,2) DEFAULT 0,
  balance NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  qty INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  gst_rate NUMERIC(5,2) DEFAULT 12,
  gst_amount NUMERIC(10,2),
  amount NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  sale_id TEXT UNIQUE REFERENCES sales(id),
  invoice_data TEXT NOT NULL,
  public_token VARCHAR(12) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_sequences (
  yymm VARCHAR(4) PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_qty) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_public_token ON invoices(public_token);
