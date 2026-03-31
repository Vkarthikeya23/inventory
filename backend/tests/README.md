# Backend Test Suite Documentation

## Overview

This test suite provides comprehensive coverage of the TyreShop Pro backend API using Jest and Supertest. Tests are organized by route, database helpers, utilities, and integration workflows.

## Test Structure

```
backend/tests/
├── setup.js                 # Test setup, database initialization, and helper functions
├── routes/
│   ├── auth.test.js        # Authentication endpoints (login, user info)
│   ├── products.test.js    # Product management (CRUD operations)
│   ├── categories.test.js  # Category management
│   ├── suppliers.test.js   # Supplier management
│   ├── sales.test.js       # Sales transactions and cart management
│   ├── reports.test.js     # Daily and weekly reports
│   ├── purchaseOrders.test.js  # Purchase order workflow
│   └── invoices.test.js    # Invoice generation and public viewing
├── db/
│   └── helpers.test.js     # Database utility functions
├── utils/
│   └── invoiceNumber.test.js  # Invoice number generation
└── integration/
    └── workflows.test.js   # Complete business workflows
```

## Running Tests

### Run All Tests
```bash
cd backend
npm test
```

### Run Specific Test File
```bash
# Test authentication
npm test -- tests/routes/auth.test.js

# Test products
npm test -- tests/routes/products.test.js

# Test sales
npm test -- tests/routes/sales.test.js

# Run integration tests
npm test -- tests/integration/workflows.test.js
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Verbose Output
```bash
npm test -- --verbose
```

## Test Categories

### 1. Authentication Tests (`auth.test.js`)

Tests user authentication and authorization:

**POST /auth/login**
- ✓ Login with valid credentials returns token
- ✓ Login with invalid password returns 401
- ✓ Login with non-existent email returns 401
- ✓ Login with missing email returns 400
- ✓ Login with missing password returns 400
- ✓ Login with inactive user returns 401
- ✓ Login with empty credentials returns 400
- ✓ Works for all user roles (owner, manager, cashier)

**GET /auth/me**
- ✓ Get user info with valid token
- ✓ Returns 401 without token
- ✓ Returns 401 with invalid token
- ✓ Returns 401 with malformed header
- ✓ Returns 404 when user deleted
- ✓ Returns 401 with expired token

### 2. Products Tests (`products.test.js`)

Tests product management:

**GET /products**
- ✓ List all products
- ✓ Filter by search term
- ✓ Filter by category_id
- ✓ Filter by low_stock=true
- ✓ Exclude deleted products
- ✓ Return empty array when no products
- ✓ Combine multiple filters

**POST /products**
- ✓ Create product as owner
- ✓ Create product as manager
- ✓ Return 403 for cashier
- ✓ Return 400 when name missing
- ✓ Return 400 when unit_price missing
- ✓ Use default values for optional fields
- ✓ Handle special characters in names
- ✓ Handle decimal prices
- ✓ Handle zero stock

**PUT /products/:id**
- ✓ Update product as owner
- ✓ Update product as manager
- ✓ Return 403 for cashier
- ✓ Return 400 for no valid fields
- ✓ Return 404 for non-existent product
- ✓ Soft delete product
- ✓ Partial updates

### 3. Categories Tests (`categories.test.js`)

**GET /categories**
- ✓ List all categories
- ✓ Return empty array when none exist
- ✓ Work for all user roles
- ✓ Order by name

**POST /categories**
- ✓ Create category as owner/manager
- ✓ Return 403 for cashier
- ✓ Return 400 when name missing
- ✓ Return 400 for duplicate name
- ✓ Create without description
- ✓ Handle special characters

### 4. Suppliers Tests (`suppliers.test.js`)

**GET /suppliers**
- ✓ List all suppliers (owner/manager only)
- ✓ Return 403 for cashier
- ✓ Return empty array when none exist

**POST /suppliers**
- ✓ Create supplier as owner/manager
- ✓ Return 403 for cashier
- ✓ Return 400 when name missing
- ✓ Create with minimal data
- ✓ Handle special characters

### 5. Sales Tests (`sales.test.js`)

**POST /sales**
- ✓ Create sale as cashier
- ✓ Create sale as owner
- ✓ Return 400 when customer name missing
- ✓ Return 400 when customer phone missing
- ✓ Return 400 when items empty
- ✓ Return 400 for insufficient stock
- ✓ Return 400 for non-existent product
- ✓ Decrement stock after sale
- ✓ Create new customer if phone not found
- ✓ Use existing customer if phone exists
- ✓ Calculate GST correctly (CGST 14% + SGST 14%)

**GET /sales**
- ✓ List sales as owner/manager
- ✓ Return 403 for cashier
- ✓ Filter by date range
- ✓ Return 401 for unauthenticated

**GET /sales/:id**
- ✓ Get sale details as owner/manager
- ✓ Return 403 for cashier
- ✓ Return 404 for non-existent sale

### 6. Reports Tests (`reports.test.js`)

**GET /reports/daily**
- ✓ Get daily report as owner/manager
- ✓ Return 403 for cashier
- ✓ Accept specific date parameter
- ✓ Calculate profit correctly
- ✓ Include units sold
- ✓ Include hourly sales breakdown

**GET /reports/weekly**
- ✓ Get weekly report as owner/manager
- ✓ Return 403 for cashier
- ✓ Return last 7 days of data
- ✓ Include daily breakdown

### 7. Purchase Orders Tests (`purchaseOrders.test.js`)

**GET /purchase-orders**
- ✓ List POs as owner/manager
- ✓ Return 403 for cashier

**POST /purchase-orders**
- ✓ Create PO as owner/manager
- ✓ Return 403 for cashier
- ✓ Return 400 when supplier_id missing
- ✓ Return 400 when items empty

**PUT /purchase-orders/:id/receive**
- ✓ Mark as received as owner/manager
- ✓ Increase stock after receiving
- ✓ Return 403 for cashier
- ✓ Return 400 when items missing

### 8. Invoices Tests (`invoices.test.js`)

**POST /invoices/:sale_id/send**
- ✓ Get invoice URL as owner/manager
- ✓ Return 403 for cashier
- ✓ Return 404 for non-existent sale

**GET /invoice/:invoice_number (Public)**
- ✓ Return HTML for valid invoice
- ✓ Return 404 for non-existent invoice
- ✓ Accessible without authentication
- ✓ Contains shop details and GST info
- ✓ Contains print/download buttons

### 9. Database Helpers Tests (`helpers.test.js`)

**query()**
- ✓ Execute SELECT and return array
- ✓ Return empty array for no results
- ✓ Handle parameterized queries

**queryOne()**
- ✓ Return single result
- ✓ Return null for no results

**run()**
- ✓ Execute INSERT
- ✓ Execute UPDATE
- ✓ Execute DELETE

### 10. Utility Tests (`invoiceNumber.test.js`)

**generateInvoiceNumber()**
- ✓ Generate with correct format (TYR-YYMM-XXXXX)
- ✓ Use current year and month
- ✓ Generate sequential numbers
- ✓ Create new sequence for new month
- ✓ Pad sequence to 5 digits

### 11. Integration Tests (`workflows.test.js`)

**Complete Sale Workflow**
- ✓ Create category → product → sale → view invoice → check stock

**Complete Purchase Order Workflow**
- ✓ Create supplier → create PO → receive stock → verify stock increase

**Daily Business Workflow**
- ✓ Simulate complete day: multiple sales, check reports, verify inventory

## Test Data

### Default Test Users
- **Owner**: owner@test.com / password
- **Manager**: manager@test.com / password
- **Cashier**: cashier@test.com / password

### Test Database
Tests use an in-memory SQLite database that is:
- Initialized fresh for each test file
- Cleared between tests
- Has the same schema as production

## Mocking

The database pool is mocked to return the test database:
```javascript
jest.mock('../../src/db/pool.js', () => ({
  getDb: jest.fn()
}));
```

Before each test:
```javascript
const { getDb } = await import('../../src/db/pool.js');
getDb.mockReturnValue(getTestDb());
```

## Helper Functions

### Creating Test Data
```javascript
// Create a user
createTestUser({ name, email, password, role })

