import pg from 'pg';

const { Pool } = pg;

// Get DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL;

console.log('Initializing PostgreSQL connection...');
console.log('DATABASE_URL exists:', !!databaseUrl);

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is not set!');
  console.error('Please set DATABASE_URL in Railway dashboard');
  process.exit(1);
}

// Parse connection string for debugging (hide password)
try {
  const url = new URL(databaseUrl);
  console.log('Database host:', url.hostname);
  console.log('Database port:', url.port);
  console.log('Database name:', url.pathname?.substring(1));
  console.log('Database user:', url.username);
} catch (e) {
  console.log('Could not parse DATABASE_URL for debugging');
}

// PostgreSQL pool configuration
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000, // 10 second timeout
  idleTimeoutMillis: 30000
});

// Test connection immediately
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✓ PostgreSQL connected successfully');
    const result = await client.query('SELECT NOW()');
    console.log('✓ Database time:', result.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.error('✗ PostgreSQL connection failed:', err.message);
    console.error('Error code:', err.code);
    return false;
  }
}

// Run initial connection test
testConnection();

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
  const { sql: newSql, values } = convertParams(sql, params);
  const result = await pool.query(newSql, values);
  return result.rows;
}

// Query single row
export async function get(sql, params = {}) {
  const { sql: newSql, values } = convertParams(sql, params);
  const result = await pool.query(newSql, values);
  return result.rows[0] || null;
}

// Run query (INSERT, UPDATE, DELETE)
export async function run(sql, params = {}) {
  const { sql: newSql, values } = convertParams(sql, params);
  await pool.query(newSql, values);
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
