# AGENTS.md - TyreShop Pro Coding Guidelines

## Project Overview
TyreShop Pro is a tyre shop inventory management system with three components:
- **Backend**: Node.js + Express + SQLite (ESM modules)
- **Web**: React + Vite portal
- **Mobile**: React Native + Expo app
- **Shared**: Common constants and utilities

## Build & Test Commands

### Backend (`cd backend`)
```bash
npm start              # Production server
npm run dev            # Development with auto-reload
npm test               # Run all Jest tests
npm test -- tests/routes/auth.test.js    # Run single test file
npm test -- --testNamePattern="login"    # Run specific test
npm run migrate        # Run database migrations
npm run seed           # Seed default users
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

### Database (SQLite via sql.js)
- Primary keys: `TEXT` with generated UUIDs
- Currency: `NUMERIC(10,2)`
- Booleans: `INTEGER` (0/1)
- Timestamps: `DATETIME DEFAULT CURRENT_TIMESTAMP`
- Soft deletes: `is_deleted INTEGER DEFAULT 0`

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
- Database file is `backend/src/data/tyreshop.db` (auto-created)
- Invoice URL base: `APP_BASE_URL` env variable
- Mobile requires same WiFi network as backend server
- CORS is enabled for all origins (`*`) in development
- When modifying schema, create migration in `backend/src/db/migrations/`
- Run `npm run migrate` after pulling schema changes
