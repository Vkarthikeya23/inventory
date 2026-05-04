-- Add vehicle_type to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS vehicle_type TEXT;