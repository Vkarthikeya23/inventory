# AGENTS.md - TyreShop Pro Coding Guidelines

## Project Overview
TyreShop Pro is a tyre shop inventory management system with three components:
- **Backend**: Node.js + Express + PostgreSQL on Supabase (ESM modules)
- **Web**: React + Vite portal
- **Mobile**: React Native + Expo app
- **Shared**: Common constants and utilities

## Database
The backend database is **Supabase (PostgreSQL)**. There is no SQLite and no
Railway database in the request path.

- Connection: `SUPABASE_DATABASE_URL` (see `backend/.env.example`)
- Resolution order in `backend/src/db/db.js`:
  `SUPABASE_DATABASE_URL` → `DATABASE_URL` → `PGDATABASE_URL`
  `DATABASE_URL` is retained only as a rollback path; Supabase is primary.
- Use the **session pooler on port 5432**, not the transaction pooler (6543),
  because sales run inside `pool.connect()` transactions.
- Reference schema: `backend/src/db/supabase_schema.sql`
- Tables are **server-side only**: `anon`/`authenticated` grants are revoked and
  no RLS policies exist. The browser never talks to the DB — it uses the REST
  API with a JWT.
- Confirm which DB a deployment is using: `GET /health` returns
  `{"status":"ok","db":"supabase|railway|none",...}` (never exposes the URL)
- Schema changes are applied via the Supabase MCP (`supabase_apply_migration`),
  and recorded in `backend/src/db/migrations/`.

## Build & Test Commands

### Backend (`cd backend`)
```bash
npm start              # Production server
npm run dev            # Development with auto-reload
npm test               # Run all Jest tests
npm test -- tests/routes/auth.test.js    # Run single test file
npm test -- --testNamePattern="login"    # Run specific test
```

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
backend/src/
  routes/       # Express route handlers
  middleware/   # Auth, validation middleware
  db/          # Database pool and helpers
  utils/       # Utilities (invoice numbers, etc.)

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
- Database is Supabase; schema reference is `backend/src/db/supabase_schema.sql`
- Invoice URL base: `APP_BASE_URL` env variable
- Mobile requires same WiFi network as backend server
- CORS is enabled for all origins (`*`) in development
- When modifying schema, apply a migration via the Supabase MCP and add the
  matching file to `backend/src/db/migrations/`
- Railway Postgres is a legacy rollback path only — do not add new data paths
  that depend on it. `backend/fix-database*.js` are obsolete Railway DDL
  scripts and should not be run.
