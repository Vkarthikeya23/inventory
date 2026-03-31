import app from './app.js';
import { runMigrations, runSeeds } from './db/migrate.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 4000;
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/tyreshop.db');

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Wait for pool.js to auto-initialize (happens at module load time)
setTimeout(() => {
  try {
    runMigrations();
    runSeeds();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Database: ${DB_PATH}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}, 2000);
