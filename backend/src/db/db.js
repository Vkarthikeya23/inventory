import dotenv from 'dotenv';
dotenv.config();

import { getDb, saveDatabase } from './pool.js';
import pg from 'pg';

const { Pool } = pg;

// Check if we should use PostgreSQL
const usePostgres = !!process.env.DATABASE_URL;

if (usePostgres) {
  console.log('[DB] Using PostgreSQL');
} else {
  console.log('[DB] Using SQLite');
}
let pgPool = null;

// Initialize PostgreSQL pool if needed
if (usePostgres) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('Using PostgreSQL database');
} else {
  console.log('Using SQLite database');
}

// Convert $namedParams to positional params for PostgreSQL
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

// SQLite helpers
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

// PostgreSQL implementations
async function pgAll(sql, params = {}) {
  const { sql: newSql, values } = convertToPostgresParams(sql, params);
  const result = await pgPool.query(newSql, values);
  return result.rows;
}

async function pgGet(sql, params = {}) {
  const { sql: newSql, values } = convertToPostgresParams(sql, params);
  const result = await pgPool.query(newSql, values);
  return result.rows[0] || null;
}

async function pgRun(sql, params = {}) {
  const { sql: newSql, values } = convertToPostgresParams(sql, params);
  await pgPool.query(newSql, values);
}

async function pgRunNoSave(sql, params = {}) {
  // PostgreSQL doesn't need explicit save
  return pgRun(sql, params);
}

async function pgTransaction(fn) {
  const client = await pgPool.connect();
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

// SQLite implementations
function sqliteAll(sql, params = {}) {
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

function sqliteRunNoSave(sql, params = {}) {
  const db = getDb();
  const { sql: newSql, values } = extractParams(sql, params);
  const stmt = db.prepare(newSql);
  
  if (values.length > 0) {
    stmt.bind(values);
  }
  
  stmt.step();
  stmt.free();
}

function sqliteTransaction(fn) {
  const db = getDb();
  let inTransaction = false;
  
  try {
    db.exec('BEGIN TRANSACTION');
    inTransaction = true;
    console.log('Transaction started');
    
    const result = fn();
    
    if (inTransaction) {
      db.exec('COMMIT');
      console.log('Transaction committed');
    }
    saveDatabase();
    return result;
    
  } catch (err) {
    console.error('Transaction error:', err.message);
    
    if (inTransaction) {
      try { 
        db.exec('ROLLBACK'); 
        console.log('Transaction rolled back');
      } catch (rollbackErr) {
        console.log('Rollback failed:', rollbackErr.message);
      }
    }
    
    throw err;
  }
}

// Export unified API that chooses the right implementation
export function all(sql, params = {}) {
  if (usePostgres) {
    return pgAll(sql, params);
  }
  return sqliteAll(sql, params);
}

export function get(sql, params = {}) {
  if (usePostgres) {
    return pgGet(sql, params);
  }
  return sqliteGet(sql, params);
}

export function run(sql, params = {}) {
  if (usePostgres) {
    return pgRun(sql, params);
  }
  return sqliteRun(sql, params);
}

export function runNoSave(sql, params = {}) {
  if (usePostgres) {
    return pgRunNoSave(sql, params);
  }
  return sqliteRunNoSave(sql, params);
}

export function transaction(fn) {
  if (usePostgres) {
    return pgTransaction(fn);
  }
  return sqliteTransaction(fn);
}

// Export pool for direct access if needed
export { pgPool };
