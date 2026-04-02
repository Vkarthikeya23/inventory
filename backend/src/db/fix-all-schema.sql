-- Complete PostgreSQL Schema Fix
-- Run this in Railway PostgreSQL console

-- Add missing columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS selling_price_incl_gst DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS price_entry_mode VARCHAR(10) DEFAULT 'excl',
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Update existing products
UPDATE products 
SET selling_price_incl_gst = ROUND(selling_price_excl_gst * (1 + gst_rate/100), 2),
    price_entry_mode = 'excl',
    is_deleted = false
WHERE selling_price_incl_gst IS NULL;

-- Check if sales table has correct columns
-- PostgreSQL schema uses: subtotal, cgst_amount, sgst_amount, total_amount
-- But SQLite/JS code might use: subtotal, cgst, sgst, total, received_amount, balance

-- Add missing columns to sales table if needed
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS cgst DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS sgst DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS received_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS balance DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update sales table from old columns to new
UPDATE sales 
SET cgst = cgst_amount,
    sgst = sgst_amount,
    total = total_amount,
    received_amount = received_amount,
    balance = balance_amount
WHERE cgst IS NULL;

-- Check sale_items table
-- PostgreSQL has: unit_price, unit_cost, gst_rate, subtotal, gst_amount, total_amount
-- But code might use: unit_price, unit_cost, gst_rate, gst_amount, amount

-- Add missing columns to sale_items
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2);

-- Update sale_items
UPDATE sale_items 
SET amount = total_amount
WHERE amount IS NULL;

-- Verify all tables
SELECT 'products' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products'
ORDER BY ordinal_position;
