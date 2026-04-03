-- Fix sales table schema
-- The app expects customer_id, cgst, sgst, total columns
-- But PostgreSQL schema has customer_name, cgst_amount, sgst_amount, total_amount

-- Add customer_id column if not exists
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- Rename columns to match app expectations (or add aliases)
-- Since we already added cgst, sgst, total, let's make sure they're populated
UPDATE sales 
SET cgst = COALESCE(cgst, cgst_amount),
    sgst = COALESCE(sgst, sgst_amount),
    total = COALESCE(total, total_amount)
WHERE cgst IS NULL;

-- Check current schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sales'
ORDER BY ordinal_position;
