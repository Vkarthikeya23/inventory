import pg from 'pg';

const { Pool } = pg;

// Get DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL || process.env.PGDATABASE_URL;

console.log('Initializing PostgreSQL connection...');

let pool = null;

if (!databaseUrl) {
  console.error('WARNING: DATABASE_URL environment variable is not set!');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('DB') || k.includes('POSTGRES') || k.includes('DATABASE')));
} else {
  console.log('DATABASE_URL found, connecting...');
  
  // PostgreSQL pool configuration
  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000
    });

    // Test connection
    pool.connect((err, client, release) => {
      if (err) {
        console.error('ERROR: PostgreSQL connection failed:', err.message);
        console.error('Error code:', err.code);
      } else {
        console.log('✓ PostgreSQL connected successfully');
        client.query('SELECT NOW()', (err, result) => {
          if (!err) {
            console.log('✓ Database time:', result.rows[0].now);
          }
          release();
        });
      }
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err.message);
    });
  } catch (err) {
    console.error('ERROR creating PostgreSQL pool:', err.message);
    pool = null;
  }
}

// Fallback functions if pool is not available
async function ensurePool() {
  if (!pool) {
    throw new Error('DATABASE_URL not configured or database connection failed');
  }
  return pool;
}

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
  const dbPool = await ensurePool();
  const { sql: newSql, values } = convertParams(sql, params);
  const result = await dbPool.query(newSql, values);
  return result.rows;
}

// Query single row
export async function get(sql, params = {}) {
  const dbPool = await ensurePool();
  const { sql: newSql, values } = convertParams(sql, params);
  const result = await dbPool.query(newSql, values);
  return result.rows[0] || null;
}

// Run query (INSERT, UPDATE, DELETE)
export async function run(sql, params = {}) {
  const dbPool = await ensurePool();
  const { sql: newSql, values } = convertParams(sql, params);
  await dbPool.query(newSql, values);
}

// Run without auto-save (same as run for PostgreSQL)
export async function runNoSave(sql, params = {}) {
  return run(sql, params);
}

// Transaction support
export async function transaction(fn) {
  const dbPool = await ensurePool();
  const client = await dbPool.connect();
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
