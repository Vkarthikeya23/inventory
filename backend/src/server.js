import app from './app.js';
import { runMigrations, runSeeds } from './db/migrate.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 4000;
const usePostgres = !!process.env.DATABASE_URL;

async function startServer() {
  try {
    if (usePostgres) {
      console.log('Using PostgreSQL database');
      // Test PostgreSQL connection
      const { Pool } = pg;
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      const client = await pool.connect();
      console.log('PostgreSQL connected successfully');
      client.release();
      
      // Note: Migrations and seeds need to be adapted for PostgreSQL
      // For now, we'll skip them and assume Railway handles DB setup
      // You can run migrations manually later
    } else {
      // SQLite setup
      const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/tyreshop.db');
      const dbDir = path.dirname(DB_PATH);
      
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      console.log(`Using SQLite database: ${DB_PATH}`);
      
      // Wait for pool.js to auto-initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      runMigrations();
      runSeeds();
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
