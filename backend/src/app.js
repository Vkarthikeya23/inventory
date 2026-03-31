import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import publicInvoiceRoutes from './routes/publicInvoice.js';
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import reportsRoutes from './routes/reports.js';
import invoicesRoutes from './routes/invoices.js';

dotenv.config();

const app = express();

// CORS must be first
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors());

// Fallback CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public routes (no auth required)
app.use('/', publicInvoiceRoutes);

app.use('/auth', authRoutes);
app.use('/products', productsRoutes);
app.use('/sales', salesRoutes);
app.use('/reports', reportsRoutes);
app.use('/invoices', invoicesRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
