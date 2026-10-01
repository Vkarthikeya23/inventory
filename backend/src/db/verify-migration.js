/**
 * Verifies the Railway -> Supabase copy by comparing aggregates across both
 * databases. READ-ONLY on Railway.
 *
 * Usage: node src/db/verify-migration.js
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

pg.types.setTypeParser(1114, v => v);
pg.types.setTypeParser(1184, v => v);

const { Client } = pg;

const CHECKS = [
  {
    label: 'sales: row count',
    sql: 'SELECT count(*)::int AS v FROM sales'
  },
  {
    label: 'sales: SUM(total_amount)',
    sql: 'SELECT COALESCE(SUM(total_amount),0)::numeric(14,2) AS v FROM sales'
  },
  {
    label: 'sales: SUM(received_amount)',
    sql: 'SELECT COALESCE(SUM(received_amount),0)::numeric(14,2) AS v FROM sales'
  },
  {
    label: 'sales: distinct invoice_number',
    sql: 'SELECT count(DISTINCT invoice_number)::int AS v FROM sales'
  },
  {
    label: 'sales: MIN(sale_date)',
    sql: 'SELECT MIN(sale_date)::text AS v FROM sales'
  },
  {
    label: 'sales: MAX(sale_date)',
    sql: 'SELECT MAX(sale_date)::text AS v FROM sales'
  },
  {
    label: 'sales: SUM(notes non-null)',
    sql: 'SELECT count(*) FILTER (WHERE notes IS NOT NULL)::int AS v FROM sales'
  },
  {
    label: 'sale_items: row count',
    sql: 'SELECT count(*)::int AS v FROM sale_items'
  },
  {
    label: 'sale_items: SUM(qty)',
    sql: 'SELECT COALESCE(SUM(qty),0)::int AS v FROM sale_items'
  },
  {
    label: 'sale_items: SUM(total_amount)',
    sql: 'SELECT COALESCE(SUM(total_amount),0)::numeric(14,2) AS v FROM sale_items'
  },
  {
    label: 'invoices: row count',
    sql: 'SELECT count(*)::int AS v FROM invoices'
  },
  {
    label: 'invoices: SUM(length(invoice_data))',
    sql: 'SELECT COALESCE(SUM(length(invoice_data)),0)::bigint AS v FROM invoices'
  },
  {
    label: 'products: row count',
    sql: 'SELECT count(*)::int AS v FROM products'
  },
  {
    label: 'products: SUM(stock_qty)',
    sql: 'SELECT COALESCE(SUM(stock_qty),0)::int AS v FROM products'
  },
  {
    label: 'products: SUM(cost_price)',
    sql: 'SELECT COALESCE(SUM(cost_price),0)::numeric(14,2) AS v FROM products'
  },
  {
    label: 'customers: row count',
    sql: 'SELECT count(*)::int AS v FROM customers'
  },
  {
    label: 'services: row count',
    sql: 'SELECT count(*)::int AS v FROM services'
  },
  {
    label: 'purchase_orders: row count',
    sql: 'SELECT count(*)::int AS v FROM purchase_orders'
  }
];

async function main() {
  const src = new Client({
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const dst = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await src.connect();
  await src.query('SET default_transaction_read_only = on');
  await dst.connect();
  await dst.query("SET TimeZone TO 'UTC'");

  let mismatches = 0;
  console.log(`${'check'.padEnd(34)} ${'railway'.padEnd(22)} ${'supabase'.padEnd(22)} result`);
  console.log('-'.repeat(92));

  for (const { label, sql } of CHECKS) {
    const a = (await src.query(sql)).rows[0].v;
    const b = (await dst.query(sql)).rows[0].v;
    const match = String(a) === String(b);
    if (!match) mismatches++;
    console.log(
      `${label.padEnd(34)} ${String(a).padEnd(22)} ${String(b).padEnd(22)} ${match ? 'OK' : 'MISMATCH'}`
    );
  }

  console.log('-'.repeat(92));
  console.log(mismatches === 0
    ? 'All checks passed - Supabase is a faithful copy of Railway.'
    : `${mismatches} MISMATCH(ES) found.`);

  await src.end();
  await dst.end();
  process.exit(mismatches === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});