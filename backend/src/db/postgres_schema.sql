-- PostgreSQL Schema for TyreShop Pro
-- Run this on your Railway PostgreSQL database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  company_name TEXT,
  size_spec TEXT,
  hsn_code TEXT,
  cost_price DECIMAL(10, 2) DEFAULT 0,
  selling_price_excl_gst DECIMAL(10, 2) NOT NULL,
  gst_rate DECIMAL(5, 2) DEFAULT 12,
  stock_qty INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  vehicle_reg TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  cgst_amount DECIMAL(10, 2) NOT NULL,
  sgst_amount DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  received_amount DECIMAL(10, 2) NOT NULL,
  balance_amount DECIMAL(10, 2) NOT NULL,
  sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sale items table
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  qty INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  unit_cost DECIMAL(10, 2) DEFAULT 0,
  gst_rate DECIMAL(5, 2) DEFAULT 12,
  subtotal DECIMAL(10, 2) NOT NULL,
  gst_amount DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_invoice ON sales(invoice_number);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
  ('Tyres', 'Car and bike tyres'),
  ('Tubes', 'Inner tubes'),
  ('Accessories', 'Tyre accessories and tools')
ON CONFLICT (name) DO NOTHING;

-- Insert default users (password: admin123)
-- Note: These are bcrypt hashed passwords
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Shop Owner', 'owner@tyreshop.com', '$2b$10$YourHashedPasswordHere', 'owner'),
  ('Manager', 'manager@tyreshop.com', '$2b$10$YourHashedPasswordHere', 'manager'),
  ('Cashier', 'cashier@tyreshop.com', '$2b$10$YourHashedPasswordHere', 'cashier')
ON CONFLICT (email) DO NOTHING;
