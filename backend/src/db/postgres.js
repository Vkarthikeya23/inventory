import pg from 'pg';
const { Pool } = pg;

// Check if DATABASE_URL is set (PostgreSQL) or use SQLite
const isPostgres = !!process.env.DATABASE_URL;

let pool = null;
let sqliteDb = null;

// Initialize the appropriate database
export async function initDb() {
  if (isPostgres) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Test connection
    const client = await pool.connect();
    console.log('PostgreSQL connected');
    client.release();
  } else {
    // Use SQLite (existing pool.js will handle this)
    const { initDb: initSqlite } = await import('./pool.js');
    sqliteDb = await initDb();
  }
}

export function getDb() {
  if (isPostgres) {
    return pool;
  }
  // Return SQLite db from existing pool
  const { getDb: getSqliteDb } = require('./pool.js');
  return getSqliteDb();
}

// Convert $namedParams to PostgreSQL $1, $2, etc.
function convertToPostgresParams(sql, params) {
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

// PostgreSQL query helpers
async function pgAll(sql, params = {}) {
  const { sql: newSql, values } = convertToPostgresParams(sql, params);
  const result = await pool.query(newSql, values);
  return result.rows;
}

async function pgGet(sql, params = {}) {
  const { sql: newSql, values } = convertToPostgresParams(sql, params);
  const result = await pool.query(newSql, values);
  return result.rows[0] || null;
}

async function pgRun(sql, params = {}) {
  const { sql: newSql, values } = convertToPostgresParams(sql, params);
  await pool.query(newSql, values);
}

// SQLite helpers (existing implementation)
function extractParams(sql, params) {
  const keys = [];
  const values = [];
  const newSql = sql.replace(/\$(\w+)/g, (match, key) => {
    keys.push(key);
    return '?';
  });
  
  for (const key of keys) {
    values.push(params[key] ?? null);
  }
  
  return { sql: newSql, values };
}

function sqliteAll(sql, params = {}) {
  const { getDb } = require('./pool.js');
  const db = getDb();
  const { sql: newSql, values } = extractParams(sql, params);
  const stmt = db.prepare(newSql);
  
  if (values.length > 0) {
    stmt.bind(values);
  }
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function sqliteGet(sql, params = {}) {
  const { getDb } = require('./pool.js');
  const db = getDb();
  const { sql: newSql, values } = extractParams(sql, params);
  const stmt = db.prepare(newSql);
  
  if (values.length > 0) {
    stmt.bind(values);
  }
  
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
  stmt.free();
  return null;
}

function sqliteRun(sql, params = {}) {
  const { getDb, saveDatabase } = require('./pool.js');
  const db = getDb();
  const { sql: newSql, values } = extractParams(sql, params);
  const stmt = db.prepare(newSql);
  
  if (values.length > 0) {
    stmt.bind(values);
  }
  
  stmt.step();
  stmt.free();
  saveDatabase();
}

// Export unified API
export function all(sql, params = {}) {
  if (isPostgres) {
    return pgAll(sql, params);
  }
  return sqliteAll(sql, params);
}

export function get(sql, params = {}) {
  if (isPostgres) {
    return pgGet(sql, params);
  }
  return sqliteGet(sql, params);
}

export function run(sql, params = {}) {
  if (isPostgres) {
    return pgRun(sql, params);
  }
  return sqliteRun(sql, params);
}

// For transactions - simplified version
export async function transaction(fn) {
  if (isPostgres) {
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
  } else {
    // SQLite transaction
    const { getDb, saveDatabase } = require('./pool.js');
    const db = getDb();
    let inTransaction = false;
    
    try {
      db.exec('BEGIN TRANSACTION');
      inTransaction = true;
      const result = fn();
      if (inTransaction) {
        db.exec('COMMIT');
      }
      saveDatabase();
      return result;
    } catch (err) {
      if (inTransaction) {
        try { db.exec('ROLLBACK'); } catch (e) {}
      }
      throw err;
    }
  }
}

export { isPostgres, pool };
