# TyreShop Pro - Inventory Management System

A complete tyre shop POS + inventory management system for 5–20 users (India-based).

## Project Structure

```
inventory/
├── backend/          # Node.js + Express REST API
│   ├── src/
│   │   ├── db/       # SQLite database setup
│   │   ├── middleware/
│   │   ├── routes/   # API route handlers
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/        # Jest + Supertest tests
│   └── package.json
├── mobile/           # React Native + Expo app
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── navigation/
│   │   ├── services/
│   │   └── context/
│   ├── App.js
│   └── package.json
├── web/              # React + Vite web portal
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   └── context/
│   ├── index.html
│   └── package.json
├── shared/           # Shared constants
│   ├── constants.js
│   └── package.json
├── .env.example      # Environment variables reference
└── README.md
```

## Prerequisites

- Node.js 20+

## Setup Steps

### 1. Clone and Install Dependencies

```bash
# Backend
cd backend
npm install

# Mobile
cd ../mobile
npm install

# Web
cd ../web
npm install

# Shared
cd ../shared
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` in the backend folder and update values:

```bash
cp .env.example backend/.env
```

### 3. Initialize Database

The SQLite database is created automatically on first run. The `data/` folder will be created in the backend directory.

### 4. Start Services

```bash
# Terminal 1: Backend API
cd backend
npm start

# Terminal 2: Web Portal
cd web
npm run dev

# Terminal 3: Mobile App
cd mobile
npm start
```

## Running Tests

```bash
cd backend
npm test
```

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Node.js 20, Express 4, SQLite     |
| Auth     | JWT (jsonwebtoken), bcrypt        |
| Validation | express-validator               |
| Mobile   | React Native 0.74, Expo SDK 51    |
| Mobile Chart | react-native-chart-kit        |
| Web      | React 18, Vite 5, React Router 6  |
| Web Chart | Recharts                         |
| Testing  | Jest, Supertest                   |

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `DATABASE_PATH` | Path to SQLite database file |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | Token expiry (e.g., `7d`) |
| `PORT` | Backend server port |
| `NODE_ENV` | Environment (`development`/`production`) |
| `APP_BASE_URL` | Public base URL of this server (used to generate invoice links) |
| `SHOP_NAME` | Shop name for invoices |
| `SHOP_ADDRESS` | Shop address for invoices |
| `SHOP_GSTIN` | Shop GSTIN for invoices |
| `TEST_DATABASE_PATH` | Test database path |

## Invoice Links

Invoices are stored as JSON snapshots in SQLite and served as public HTML pages at `GET /invoice/:invoice_number`. The invoice data includes:

- Shop details (name, address, GSTIN)
- Customer information
- Line items with product details
- GST breakdown (CGST 14%, SGST 14%)
- Grand total

Staff share invoice links via the WhatsApp deep link button in the mobile app — no API keys required. Customers can view the invoice in their browser and use the built-in "Download PDF" button to save a copy using their browser's native print-to-PDF functionality.

## Role Permissions

| Action                    | Owner | Manager | Cashier |
|---------------------------|-------|---------|---------|
| Login                     | ✓     | ✓       | ✓       |
| Add a sale                | ✓     | ✓       | ✓       |
| View inventory            | ✓     | ✓       | ✓       |
| Add/edit products         | ✓     | ✓       | ✗       |
| Hide product (soft delete)| ✓     | ✗       | ✗       |
| Add categories            | ✓     | ✓       | ✗       |
| Delete categories         | ✗     | ✗       | ✗       |
| View/create purchase orders| ✓    | ✓       | ✗       |
| Receive stock             | ✓     | ✓       | ✗       |
| View sales history        | ✓     | ✓       | ✗       |
| View reports              | ✓     | ✓       | ✗       |
| Resend invoice            | ✓     | ✓       | ✗       |
| Manage users              | ✓     | ✗       | ✗       |

## API Endpoints

### Auth
- `POST /auth/login` - Login with email/password
- `GET /auth/me` - Get current user (protected)

### Categories
- `GET /categories` - List all categories
- `POST /categories` - Create category (owner/manager only)

### Products
- `GET /products` - List products (supports `?search=`, `?category_id=`, `?low_stock=true`)
- `POST /products` - Create product (owner/manager only)
- `PUT /products/:id` - Update product (owner/manager only)

### Suppliers
- `GET /suppliers` - List suppliers (owner/manager only)
- `POST /suppliers` - Create supplier (owner/manager only)

### Purchase Orders
- `GET /purchase-orders` - List POs (owner/manager only)
- `GET /purchase-orders/:id` - Get PO details (owner/manager only)
- `POST /purchase-orders` - Create PO (owner/manager only)
- `PUT /purchase-orders/:id/receive` - Mark as received (owner/manager only)

### Sales
- `POST /sales` - Create sale (all authenticated roles)
- `GET /sales` - List sales (owner/manager only)
- `GET /sales/:id` - Get sale details (owner/manager only)

### Reports
- `GET /reports/daily` - Daily report (owner/manager only)
- `GET /reports/weekly` - Weekly report (owner/manager only)

### Invoices
- `POST /invoices/:sale_id/send` - Get invoice URL (owner/manager only)

## Known TODOs (Require Real Configuration)

1. **Shop Details** - Update `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_GSTIN` in `.env`
2. **Production Password Hashes** - Replace default bcrypt hashes in seed file

## Invoice Number Format

Invoices are generated as `TYR-YYMM-XXXXX` where:
- `YY` = last 2 digits of year
- `MM` = month (01-12)
- `XXXXX` = sequential number for that month (00001, 00002, etc.)

## GST Configuration

- CGST: 14%
- SGST: 14%
- Total GST: 28%
- HSN Code for Tyres: 4011
- HSN Code for Tubes: 4013

## Default Users (After Seed)

| Email | Password | Role |
|-------|----------|------|
| owner@tyreshop.com | password | owner |
| manager@tyreshop.com | password | manager |
| cashier@tyreshop.com | password | cashier |

**Change these passwords before production!**
