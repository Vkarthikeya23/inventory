import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { getDb } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/tyreshop.db');

export function runMigrations() {
  const db = getDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('Running schema...');
  db.run(sql);
  console.log('✓ Schema completed');
}

export function runSeeds() {
  const db = getDb();
  const result = db.exec('SELECT COUNT(*) as count FROM users');
  const tables = result[0]?.values?.[0]?.[0] ?? 0;
  
  if (tables > 0) {
    console.log('Database already seeded');
    return;
  }
  
  console.log('Seeding database...');
  
  const passwordHash = bcrypt.hashSync('password', 10);
  
  db.run(`
    INSERT INTO users (name, email, password_hash, role) VALUES
    ('Shop Owner', 'owner@tyreshop.com', '${passwordHash}', 'owner'),
    ('Manager One', 'manager@tyreshop.com', '${passwordHash}', 'manager'),
    ('Cashier One', 'cashier@tyreshop.com', '${passwordHash}', 'cashier')
  `);
  
  console.log('✓ Seed data inserted');
}
