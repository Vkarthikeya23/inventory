-- Add km_reading to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS km_reading TEXT;