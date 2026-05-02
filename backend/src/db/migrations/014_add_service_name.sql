-- Add service_name column to sale_items
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS service_name TEXT;