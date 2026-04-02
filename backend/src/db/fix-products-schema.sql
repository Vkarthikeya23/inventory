-- Fix PostgreSQL products table - add missing columns
-- Run this in Railway PostgreSQL console

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add selling_price_incl_gst if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='selling_price_incl_gst') THEN
        ALTER TABLE products ADD COLUMN selling_price_incl_gst DECIMAL(10, 2);
    END IF;

    -- Add price_entry_mode if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='price_entry_mode') THEN
        ALTER TABLE products ADD COLUMN price_entry_mode VARCHAR(10) DEFAULT 'excl';
    END IF;

    -- Add is_deleted if missing (PostgreSQL uses boolean)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='is_deleted') THEN
        ALTER TABLE products ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;
END
$$;

-- Update existing products to have selling_price_incl_gst if null
UPDATE products 
SET selling_price_incl_gst = ROUND(selling_price_excl_gst * (1 + gst_rate/100), 2)
WHERE selling_price_incl_gst IS NULL AND selling_price_excl_gst IS NOT NULL;

-- Verify columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;
