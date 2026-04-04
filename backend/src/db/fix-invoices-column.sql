-- Fix invoices table - change JSONB to TEXT to avoid [object Object] issue
ALTER TABLE invoices ALTER COLUMN invoice_data TYPE TEXT;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices' AND column_name = 'invoice_data';
