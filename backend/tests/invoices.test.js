import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/db/pool.js';

let ownerToken;
let saleId;
let invoiceNumber;

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE invoices, sales, sale_items, purchase_order_items, purchase_orders, products, categories, suppliers, customers, users CASCADE');
  
  await pool.query(`
    INSERT INTO users (name, email, password_hash, role) VALUES
    ('Test Owner', 'test@owner.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/./.og/at2.uheWG/igi', 'owner')
  `);
  
  const catRes = await pool.query(`INSERT INTO categories (name) VALUES ('Test Category') RETURNING id`);
  const prodRes = await pool.query(`
    INSERT INTO products (name, category_id, unit_price, cost_price, stock_qty) 
    VALUES ('Invoice Test Product', $1, 1000, 700, 50) RETURNING id`, [catRes.rows[0].id]
  );
  
  const ownerRes = await request(app).post('/auth/login').send({ email: 'test@owner.com', password: 'password' });
  ownerToken = ownerRes.body.token;
  
  const saleRes = await request(app)
    .post('/sales')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      customer: { name: 'Invoice Test Customer', phone: '2222222222' },
      items: [{ product_id: prodRes.rows[0].id, qty: 1 }]
    });
  
  saleId = saleRes.body.sale_id;
  invoiceNumber = saleRes.body.invoice_number;
});

describe('POST /invoices/:sale_id/send', () => {
  test('returns invoice URL', async () => {
    const res = await request(app)
      .post(`/invoices/${saleId}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.invoice_url).toBeDefined();
    expect(res.body.invoice_url).toContain(invoiceNumber);
  });
});

describe('GET /invoice/:invoice_number', () => {
  test('public endpoint returns 200 with HTML containing invoice number', async () => {
    const res = await request(app).get(`/invoice/${invoiceNumber}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain(invoiceNumber);
    expect(res.text).toContain('Invoice Test Customer');
  });

  test('non-existent invoice returns 404', async () => {
    const res = await request(app).get('/invoice/NONEXISTENT');
    
    expect(res.statusCode).toBe(404);
    expect(res.text).toContain('Invoice Not Found');
  });
});
