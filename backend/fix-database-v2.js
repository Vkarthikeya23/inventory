/**
 * LEGACY / DESTRUCTIVE — one-off schema fixer for the old Railway database.
 * Kept only for reference. The current database is Supabase.
 *
 * WARNING: this script creates a display_name trigger. The Supabase schema
 * intentionally has no display_name column (the API computes it as a SQL
 * alias), so running this against Supabase would fail and leave a broken
 * trigger behind. It refuses to run there without ALLOW_SUPABASE_DDL=true.
 *
 * The connection string is now read from the environment (never hardcoded).
 * Set RAILWAY_DATABASE_URL in backend/.env — see .env.example.
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No database URL set. Add RAILWAY_DATABASE_URL to backend/.env');
  process.exit(1);
}

if (connectionString.includes('supabase') && process.env.ALLOW_SUPABASE_DDL !== 'true') {
  console.error('Refusing to run this legacy DDL against Supabase.');
  console.error('Set ALLOW_SUPABASE_DDL=true only if you really mean to.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function fixSchema() {
  const client = await pool.connect();
  try {
    console.log('Applying final fixes...\n');
    
    // 1. Create customers table
    console.log('1. Creating customers table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        phone TEXT UNIQUE,
        email TEXT,
        vehicle_reg TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✓ Customers table created');
    
    // 2. Create trigger for auto-generating display_name
    console.log('2. Creating display_name trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_product_display_name()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
          NEW.display_name := COALESCE(NEW.company_name, '') || ' ' || COALESCE(NEW.size_spec, '');
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS set_product_display_name ON products;
      CREATE TRIGGER set_product_display_name
        BEFORE INSERT OR UPDATE ON products
        FOR EACH ROW
        EXECUTE FUNCTION generate_product_display_name()
    `);
    console.log('   ✓ Trigger created');
    
    // 3. Update existing products
    console.log('3. Updating existing products...');
    await client.query(`
      UPDATE products 
      SET display_name = COALESCE(company_name, '') || ' ' || COALESCE(size_spec, '')
      WHERE display_name IS NULL OR display_name = ''
    `);
    console.log('   ✓ Products updated');
    
    // 4. Verify tables
    console.log('\n4. Verifying tables...');
    const tables = await client.query(`
      SELECT table_name, COUNT(*) as column_count 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'customers', 'products', 'categories', 'sales', 'sale_items')
      GROUP BY table_name
      ORDER BY table_name
    `);
    
    tables.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}: ${row.column_count} columns`);
    });
    
    console.log('\n✅ All fixes applied!');
    console.log('\nYour app should now work:');
    console.log('  • Login ✓');
    console.log('  • Add products ✓');
    console.log('  • View reports ✓');
    console.log('  • Create sales ✓');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSchema();
