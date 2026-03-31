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

async function startServer() {
  try {
    // Test PostgreSQL connection
    const client = await pool.connect();
    console.log('✓ PostgreSQL connected successfully');
    client.release();
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (err) {
    console.error('✗ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

// Export pool for use in other modules
export { pool };
