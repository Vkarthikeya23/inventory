# TyreShop Pro - Complete Rewrite Specification

## 1. Project Overview

**Project Name:** TyreShop Pro  
**Project Type:** Full-stack inventory management system for tyre shops  
**Core Functionality:** Manage tyre inventory, process sales with GST tax calculations, generate invoices, track suppliers and purchase orders, and view sales reports  
**Target Users:** Tyre shop owners, managers, and cashiers

---

## 2. Technology Stack

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js 5.x (with async error handling middleware)
- **Language:** TypeScript 5.x
- **ORM/Query Builder:** Prisma 6.x with PostgreSQL 16
- **Validation:** Zod 3.x
- **Authentication:** JWT (jsonwebtoken) + bcrypt
- **Testing:** Jest + Supertest

### Web Frontend
- **Framework:** React 19 with Vite 6
- **Language:** TypeScript 5.x
- **Routing:** React Router DOM 7
- **State Management:** Zustand (global) + TanStack Query (server state)
- **UI Library:** shadcn/ui + Tailwind CSS
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts 2.x
- **HTTP Client:** Axios 1.x

### Mobile Frontend
- **Framework:** React Native 0.76 + Expo SDK 52
- **Language:** TypeScript 5.x
- **Navigation:** React Navigation 7
- **State Management:** Zustand + TanStack Query
- **Forms:** React Hook Form + Zod
- **HTTP Client:** Axios 1.x
- **Charts:** react-native-gifted-charts

### Shared
- **Monorepo Tool:** Turborepo 2.x
- **Shared Package:** `@tyreshop/shared` (Zod schemas, TypeScript types, constants)

---

## 3. Architecture Overview

```
tyreshop-pro/
├── apps/
│   ├── api/                    # Express API (Port 4000)
│   ├── web/                    # Vite React app
│   └── mobile/                 # Expo React Native app
├── packages/
│   └── shared/                 # Shared types, schemas, constants
├── turbo.json
└── package.json
```

---

## 4. Database Schema (PostgreSQL)

### 4.1 Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Categories Table
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Products Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  company_name VARCHAR(100) NOT NULL,
  size_spec VARCHAR(50) NOT NULL,
  hsn_code VARCHAR(20),
  cost_price DECIMAL(10,2) NOT NULL,
  selling_price_excl_gst DECIMAL(10,2) NOT NULL,
  selling_price_incl_gst DECIMAL(10,2) NOT NULL,
  gst_rate DECIMAL(5,2) DEFAULT 12.00,
  price_entry_mode VARCHAR(10) DEFAULT 'excl' CHECK (price_entry_mode IN ('excl', 'incl')),
  stock_qty INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_company ON products(company_name);
CREATE INDEX idx_products_size ON products(size_spec);
```

### 4.4 Suppliers Table
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(15),
  email VARCHAR(150),
  gstin VARCHAR(20),
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.5 Customers Table
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15),
  email VARCHAR(150),
  vehicle_make VARCHAR(50),
  vehicle_model VARCHAR(50),
  vehicle_reg VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_vehicle_reg ON customers(vehicle_reg);
```

### 4.6 Sales Table
```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  invoice_number VARCHAR(30) UNIQUE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  cgst DECIMAL(10,2) NOT NULL,
  sgst DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  received_amount DECIMAL(10,2) NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0,
  payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'card', 'mixed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_invoice ON sales(invoice_number);
CREATE INDEX idx_sales_date ON sales(created_at);
```

### 4.7 Sale Items Table
```sql
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name VARCHAR(150) NOT NULL,
  size_spec VARCHAR(50) NOT NULL,
  qty INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  gst_rate DECIMAL(5,2) NOT NULL,
  gst_amount DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
```

### 4.8 Invoices Table
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID UNIQUE NOT NULL REFERENCES sales(id),
  public_token VARCHAR(12) UNIQUE NOT NULL,
  invoice_data JSONB NOT NULL,
  sent_via_email BOOLEAN DEFAULT false,
  sent_via_whatsapp BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.9 Purchase Orders Table