// Create a category
createTestCategory(name, description)

// Create a product
createTestProduct({ name, brand, category_id, unit_price, stock_qty })

// Create a supplier
createTestSupplier({ name, phone, gstin })

// Create a customer
createTestCustomer({ name, phone })

// Create a sale
createTestSale({ customer_id, invoice_number, total })
```

### Database Queries
```javascript
// Execute query, return array
query('SELECT * FROM products WHERE category_id = ?', [categoryId])

// Execute query, return single result
queryOne('SELECT * FROM users WHERE email = ?', [email])

// Execute statement
run('INSERT INTO categories (name) VALUES (?)', ['Tyres'])
```

## Best Practices

1. **Isolated Tests**: Each test should be independent
2. **Clear Arrange/Act/Assert**: Structure tests with comments
3. **Descriptive Names**: Test names should explain what's being tested
4. **Edge Cases**: Test empty inputs, null values, boundary conditions
5. **Error Cases**: Test 400, 401, 403, 404 responses
6. **Clean State**: Clear database between tests

## Coverage Report

Generate coverage report:
```bash
npm test -- --coverage
```

Coverage includes:
- Statement coverage
- Branch coverage
- Function coverage
- Line coverage

View detailed report in `coverage/lcov-report/index.html`

## Debugging Failed Tests

1. Run single test file:
   ```bash
   npm test -- tests/routes/products.test.js
   ```

2. Run with verbose output:
   ```bash
   npm test -- --verbose
   ```

3. Add console.log in test:
   ```javascript
   console.log('Response:', response.body);
   ```

4. Check test database state:
   ```javascript
   const result = query('SELECT * FROM users');
   console.log('Users:', result);
   ```

## Continuous Integration

To run tests in CI/CD:
```yaml
# .github/workflows/test.yml or similar
- name: Run Tests
  run: |
    cd backend
    npm ci
    npm test
```

## Summary

**Total Test Files**: 11
**Total Test Suites**: 11
**Approximate Tests**: 150+
**Coverage**: All routes, database helpers, utilities, and integration workflows

All tests validate:
- ✓ Happy path (successful operations)
- ✓ Error handling (invalid inputs, unauthorized access)
- ✓ Edge cases (empty data, special characters)
- ✓ Role-based access control
- ✓ Data integrity (stock updates, calculations)
