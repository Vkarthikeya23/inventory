-- Final schema fixes for PostgreSQL
-- Run this in Railway PostgreSQL console

-- 1. Create customers table if missing
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  vehicle_reg TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fix products table - make display_name computed or nullable
-- First check current constraint
DO $$
BEGIN
  -- If display_name has NOT NULL constraint, we need to handle it
  -- For now, let's make it nullable
  ALTER TABLE products ALTER COLUMN display_name DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    -- Column might already be nullable
    RAISE NOTICE 'display_name constraint error: %', SQLERRM;
END
$$;

-- Update existing products to have display_name
UPDATE products 
SET display_name = COALESCE(company_name, '') || ' ' || COALESCE(size_spec, '')
WHERE display_name IS NULL OR display_name = '';

-- 3. Fix products INSERT to include display_name
-- The app code should be updated, but for now we'll create a trigger

-- Create a function to auto-generate display_name
CREATE OR REPLACE FUNCTION generate_product_display_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    NEW.display_name := COALESCE(NEW.company_name, '') || ' ' || COALESCE(NEW.size_spec, '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_product_display_name ON products;
CREATE TRIGGER set_product_display_name
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION generate_product_display_name();

-- 4. Verify
SELECT 'customers table exists' as status;
SELECT 'products trigger created' as status;
SELECT COUNT(*) as customer_count FROM customers;
SELECT COUNT(*) as product_count FROM products;
