import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/db/pool.js';

let ownerToken;
let cashierToken;

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE invoices, sales, sale_items, purchase_order_items, purchase_orders, products, categories, suppliers, customers, users CASCADE');
  
  await pool.query(`
    INSERT INTO users (name, email, password_hash, role) VALUES
    ('Test Owner', 'test@owner.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/./.og/at2.uheWG/igi', 'owner'),
    ('Test Cashier', 'test@cashier.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/./.og/at2.uheWG/igi', 'cashier')
  `);
  
  const catRes = await pool.query(`INSERT INTO categories (name) VALUES ('Test Category') RETURNING id`);
  const prodRes = await pool.query(`
    INSERT INTO products (name, category_id, unit_price, cost_price, stock_qty) 
    VALUES ('Test Product', $1, 1000, 700, 50) RETURNING id`, [catRes.rows[0].id]
  );
  
  const ownerRes = await request(app).post('/auth/login').send({ email: 'test@owner.com', password: 'password' });
  ownerToken = ownerRes.body.token;
  
  const cashierRes = await request(app).post('/auth/login').send({ email: 'test@cashier.com', password: 'password' });
  cashierToken = cashierRes.body.token;
  
  await request(app)
    .post('/sales')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      customer: { name: 'Report Test Customer', phone: '1111111111' },
      items: [{ product_id: prodRes.rows[0].id, qty: 1 }]
    });
});

describe('GET /reports/daily', () => {
  test('as owner returns 200 with revenue and profit', async () => {
    const res = await request(app)
      .get('/reports/daily')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.total_revenue).toBeDefined();
    expect(res.body.total_profit).toBeDefined();
    expect(res.body.total_transactions).toBeGreaterThanOrEqual(1);
  });

  test('as cashier returns 403', async () => {
    const res = await request(app)
      .get('/reports/daily')
      .set('Authorization', `Bearer ${cashierToken}`);
    
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Insufficient privileges');
  });
});
