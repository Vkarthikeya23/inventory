import app from './app.js';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const PORT = process.env.PORT || 4000;
const { Pool } = pg;

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Track database connection status
let dbConnected = false;

// Start server immediately (don't block on DB connection)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Test PostgreSQL connection asynchronously
async function connectDatabase() {
  try {
    const client = await pool.connect();
    console.log('✓ PostgreSQL connected successfully');
    client.release();
    dbConnected = true;
  } catch (err) {
    console.error('✗ PostgreSQL connection failed:', err.message);
    console.error('Retrying in 5 seconds...');
    setTimeout(connectDatabase, 5000);
  }
}

// Start connection attempt
connectDatabase();

// Handle pool errors
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
  dbConnected = false;
});

// Export for use in other modules
export { pool, dbConnected };
