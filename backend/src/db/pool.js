import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/tyreshop.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

export async function initDatabase() {
  console.log('Initializing database...');
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    console.log('Loading existing database from:', dbPath);
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    console.log('Creating new database');
    db = new SQL.Database();
  }
  
  console.log('Database initialized successfully');
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log('Database saved to:', dbPath);
  }
}

// Auto-initialize on module load (for development)
await initDatabase();
