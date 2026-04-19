import express from 'express';
import { all } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

router.get('/daily', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER), async (req, res) => {
  try {
    const date = req.query.date ?? new Date().toISOString().slice(0, 10);
    
    console.log('=== DAILY REPORT DEBUG ===');
    console.log('Requested date:', date);
    console.log('Server time:', new Date().toISOString());
    
    // First, check ALL sales in database
    const allSales = await all(`
      SELECT COUNT(*) as total FROM sales
    `);
    console.log('Total sales in database:', allSales[0].total);
    
    // Check sales for ANY date to see if sale_date is populated
    const sampleSales = await all(`
      SELECT id, invoice_number, sale_date, created_at
      FROM sales 
      ORDER BY sale_date DESC 
      LIMIT 5
    `);
    console.log('Sample sales:', sampleSales);
    
    // Check if sale_items exist
    const allItems = await all(`SELECT COUNT(*) as total FROM sale_items`);
    console.log('Total sale_items:', allItems[0].total);
    
    // Now run the actual query with date filter
    const result = await all(`
      SELECT
        COUNT(DISTINCT s.id) AS total_transactions,
        COALESCE(SUM(si.qty), 0) AS units_sold,
        COALESCE(SUM(si.total_amount), 0) AS total_revenue,
        COALESCE(SUM(
          si.total_amount - (COALESCE(si.unit_cost, p.cost_price, 0) * si.qty)
        ), 0) AS total_profit
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.sale_date::date = $date
    `, { date });
    
    console.log('Metrics result:', result);
    
    const metrics = result[0] || {
      total_transactions: 0,
      units_sold: 0,
      total_revenue: 0,
      total_profit: 0
    };
    
    // Get sales details
    const salesDetails = await all(`
      SELECT 
        s.id,
        s.invoice_number,
        s.total_amount,
        s.created_at,
        s.customer_name,
        s.customer_phone,
        COUNT(si.id) AS item_count,
        SUM(si.qty) AS total_qty
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.sale_date::date = $date
      GROUP BY s.id, s.invoice_number, s.total_amount, s.created_at, s.customer_name, s.customer_phone
      ORDER BY s.created_at DESC
    `, { date });
    
    console.log('Sales details count:', salesDetails.length);
    console.log('=== END DEBUG ===');
    
    // Hourly breakdown
    const hourlyData = await all(`
      SELECT
        EXTRACT(HOUR FROM s.sale_date) AS hour,
        COALESCE(SUM(si.total_amount), 0) AS total
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.sale_date::date = $date
      GROUP BY EXTRACT(HOUR FROM s.sale_date)
      ORDER BY hour
    `, { date });
    
    // Hourly breakdown
    const hourlyData = await all(`
      SELECT
        EXTRACT(HOUR FROM s.sale_date) AS hour,
        COALESCE(SUM(si.total_amount), 0) AS total
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.sale_date::date = $date
      GROUP BY EXTRACT(HOUR FROM s.sale_date)
      ORDER BY hour
    `, { date });
    
    const hourly_sales = hourlyData.map(h => ({
      hour: parseInt(h.hour),
      total: parseFloat(h.total)
    })).filter(h => h.total > 0);
    
    // Top products
    const topProductsData = await all(`
      SELECT
        COALESCE(p.company_name, si.service_name, 'Service') || ' ' || COALESCE(p.size_spec, '') AS name,
        SUM(si.qty) AS units_sold,
        SUM(si.total_amount) AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.sale_date::date = $date
      GROUP BY si.service_name, p.company_name, p.size_spec
      ORDER BY revenue DESC
      LIMIT 5
    `, { date });
    
    const top_products = topProductsData.map(p => ({
      name: p.name.trim(),
      units_sold: p.units_sold,
      revenue: parseFloat(p.revenue)
    }));
    
    res.json({
      date: date,
      total_revenue: parseFloat(metrics.total_revenue),
      total_profit: parseFloat(metrics.total_profit),
      total_transactions: metrics.total_transactions,
      units_sold: metrics.units_sold,
      top_products: top_products,
      hourly_sales: hourly_sales,
      sales_details: salesDetails.map(s => ({
        id: s.id,
        invoice_number: s.invoice_number,
        total: parseFloat(s.total_amount),
        created_at: s.created_at,
        customer_name: s.customer_name,
        customer_phone: s.customer_phone,
        item_count: s.item_count,
        total_qty: s.total_qty
      }))
    });
  } catch (err) {
    console.error('Daily report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/weekly', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    // PostgreSQL version: CURRENT_DATE - INTERVAL
    const weeklyData = await all(`
      SELECT
        DATE(s.sale_date) AS date,
        COALESCE(SUM(si.total_amount), 0) AS revenue,
        COALESCE(SUM(
          si.total_amount - (COALESCE(si.unit_cost, p.cost_price, 0) * si.qty)
        ), 0) AS profit,
        COUNT(DISTINCT s.id) AS transactions
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id
      WHERE s.sale_date >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY DATE(s.sale_date)
      ORDER BY date ASC
    `);
    
    const result = weeklyData.map(row => ({
      date: row.date,
      revenue: parseFloat(row.revenue),
      profit: parseFloat(row.profit),
      transactions: row.transactions
    }));
    
    res.json(result);
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
