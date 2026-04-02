import pg from 'pg';

const { Pool } = pg;

// Get DATABASE_URL directly from process.env (Railway sets this)
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is not set!');
  console.error('Please set DATABASE_URL in Railway dashboard');
  process.exit(1);
}

console.log('Connecting to PostgreSQL...');

// PostgreSQL pool with Railway settings
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false  // Required for Railway PostgreSQL
  }
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('ERROR: PostgreSQL connection failed:', err.message);
    return;
  }
  console.log('✓ PostgreSQL connected successfully');
  release();
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

// Convert $namedParams to PostgreSQL $1, $2, etc.
function convertParams(sql, params) {
  const keys = [];
  const values = [];
  let paramIndex = 1;
  
  const newSql = sql.replace(/\$(\w+)/g, (match, key) => {
    keys.push(key);
    return `$${paramIndex++}`;
  });
  
  for (const key of keys) {
    values.push(params[key] ?? null);
  }
  
  return { sql: newSql, values };
}

// Query all rows
export async function all(sql, params = {}) {
  try {
    const { sql: newSql, values } = convertParams(sql, params);
    const result = await pool.query(newSql, values);
    return result.rows;
  } catch (err) {
    console.error('DB all() error:', err.message);
    throw err;
  }
}

// Query single row
export async function get(sql, params = {}) {
  try {
    const { sql: newSql, values } = convertParams(sql, params);
    const result = await pool.query(newSql, values);
    return result.rows[0] || null;
  } catch (err) {
    console.error('DB get() error:', err.message);
    throw err;
  }
}

// Run query (INSERT, UPDATE, DELETE)
export async function run(sql, params = {}) {
  try {
    const { sql: newSql, values } = convertParams(sql, params);
    await pool.query(newSql, values);
  } catch (err) {
    console.error('DB run() error:', err.message);
    throw err;
  }
}

// Run without auto-save (same as run for PostgreSQL)
export async function runNoSave(sql, params = {}) {
  return run(sql, params);
}

// Transaction support
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Export pool for direct access if needed
export { pool };
