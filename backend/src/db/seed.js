import pool from './pool.js';
import { runMigrations, runSeeds } from './migrate.js';

async function main() {
  console.log('Starting database setup...');
  await runMigrations();
  await runSeeds();
  console.log('Database setup complete');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
