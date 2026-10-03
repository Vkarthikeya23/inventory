# AGENTS.md - TyreShop Pro Coding Guidelines

## Project Overview
TyreShop Pro is a tyre shop inventory management system with three components:
- **Backend**: Supabase Edge Function (Deno) at `supabase/functions/api`
- **Web**: React + Vite portal (deployed on Vercel)
- **Mobile**: React Native + Expo app
- **Shared**: Common constants and utilities

## Backend
The backend is a **Supabase Edge Function** — there is no long-running Node
server. It reuses the Express-style route handlers under
`supabase/functions/api/backend/src/routes/`.

- URL: `https://<ref>.supabase.co/functions/v1/api`
- **The incoming `url.pathname` keeps the function slug.** Supabase strips only
  `/functions/v1/`, so a request for `/health` reaches the function as
  `/api/health` — *not* `/functions/v1/api/health`. `index.ts` must strip the
  slug or every route 404s. Note `/api` is also a real route prefix (the Vercel
  invoice proxy calls `/api/invoice/:n`), so it tries the raw path first and
  falls back to the slug-stripped form. A build that only handled the full
  prefix appeared to work, because `/api/invoice/:n` is mounted as a real route
  and was the only thing still resolving.
- **Express does not run on Deno.** `supabase/functions/api/express-lite.ts`
  implements the small subset the routes use (nested mount prefixes, `:params`,
  middleware chains). Adding a new route file means matching that subset.
- `runChain` collects every scheduled promise into a queue. Do not "simplify"
  it back to a single promise variable: `await handler(...)` runs middleware
  synchronously up to its first `await`, so `next()` schedules the rest of the
  chain before the outer promise is assigned and the inner work is dropped.
- `verify_jwt` is **false** on the function. Supabase's gateway would reject the
  app's own JWT (it is not a Supabase JWT). Auth is enforced by
  `verifyToken` using the `JWT_SECRET` secret.
- Required secrets on the function: `JWT_SECRET`, `JWT_EXPIRES_IN`.
  `SUPABASE_DB_URL` is injected by Supabase (internal `db.<ref>` connection).

## Database
The database is **Supabase (PostgreSQL)**. There is no SQLite and no Railway
database in the request path — Railway has been decommissioned.

- Connection: `SUPABASE_DB_URL` (injected by Supabase), with
  `SUPABASE_DATABASE_URL` / `DATABASE_URL` as fallbacks
  (`supabase/functions/api/backend/src/db/db.js`)
- Prefer Supabase's **internal** connection; the public pooler is not needed.
- Reference schema: `backend/src/db/supabase_schema.sql` is gone; the applied
  schema lives in Supabase and is recorded under `backend/src/db/migrations/`
  history. Verify with `supabase_list_tables` / `supabase_execute_sql`.
- Tables are **server-side only**: `anon`/`authenticated` grants are revoked and
  no RLS policies exist. The browser never talks to the DB.
- `GET /health` returns `{"status":"ok","db":"supabase","sales":<n>}`.
- Schema changes go through `supabase_apply_migration`.

## Web
- `VITE_BASE_URL` points at the edge function:
  `https://<ref>.supabase.co/functions/v1/api`
- `VITE_INVOICE_URL` stays on the Vercel domain — invoice links must remain
  reachable on networks (e.g. Jio) where the API host is not.
  `web/api/invoice/[number].js` proxies to `BACKEND_URL || VITE_BASE_URL`.

## Build & Test Commands

### Backend — Supabase Edge Function
There is no Node server to run. Deploy with the bundled script:
```bash
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/deploy-edge-function.mjs
```

**Do not use `npx supabase functions deploy api`** — it uploads assets as
`supabase/functions/api/<path>`, which bundles to a layout that registers only
some route mounts and 404s the rest of the API. The script bundles the function
with esbuild and sends it as a single `body` module, which is the only shape
the Management API actually accepts for this function (a `files` array is
silently ignored; the multipart zip endpoint never extracts the archive).

Token: Supabase -> Account Preferences -> Access Tokens.

### Web (`cd web`)
```bash
npm run dev            # Vite dev server
npm run build          # Production build
npm run preview        # Preview production build
```

### Mobile (`cd mobile`)
```bash
npm start              # Expo start (scan QR with Expo Go)
npm run android        # Start on Android
npm run ios            # Start on iOS
npm run web            # Web version via Expo
```

## Code Style Guidelines

