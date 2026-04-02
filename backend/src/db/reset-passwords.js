#!/usr/bin/env node

/**
 * Reset passwords for all default users
 * Usage: node src/db/reset-passwords.js
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

const defaultPassword = 'admin123'; // You can change this

async function resetPasswords() {
  const client = await pool.connect();
  
  try {
    console.log('Resetting user passwords...\n');
    
    // Generate bcrypt hash
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
    console.log('Generated password hash for "admin123"');
    
    // Update all users
    const result = await client.query(`
      UPDATE users 
      SET password_hash = $1 
      WHERE email IN ('owner@tyreshop.com', 'manager@tyreshop.com', 'cashier@tyreshop.com')
      RETURNING email, name
    `, [passwordHash]);
    
    console.log('\n✅ Passwords reset successfully!');
    console.log(`Updated ${result.rowCount} users:`);
    result.rows.forEach(user => {
      console.log(`  - ${user.name} (${user.email})`);
    });
    
    console.log(`\nDefault password for all users: ${defaultPassword}`);
    console.log('\nYou can now login with:');
    console.log('  Email: owner@tyreshop.com');
    console.log('  Password: admin123');
    
  } catch (err) {
    console.error('Error resetting passwords:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

resetPasswords();
