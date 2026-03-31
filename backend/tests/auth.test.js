import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/db/pool.js';

let authToken;
let userId;

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE invoices, sales, sale_items, purchase_order_items, purchase_orders, products, categories, suppliers, customers, users CASCADE');
  await pool.query(`
    INSERT INTO users (name, email, password_hash, role) 
    VALUES ('Test Owner', 'test@owner.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/./.og/at2.uheWG/igi', 'owner')
  `);
});

describe('POST /auth/login', () => {
  test('with valid credentials returns 200 and token', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'test@owner.com', password: 'password' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('owner');
    authToken = res.body.token;
    userId = res.body.user.id;
  });

  test('with wrong password returns 401', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'test@owner.com', password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('with unknown email returns 401', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'unknown@email.com', password: 'password' });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
});

describe('GET /auth/me', () => {
  test('with valid token returns 200', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('test@owner.com');
  });

  test('with no token returns 401', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Authorization');
  });
});
