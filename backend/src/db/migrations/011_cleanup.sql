-- Migration 011: Cleanup obsolete tables and update products schema
-- This migration removes categories, suppliers, purchase_orders, and updates products

-- Drop obsolete tables (order matters for foreign keys)
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS categories;

-- Drop obsolete indexes
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_low_stock;

-- Create temporary table with new schema
CREATE TABLE products_new (
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

-- Copy existing data (if any), mapping old columns to new
INSERT INTO products_new (
  id,
  company_name,
  size_spec,
  cost_price,
  selling_price_excl_gst,
  selling_price_incl_gst,
  gst_rate,
  price_entry_mode,
  stock_qty,
  is_deleted,
  created_at
)
SELECT 
  id,
  brand as company_name,
  COALESCE(size_spec, '') as size_spec,
  cost_price,
  unit_price as selling_price_excl_gst,
  ROUND(unit_price * 1.12, 2) as selling_price_incl_gst,
  12.00 as gst_rate,
  'excl' as price_entry_mode,
  stock_qty,
  is_deleted,
  created_at
FROM products;

-- Drop old products table
DROP TABLE products;

-- Rename new table to products
ALTER TABLE products_new RENAME TO products;

-- Add new index
CREATE INDEX idx_products_stock ON products(stock_qty) WHERE is_deleted = 0;

-- Update sale_items table to add gst fields
ALTER TABLE sale_items ADD COLUMN gst_rate NUMERIC(5,2) DEFAULT 12;
ALTER TABLE sale_items ADD COLUMN gst_amount NUMERIC(10,2);

-- Update sales table to add received_amount and balance
ALTER TABLE sales ADD COLUMN received_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN balance NUMERIC(10,2) DEFAULT 0;
