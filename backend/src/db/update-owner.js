#!/usr/bin/env node

/**
 * Update owner user: change email to 'jagan' and password to 'jagangoud123'
 * Usage: node src/db/update-owner.js
 */

import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL not set!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function updateOwner() {
  const client = await pool.connect();
  
  try {
    console.log('Updating owner user...\n');
    
    // Generate bcrypt hash for new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('jagangoud123', saltRounds);
    console.log('Generated password hash for "jagangoud123"');
    
    // Update owner user
    const result = await client.query(`
      UPDATE users 
      SET email = 'jagan', password_hash = $1 
      WHERE role = 'owner'
      RETURNING name, email, role
    `, [passwordHash]);
    
    if (result.rowCount === 0) {
      console.log('No owner user found!');
      process.exit(1);
    }
    
    console.log('\n✅ Owner updated successfully!');
    console.log(`  Name: ${result.rows[0].name}`);
    console.log(`  Email: ${result.rows[0].email}`);
    console.log(`  Role: ${result.rows[0].role}`);
    console.log(`\nNew login credentials:`);
    console.log(`  Email: jagan`);
    console.log(`  Password: jagangoud123`);
    
  } catch (err) {
    console.error('Error updating owner:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

updateOwner();