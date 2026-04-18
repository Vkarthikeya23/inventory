-- TRUNCATE ALL DATA EXCEPT USERS
-- Run this in Railway PostgreSQL Query tab

-- Step 1: Delete all sale items (child table)
DELETE FROM sale_items;

-- Step 2: Delete all invoices
DELETE FROM invoices;

-- Step 3: Delete all sales
DELETE FROM sales;

-- Step 4: Delete all products
DELETE FROM products;

-- Step 5: Delete all services
DELETE FROM services;

-- Step 6: Reset invoice number sequence if exists
ALTER SEQUENCE IF EXISTS invoice_number_seq RESTART WITH 1;

-- Verification: Show counts (should all be 0 except users)
SELECT 
  'Products' as table_name, COUNT(*) as count FROM products
UNION ALL
SELECT 'Services', COUNT(*) FROM services
UNION ALL
SELECT 'Sales', COUNT(*) FROM sales
UNION ALL
SELECT 'Sale Items', COUNT(*) FROM sale_items
UNION ALL
SELECT 'Invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'Users (should remain)', COUNT(*) FROM users;