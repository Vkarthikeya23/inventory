-- Script to truncate all products, services, sales, and invoices
-- WARNING: This will DELETE ALL DATA permanently

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Truncate in correct order (child tables first)
TRUNCATE TABLE sale_items CASCADE;
TRUNCATE TABLE invoices CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE services CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Reset sequences if needed
-- ALTER SEQUENCE products_id_seq RESTART WITH 1;
-- ALTER SEQUENCE sales_id_seq RESTART WITH 1;

SELECT 'All data truncated successfully' as status;