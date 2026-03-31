import { getDb } from './pool.js';

export function query(sql, params = {}) {
  const db = getDb();
  const stmt = db.prepare(sql);
  
  if (Object.keys(params).length > 0) {
    stmt.bind(params);
  }
  
  const results = [];
  
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  
  stmt.free();
  return results;
}

export function queryOne(sql, params = {}) {
  const db = getDb();
  const stmt = db.prepare(sql);
  
  if (Object.keys(params).length > 0) {
    stmt.bind(params);
  }
  
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
  
  stmt.free();
  return null;
}

export function exec(sql, params = {}) {
  const db = getDb();
  const stmt = db.prepare(sql);
  
  if (Object.keys(params).length > 0) {
    stmt.bind(params);
  }
  
  stmt.step();
  const result = stmt.getAsObject();
  stmt.free();
  
  return result;
}

export function run(sql, params = {}) {
  const db = getDb();
  const stmt = db.prepare(sql);
  
  if (Object.keys(params).length > 0) {
    stmt.bind(params);
  }
  
  stmt.step();
  stmt.free();
}
