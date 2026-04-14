-- Migration to add hsn_code to sale_items table
-- Run this on PostgreSQL database

-- Add hsn_code column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sale_items' 
        AND column_name = 'hsn_code'
    ) THEN
        ALTER TABLE sale_items ADD COLUMN hsn_code TEXT;
        RAISE NOTICE 'Added hsn_code column to sale_items';
    ELSE
        RAISE NOTICE 'hsn_code column already exists in sale_items';
    END IF;
END $$;

SELECT 'sale_items hsn_code migration complete' as status;