import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/db/pool.js';

let ownerToken;
let cashierToken;
let productId;
let categoryId;

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE invoices, sales, sale_items, purchase_order_items, purchase_orders, products, categories, suppliers, customers, users CASCADE');
  
  await pool.query(`
    INSERT INTO users (name, email, password_hash, role) VALUES
    ('Test Owner', 'test@owner.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/./.og/at2.uheWG/igi', 'owner'),
    ('Test Cashier', 'test@cashier.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/./.og/at2.uheWG/igi', 'cashier')
  `);
  
  const catRes = await pool.query(`INSERT INTO categories (name) VALUES ('Test Category') RETURNING id`);
  categoryId = catRes.rows[0].id;
  
  const prodRes = await pool.query(`
    INSERT INTO products (name, category_id, unit_price, cost_price, stock_qty) 
    VALUES ('Test Product', $1, 1000, 700, 50) RETURNING id`, [categoryId]
  );
  productId = prodRes.rows[0].id;
  
  const ownerRes = await request(app).post('/auth/login').send({ email: 'test@owner.com', password: 'password' });
  ownerToken = ownerRes.body.token;
  
  const cashierRes = await request(app).post('/auth/login').send({ email: 'test@cashier.com', password: 'password' });
  cashierToken = cashierRes.body.token;
});

describe('POST /sales', () => {
  test('as cashier with valid items returns 201 and decrements stock', async () => {
    const res = await request(app)
      .post('/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        customer: { name: 'Test Customer', phone: '9999999999' },
        items: [{ product_id: productId, qty: 2 }]
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.invoice_number).toBeDefined();
    expect(res.body.total).toBeDefined();
    
    const stockCheck = await pool.query('SELECT stock_qty FROM products WHERE id = $1', [productId]);
    expect(parseInt(stockCheck.rows[0].stock_qty)).toBe(48);
  });

  test('with out-of-stock item returns 400', async () => {
    const res = await request(app)
      .post('/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        customer: { name: 'Test Customer', phone: '8888888888' },
        items: [{ product_id: productId, qty: 1000 }]
      });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Insufficient stock');
  });

  test('as unauthenticated returns 401', async () => {
    const res = await request(app)
      .post('/sales')
      .send({
        customer: { name: 'Test Customer', phone: '7777777777' },
        items: [{ product_id: productId, qty: 1 }]
      });
    
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /sales', () => {
  test('as cashier returns 403', async () => {
    const res = await request(app)
      .get('/sales')
      .set('Authorization', `Bearer ${cashierToken}`);
    
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Insufficient privileges');
  });

  test('as owner returns 200', async () => {
    const res = await request(app)
      .get('/sales')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
