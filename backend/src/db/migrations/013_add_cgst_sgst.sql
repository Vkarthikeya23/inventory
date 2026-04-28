-- Add cgst_rate and sgst_rate columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) DEFAULT 6;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) DEFAULT 6;

-- Update existing products to split their gst_rate into cgst and sgst equally
UPDATE products SET cgst_rate = gst_rate / 2, sgst_rate = gst_rate / 2 WHERE cgst_rate IS NULL OR sgst_rate IS NULL;
