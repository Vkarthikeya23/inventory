import { getDb, saveDatabase } from './pool.js';

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

export function all(sql, params = {}) {
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

export function get(sql, params = {}) {
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

export function run(sql, params = {}) {
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

export function runNoSave(sql, params = {}) {
  const db = getDb();
  const { sql: newSql, values } = extractParams(sql, params);
  const stmt = db.prepare(newSql);
  
  if (values.length > 0) {
    stmt.bind(values);
  }
  
  stmt.step();
  stmt.free();
  // Note: Does NOT call saveDatabase - use inside transactions
}

export function transaction(fn) {
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
        console.log('Rollback failed (may be already rolled back):', rollbackErr.message);
      }
    }
    
    throw err;
  }
}
