import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:wWUjsIHXzLzxOdXODAZgDFzdDMjQfFzF@interchange.proxy.rlwy.net:15389/railway',
  ssl: { rejectUnauthorized: false }
});

async function fixSchema() {
  const client = await pool.connect();
  try {
    console.log('Adding missing columns...');
    
    // Add products columns
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS selling_price_incl_gst DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS price_entry_mode VARCHAR(10) DEFAULT 'excl',
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
    `);
    console.log('✓ Products columns added');
    
    // Update existing products
    await client.query(`
      UPDATE products 
      SET selling_price_incl_gst = ROUND(selling_price_excl_gst * (1 + gst_rate/100), 2),
          price_entry_mode = 'excl',
          is_deleted = false
      WHERE selling_price_incl_gst IS NULL;
    `);
    console.log('✓ Products updated');
    
    // Add sales columns
    await client.query(`
      ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS cgst DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS sgst DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS received_amount DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS balance DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS customer_id UUID,
      ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
    console.log('✓ Sales columns added');
    
    // Update sales data
    await client.query(`
      UPDATE sales 
      SET cgst = COALESCE(cgst_amount, 0),
          sgst = COALESCE(sgst_amount, 0),
          total = COALESCE(total_amount, 0),
          received_amount = COALESCE(received_amount, total_amount, 0),
          balance = COALESCE(balance_amount, 0)
      WHERE cgst IS NULL;
    `);
    console.log('✓ Sales data updated');
    
    // Add sale_items column
    await client.query(`
      ALTER TABLE sale_items
      ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2);
    `);
    
    // Update sale_items data
    await client.query(`
      UPDATE sale_items
      SET amount = COALESCE(total_amount, subtotal + gst_amount, 0)
      WHERE amount IS NULL;
    `);
    console.log('✓ Sale items columns added');
    
    console.log('\n✅ Database schema fixed!');
    console.log('\nYou can now:');
    console.log('  1. Add products');
    console.log('  2. View reports');
    console.log('  3. Create sales');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSchema();
