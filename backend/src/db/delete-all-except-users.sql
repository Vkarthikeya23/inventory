-- DELETE ALL DATA EXCEPT USERS
-- Run this in Railway PostgreSQL Query tab

-- Delete sale items first (child table)
DELETE FROM sale_items;

-- Delete invoices
DELETE FROM invoices;

-- Delete sales  
DELETE FROM sales;

-- Delete products
DELETE FROM products;

-- Delete services
DELETE FROM services;

-- Verification
SELECT 'Products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'Services', COUNT(*) FROM services
UNION ALL SELECT 'Sales', COUNT(*) FROM sales
UNION ALL SELECT 'Sale Items', COUNT(*) FROM sale_items
UNION ALL SELECT 'Invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'Users (kept)', COUNT(*) FROM users;