```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.10 Purchase Order Items Table
```sql
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  qty_ordered INTEGER NOT NULL,
  qty_received INTEGER DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL
);
```

### 4.11 Settings Table (Key-Value Store)
```sql
CREATE TABLE settings (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API Endpoints

### 5.1 Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login with email/password |
| POST | `/api/auth/logout` | Yes | Invalidate token |
| GET | `/api/auth/me` | Yes | Get current user |

### 5.2 Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | Yes | List products (paginated, filterable) |
| GET | `/api/products/:id` | Yes | Get single product |
| POST | `/api/products` | Manager+ | Create product |
| PUT | `/api/products/:id` | Manager+ | Update product |
| DELETE | `/api/products/:id` | Manager+ | Soft delete product |
| GET | `/api/products/low-stock` | Manager+ | Get low stock alerts |

### 5.3 Categories
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | Yes | List categories |
| POST | `/api/categories` | Manager+ | Create category |
| PUT | `/api/categories/:id` | Manager+ | Update category |
| DELETE | `/api/categories/:id` | Owner | Delete category |

### 5.4 Suppliers
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/suppliers` | Manager+ | List suppliers |
| POST | `/api/suppliers` | Manager+ | Create supplier |
| PUT | `/api/suppliers/:id` | Manager+ | Update supplier |
| DELETE | `/api/suppliers/:id` | Owner | Soft delete supplier |

### 5.5 Customers
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/customers` | Yes | List customers (paginated, searchable) |
| GET | `/api/customers/:id` | Yes | Get customer details |
| POST | `/api/customers` | Yes | Create customer |
| PUT | `/api/customers/:id` | Yes | Update customer |

### 5.6 Sales
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/sales` | Yes | Create sale (transactional) |
| GET | `/api/sales` | Manager+ | List sales (paginated, filterable by date) |
| GET | `/api/sales/:id` | Yes | Get sale with items |
| GET | `/api/sales/invoice/:invoiceNumber` | Yes | Get invoice by number |

### 5.7 Reports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reports/daily` | Manager+ | Daily sales report |
| GET | `/api/reports/weekly` | Manager+ | Weekly sales report |
| GET | `/api/reports/monthly` | Manager+ | Monthly sales report |
| GET | `/api/reports/overview` | Manager+ | Dashboard stats |

### 5.8 Purchase Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/purchase-orders` | Manager+ | List purchase orders |
| GET | `/api/purchase-orders/:id` | Manager+ | Get PO details |
| POST | `/api/purchase-orders` | Manager+ | Create PO |
| PUT | `/api/purchase-orders/:id` | Manager+ | Update PO |
| POST | `/api/purchase-orders/:id/order` | Manager+ | Mark as ordered |
| POST | `/api/purchase-orders/:id/receive` | Manager+ | Mark as received, update stock |
| DELETE | `/api/purchase-orders/:id` | Owner | Delete PO |

### 5.9 Invoices
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/invoices/:saleId/public` | No | Get public invoice token |
| GET | `/api/invoices/:publicToken` | No | Public invoice HTML |

### 5.10 Settings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/settings` | Owner | Get all settings |
| PUT | `/api/settings/:key` | Owner | Update setting |

---

## 6. Web Frontend Pages

### 6.1 Public Pages
- **Login** (`/login`) - Email/password login form

### 6.2 Protected Pages (All Authenticated)
- **Dashboard** (`/`) - Stats cards, charts, recent sales, low stock alerts

### 6.3 Manager/Owner Only
- **Inventory** (`/inventory`) - Product list with search, filter, CRUD
- **Add Product** (`/products/new`) - Product creation form
- **Edit Product** (`/products/:id/edit`) - Product edit form
- **Categories** (`/categories`) - Category management
- **Suppliers** (`/suppliers`) - Supplier management
- **Purchase Orders** (`/purchase-orders`) - PO list and creation
- **Purchase Order Detail** (`/purchase-orders/:id`) - PO details
- **Reports** (`/reports`) - Daily/weekly/monthly reports
- **Users** (`/users`) - User management (Owner only)
- **Settings** (`/settings`) - Shop settings (Owner only)

### 6.4 All Roles
- **New Sale** (`/pos`) - Point of sale interface
- **Sale History** (`/sales`) - View past sales
- **Sale Detail** (`/sales/:id`) - Sale invoice view

---

## 7. Mobile App Screens

### 7.1 Auth Stack
- **Login** - Email/password login

### 7.2 Tab Navigation (All Authenticated)
- **Dashboard** (Manager/Owner only) - Stats overview
- **POS** - Point of sale
- **Inventory** (Manager/Owner only) - Product list
- **More** - Profile, settings access

### 7.3 Stack Screens
- **Add Product** (Manager/Owner only)
- **Edit Product** (Manager/Owner only)
- **Sale Detail**
- **Customer Search/Add**

---

## 8. Authentication & Authorization

### 8.1 JWT Token Structure
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "owner|manager|cashier",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 8.2 Token Configuration
- **Access Token Expiry:** 8 hours
- **Refresh Token Expiry:** 7 days
- **Storage:** httpOnly cookie (web), AsyncStorage (mobile)

### 8.3 Role Permissions Matrix
| Feature | Owner | Manager | Cashier |
|---------|-------|---------|---------|
| View Dashboard | ✓ | ✓ | ✗ |
| Create Sale | ✓ | ✓ | ✓ |
| View Own Sales | ✓ | ✓ | ✓ |
| View All Sales | ✓ | ✓ | ✗ |
| Manage Products | ✓ | ✓ | ✗ |
| Manage Categories | ✓ | ✓ | ✗ |
| Manage Suppliers | ✓ | ✓ | ✗ |
| Manage Purchase Orders | ✓ | ✓ | ✗ |
| View Reports | ✓ | ✓ | ✗ |
| Manage Users | ✓ | ✗ | ✗ |
| Shop Settings | ✓ | ✗ | ✗ |

---

## 9. Invoice Generation

### 9.1 Invoice Number Format
`TYR-YYMM-XXXXX` where XXXXX is a zero-padded sequential number per month.

### 9.2 Public Invoice URL
- Format: `/invoice/{publicToken}`
- Token: 12-character alphanumeric string
- No authentication required
- Displays printable HTML invoice

### 9.3 Invoice Data Snapshot
```json
{
  "invoiceNumber": "TYR-2604-00001",
  "date": "2026-04-03T10:30:00Z",
  "customer": { "name": "...", "phone": "...", "vehicle": "..." },
  "items": [{ "name": "...", "size": "...", "qty": 2, "rate": 1500, "gst": 180, "amount": 3180 }],
  "subtotal": 3000,
  "cgst": 180,
  "sgst": 180,
  "total": 3360,
  "received": 3500,
  "balance": 140,
  "shop": { "name": "...", "phone": "...", "gstin": "..." }
}
```

---

## 10. Business Rules

### 10.1 GST Calculation
- GST Rate: 12% (configurable per product)
- CGST = GST / 2 = 6%
- SGST = GST / 2 = 6%
- Price Entry Modes:
  - `excl`: Selling price excludes GST → Price incl GST = price × (1 + gst_rate/100)
  - `incl`: Selling price includes GST → GST amount = price × (gst_rate/100)

### 10.2 Stock Management
- Stock decreases on sale creation
- Stock increases on purchase order receipt
- Soft delete products (is_deleted flag)
- Low stock alert when stock_qty ≤ min_stock_level

### 10.3 Sale Transaction Rules
- Atomic transaction (all or nothing)
- Rollback stock if any item fails
- Customer is optional (walk-in customer)
- Balance = received_amount - total (can be negative if overpayment)

---

## 11. Configuration & Environment

### 11.1 Environment Variables (API)
```env
NODE_ENV=development|production
PORT=4000
DATABASE_URL=postgresql://user:pass@host:5432/tyreshop
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
WHATSAPP_API_URL=https://api.whatsapp.example.com
WHATSAPP_API_TOKEN=token
```

### 11.2 Mobile Environment Configuration
```env
API_BASE_URL=http://YOUR_SERVER_IP:4000
```

---

## 12. Project Structure

### 12.1 Monorepo Root
```
tyreshop-pro/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point
│   │   │   ├── app.ts                # Express app
│   │   │   ├── routes/               # Route handlers
│   │   │   ├── middleware/           # Auth, validation, error handling
│   │   │   ├── services/             # Business logic
│   │   │   ├── utils/                # Helpers
│   │   │   └── types/                # TypeScript types
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── web/
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── lib/
│   │   │   └── styles/
│   │   └── package.json
│   │
│   └── mobile/
│       ├── src/
│       │   ├── App.tsx
│       │   ├── screens/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── stores/
│       │   └── services/
│       ├── app.json
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── index.ts
│       │   ├── constants.ts
│       │   ├── types.ts
│       │   └── schemas/             # Zod schemas
│       └── package.json
│
├── turbo.json
├── package.json
└── README.md
```

---

## 13. Error Handling

### 13.1 API Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  }
}
```

### 13.2 Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Input validation failed |
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict (duplicate) |
| INTERNAL_ERROR | 500 | Server error |

### 13.3 Client Error Handling
- React Query provides automatic error handling
- Global error boundary for React apps
- Toast notifications for user feedback

---

## 14. Testing Strategy

### 14.1 Backend Tests
- Unit tests for services/utilities (Jest)
- Integration tests for routes (Supertest)
- Test database with transactions (rollback after each test)

### 14.2 Frontend Tests
- Component tests with Testing Library
- Integration tests for forms and pages
- E2E tests with Playwright (critical flows)

---

## 15. Deployment

### 15.1 Backend (API)
- Node.js 20 LTS on Railway/Render/Fly.io
- PostgreSQL 16 on Neon/Supabase/Railway
- Environment variables via platform secrets

### 15.2 Web
- Vite build → Static hosting on Vercel/Netlify/Cloudflare Pages
- Continuous deployment from main branch

### 15.3 Mobile
- Expo EAS Build for Android APKs/AABs
- Expo EAS Submit for Play Store
- Over-the-air updates via Expo

---

## 16. Migration from Legacy System

### 16.1 Data Migration Steps
1. Export data from existing SQLite database
2. Transform data to match new schema
3. Run Prisma migrations on new PostgreSQL database
4. Seed reference data (categories, default users)
5. Import transformed data
6. Verify data integrity

### 16.2 Backward Compatibility
- Keep old API running during transition period
- Feature flags for gradual rollout
- Old invoice URLs still accessible via redirect

---

## 17. Out of Scope (Not Implementing)

- Multi-tenant/multi-store support
- Inventory for other automotive parts (tyres only)
- Accounting/financial reports beyond sales
- Employee attendance/time tracking
- Customer loyalty programs
- Integration with GST filing portals
- Mobile offline support
