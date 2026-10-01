/**
 * Read-only inspection of the LEGACY Railway database.
 * Used to compare the live schema against the Supabase schema before migrating.
 *
 * Every connection is forced into default_transaction_read_only, so this script
 * physically cannot write to Railway.
 *
 * Usage: node src/db/inspect-railway.js
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function main() {
  const url = process.env.RAILWAY_DATABASE_URL;
  if (!url) {
    console.error('RAILWAY_DATABASE_URL is not set in backend/.env');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Hard read-only guard: any write on this session is rejected by Postgres.
  await client.query('SET default_transaction_read_only = on');

  const ver = await client.query('SELECT version()');
  console.log('--- SOURCE (Railway) ---');
  console.log(ver.rows[0].version.split(',')[0]);

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const names = tables.rows.map(r => r.table_name);
  console.log(`tables: ${names.length}\n`);

  for (const t of names) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [t]);

    const count = await client.query(`SELECT count(*)::int AS n FROM "${t}"`);
    console.log(`== ${t}  (${count.rows[0].n} rows)`);
    for (const c of cols.rows) {
      const def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
      console.log(`     ${c.column_name.padEnd(24)} ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${def}`);
    }
    console.log('');
  }

  await client.end();
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});