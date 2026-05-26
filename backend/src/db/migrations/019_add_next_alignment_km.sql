-- Add next_alignment_km to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS next_alignment_km TEXT;