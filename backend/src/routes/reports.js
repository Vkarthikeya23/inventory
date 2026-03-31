import express from 'express';
import { all } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

router.get('/daily', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), (req, res) => {
  try {
    const date = req.query.date ?? new Date().toISOString().slice(0, 10);
    
    // Main metrics query
    const result = all(`
      SELECT
        COUNT(DISTINCT s.id) AS total_transactions,
        COALESCE(SUM(si.qty), 0) AS units_sold,
        COALESCE(SUM(si.amount), 0) AS total_revenue,
        COALESCE(SUM(
          si.amount - (
            COALESCE(si.unit_cost, p.cost_price, si.unit_price * 0.70) * si.qty
          )
        ), 0) AS total_profit
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id
      WHERE DATE(s.sale_date) = $date
    `, { date });
    
    const metrics = result[0] || {
      total_transactions: 0,
      units_sold: 0,
      total_revenue: 0,
      total_profit: 0
    };
    
    // Get sales details
    const salesDetails = all(`
      SELECT 
        s.id,
        s.invoice_number,
        s.total,
        s.created_at,
        c.name AS customer_name,
        c.phone AS customer_phone,
        COUNT(si.id) AS item_count,
        SUM(si.qty) AS total_qty
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      JOIN sale_items si ON si.sale_id = s.id
      WHERE DATE(s.sale_date) = $date
      GROUP BY s.id, s.invoice_number, s.total, s.created_at, c.name, c.phone
      ORDER BY s.created_at DESC
    `, { date });
    
    // Hourly breakdown
    const hourlyData = all(`
      SELECT
        CAST(strftime('%H', s.sale_date) AS INTEGER) AS hour,
        COALESCE(SUM(si.amount), 0) AS total
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE DATE(s.sale_date) = $date
      GROUP BY hour
      ORDER BY hour
    `, { date });
    
    const hourly_sales = hourlyData.map(h => ({
      hour: h.hour,
      total: parseFloat(h.total)
    })).filter(h => h.total > 0);
    
    // Top products
    const topProductsData = all(`
      SELECT
        COALESCE(p.company_name, 'Unknown') || ' ' || COALESCE(p.size_spec, '') AS name,
        SUM(si.qty) AS units_sold,
        SUM(si.amount) AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE DATE(s.sale_date) = $date
      GROUP BY p.id, p.company_name, p.size_spec
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
        total: parseFloat(s.total),
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

router.get('/weekly', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), (req, res) => {
  try {
    const weeklyData = all(`
      SELECT
        DATE(s.sale_date) AS date,
        COALESCE(SUM(si.amount), 0) AS revenue,
        COALESCE(SUM(
          si.amount - (COALESCE(si.unit_cost, p.cost_price, si.unit_price * 0.70) * si.qty)
        ), 0) AS profit,
        COUNT(DISTINCT s.id) AS transactions
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id
      WHERE s.sale_date >= DATE('now', '-6 days')
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
