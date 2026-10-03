/**
 * dotenv shim. Supabase supplies configuration through the runtime
 * environment, so config() is intentionally a no-op.
 */
export default {
  config: () => ({ parsed: {} }),
};
