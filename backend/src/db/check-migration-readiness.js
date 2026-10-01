/**
 * Data-quality pre-flight for the Railway -> Supabase migration.
 * READ-ONLY on Railway. Reports anything that would break the copy.
 *
 * Usage: node src/db/check-migration-readiness.js
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  await client.query('SET default_transaction_read_only = on');

  const q = async (label, sql) => {
    const r = await client.query(sql);
    console.log(`\n${label}`);
    console.log('  ', JSON.stringify(r.rows[0]));
  };

  // --- customers: Supabase requires phone NOT NULL + UNIQUE ---
  await q('customers with NULL phone (Supabase requires NOT NULL)', `
    SELECT count(*)::int AS n FROM customers WHERE phone IS NULL OR btrim(phone) = ''
  `);
  await q('duplicate non-null phones (Supabase requires UNIQUE)', `
    SELECT count(*)::int AS n FROM (
      SELECT phone FROM customers WHERE phone IS NOT NULL GROUP BY phone HAVING count(*) > 1
    ) t
  `);

  // --- invoices: Supabase public_token is VARCHAR(12) ---
  await q('invoices public_token length range (Supabase allows max 12)', `
    SELECT min(length(public_token))::int AS min_len,
           max(length(public_token))::int AS max_len,
           count(*) FILTER (WHERE length(public_token) > 12)::int AS too_long
    FROM invoices
  `);
  await q('duplicate public_token (Supabase has UNIQUE index)', `
    SELECT count(*)::int AS n FROM (
      SELECT public_token FROM invoices GROUP BY public_token HAVING count(*) > 1
    ) t
  `);

  // --- users: Supabase has CHECK (role IN owner/manager/cashier) ---
  await q('user roles present (Supabase CHECK allows only 3)', `
    SELECT string_agg(DISTINCT role, ', ') AS roles FROM users
  `);
  await q('users colliding with the Supabase owner seed', `
    SELECT count(*)::int AS n FROM users WHERE email = 'owner@tyreshop.com'
  `);

  // --- referential integrity: orphans would violate Supabase FKs ---
  await q('sale_items with no matching sale (orphan FK)', `
    SELECT count(*)::int AS n FROM sale_items si
    LEFT JOIN sales s ON s.id = si.sale_id WHERE s.id IS NULL
  `);
  await q('sale_items with no matching product (orphan FK)', `
    SELECT count(*)::int AS n FROM sale_items si
    LEFT JOIN products p ON p.id = si.product_id
    WHERE si.product_id IS NOT NULL AND p.id IS NULL
  `);
  await q('sales.customer_id pointing at a missing customer (orphan FK)', `
    SELECT count(*)::int AS n FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.customer_id IS NOT NULL AND c.id IS NULL
  `);
  await q('sales.user_id pointing at a missing user (orphan FK)', `
    SELECT count(*)::int AS n FROM sales s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.user_id IS NOT NULL AND u.id IS NULL
  `);
  await q('purchase_orders.created_by pointing at a missing user (orphan FK)', `
    SELECT count(*)::int AS n FROM purchase_orders p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.created_by IS NOT NULL AND u.id IS NULL
  `);

  // --- products: columns that exist on Railway but not in Supabase ---
  await q('products missing company_name/size_spec (Supabase size_spec NOT NULL)', `
    SELECT count(*) FILTER (WHERE size_spec IS NULL OR btrim(size_spec) = '')::int AS bad_size_spec,
           count(*) FILTER (WHERE company_name IS NULL OR btrim(company_name) = '')::int AS null_company
    FROM products
  `);

  // --- data that only exists on Railway ---
  await q('sale_items.mfg_date populated (no Supabase column - decide keep/drop)', `
    SELECT count(*) FILTER (WHERE mfg_date IS NOT NULL AND btrim(mfg_date) <> '')::int AS with_mfg_date,
           count(*)::int AS total
    FROM sale_items
  `);
  await q('sales.customer_gstin populated (no Supabase column - decide keep/drop)', `
    SELECT count(*) FILTER (WHERE customer_gstin IS NOT NULL AND btrim(customer_gstin) <> '')::int AS with_gstin,
           count(*)::int AS total
    FROM sales
  `);
  await q('sales NOT NULL column safety', `
    SELECT count(*) FILTER (WHERE customer_name IS NULL)::int AS null_customer_name,
           count(*) FILTER (WHERE invoice_number IS NULL)::int AS null_invoice
    FROM sales
  `);
  await q('duplicate invoice_number (Supabase has UNIQUE)', `
    SELECT count(*)::int AS n FROM (
      SELECT invoice_number FROM sales GROUP BY invoice_number HAVING count(*) > 1
    ) t
  `);
  await q('purchase_order numbers present', `
    SELECT count(*)::int AS n, min(po_number) AS first_po, max(po_number) AS last_po FROM purchase_orders
  `);

  await client.end();
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});