### JavaScript/Node.js (Backend)
- **ESM modules only** (`"type": "module"` in package.json)
- Use `import/export` syntax, never `require/module.exports`
- File extensions required: `import app from './app.js'`
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Async**: Always use `async/await`, never callbacks
- **Error handling**: Wrap in try/catch, log with `console.error()`, return generic 500 messages
- **Database**: Use `$namedParams` for SQL parameter binding

### React (Web & Mobile)
- **Components**: Function components with hooks
- **Imports**: Group React imports first, then third-party, then local
- **Naming**: PascalCase for components, camelCase for hooks/functions
- **Mobile**: Use React Native StyleSheet, never CSS

### Testing (Jest)
- Use ESM syntax: `import request from 'supertest'`
- Tests in `tests/` directory with `.test.js` extension
- Pattern: `describe('Route', () => { test('should...', async () => {}) })`
- Use `beforeAll()` for setup, `afterAll()` for cleanup

## Project Conventions

### File Organization
```
supabase/functions/api/
  index.ts            # Deno.serve entrypoint: fetch<->Express adapter, CORS, routing
  express-lite.ts     # Minimal Express shim (Router, :params, middleware chains)
  globals.ts          # Exposes `process` so modules can read env vars
  dotenv-lite.ts      # No-op: Supabase injects the environment
  deno.json           # Import map (kept for local `deno run`; deploys bundle instead)
  backend/src/
    routes/           # Route handlers
    middleware/       # verifyToken, requireRole
    db/db.js          # PostgreSQL pool + get/all/run/transaction helpers

scripts/
  deploy-edge-function.mjs   # esbuild bundle + Management API deploy (the only supported path)

web/src/
  pages/       # Route components
  components/  # Reusable UI
  context/     # React context providers
  services/    # API client functions

mobile/src/
  screens/     # Screen components
  navigation/  # Navigation config
  components/  # Reusable UI
  services/    # API client
  context/     # Auth context
```

### API Patterns
- Base URL in mobile: `http://192.168.1.100:4000` (adjust for your network)
- Auth: `Authorization: Bearer <token>` header
- Responses: `{ error: string }` or data object
- Status codes: 200, 201, 400, 401, 404, 500

### Database (PostgreSQL on Supabase)
- Connection: `SUPABASE_DATABASE_URL`
- Primary keys: `UUID` with `gen_random_uuid()` defaults
- Currency: `NUMERIC(10,2)` / `NUMERIC(12,2)` for sale totals
- Booleans: real `BOOLEAN` (e.g. `products.is_deleted DEFAULT FALSE`)
- Timestamps: `TIMESTAMPTZ DEFAULT NOW()`
- Soft deletes: `products.is_deleted BOOLEAN` (filtered with `is_deleted = false`)
- `products` has **no** `display_name` column — it is computed as a SQL alias
  (`COALESCE(company_name,'') || ' ' || COALESCE(size_spec,'')`)
- `invoices.invoice_data` is **TEXT** (JSONB caused a `[object Object]` bug)

### Authentication & Roles
- JWT tokens with role-based access
- Roles: `owner`, `manager`, `cashier` (from shared/constants.js)
- Middleware: `verifyToken`, `requireRole(ROLES.OWNER, ROLES.MANAGER)`

### Constants (shared/constants.js)
```javascript
ROLES = { OWNER: 'owner', MANAGER: 'manager', CASHIER: 'cashier' }
GST_RATE = 0.12    // 12%
CGST_RATE = 0.06   // 6%
SGST_RATE = 0.06   // 6%
```

### Error Handling Pattern
```javascript
try {
  // database operation
} catch (err) {
  console.error('Context error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

## Important Notes
- Never commit `.env` files - use `.env.example`
- Database is Supabase; verify the applied schema with the Supabase MCP
- Invoice URL base: `APP_BASE_URL` env variable. **Set it as a function secret**
  (`https://<vercel-domain>`) — without it the backend silently falls back to
  `http://localhost:4000` and every shared invoice link is broken.
- Mobile requires same WiFi network as backend server
- CORS is enabled for all origins (`*`) in development
- When modifying schema, apply a migration with the Supabase MCP
  (`supabase_apply_migration`) and note it in the commit message.
- Railway is decommissioned. `DATABASE_URL` remains in the env resolution
  order only as a rollback path — do not add new data paths that depend on it.
- `web/api/invoice/[number].js` proxies to the backend; it must NOT connect to
  the database directly (Vercel's runtime cannot reach Supabase).
- Function secrets live in Supabase (Edge Functions → Secrets): `JWT_SECRET`,
  `JWT_EXPIRES_IN`. There is no `.env` file in the function runtime.
