-- Add next_service_km to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS next_service_km TEXT;