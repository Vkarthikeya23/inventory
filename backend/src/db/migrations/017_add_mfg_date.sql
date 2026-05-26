-- Add manufacturing date to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS mfg_date TEXT;