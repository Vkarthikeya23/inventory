/**
 * Node globals the backend modules expect. Imported FIRST from index.ts so
 * that process.env is available before any route module is evaluated.
 *
 * Supabase injects configuration through the environment, so dotenv.config()
 * is a no-op here (there is no .env file in the function runtime).
 */
import process from 'node:process';

if (!(globalThis as any).process) {
  (globalThis as any).process = process;
}

export {};
