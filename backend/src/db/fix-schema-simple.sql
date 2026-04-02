-- Simple PostgreSQL Schema Fix - Run each command one by one
-- Run these commands individually in Railway PostgreSQL console

-- Command 1: Add columns to products table
ALTER TABLE products ADD COLUMN selling_price_incl_gst DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN price_entry_mode VARCHAR(10) DEFAULT 'excl';
ALTER TABLE products ADD COLUMN is_deleted BOOLEAN DEFAULT false;

-- Command 2: Update existing products
UPDATE products SET selling_price_incl_gst = ROUND(selling_price_excl_gst * (1 + gst_rate/100), 2) WHERE selling_price_incl_gst IS NULL;
UPDATE products SET price_entry_mode = 'excl' WHERE price_entry_mode IS NULL;
UPDATE products SET is_deleted = false WHERE is_deleted IS NULL;

-- Command 3: Add columns to sales table
ALTER TABLE sales ADD COLUMN cgst DECIMAL(10, 2);
ALTER TABLE sales ADD COLUMN sgst DECIMAL(10, 2);
ALTER TABLE sales ADD COLUMN total DECIMAL(10, 2);
ALTER TABLE sales ADD COLUMN received_amount DECIMAL(10, 2);
ALTER TABLE sales ADD COLUMN balance DECIMAL(10, 2);
ALTER TABLE sales ADD COLUMN customer_id UUID REFERENCES users(id);
ALTER TABLE sales ADD COLUMN notes TEXT;

-- Command 4: Copy data in sales table
UPDATE sales SET cgst = COALESCE(cgst_amount, 0);
UPDATE sales SET sgst = COALESCE(sgst_amount, 0);
UPDATE sales SET total = COALESCE(total_amount, 0);
UPDATE sales SET received_amount = COALESCE(received_amount, total_amount);
UPDATE sales SET balance = COALESCE(balance_amount, 0);

-- Command 5: Add amount column to sale_items
ALTER TABLE sale_items ADD COLUMN amount DECIMAL(10, 2);
UPDATE sale_items SET amount = COALESCE(total_amount, subtotal + gst_amount);

-- Command 6: Verify (optional)
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('products', 'sales', 'sale_items')
ORDER BY table_name, ordinal_position;
