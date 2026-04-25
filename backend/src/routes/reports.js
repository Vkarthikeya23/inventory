import express from 'express';
import { all } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

router.get('/daily', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER), async (req, res) => {
  try {
    // Get the date from query or use today
    let date = req.query.date;
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }
    
    console.log('Daily Report - Date:', date);
    console.log('Server time:', new Date().toISOString());
    
    // First, let's see what dates exist in the database
    const dateCheck = await all(`
      SELECT DISTINCT sale_date::date as sale_date
      FROM sales
      ORDER BY sale_date DESC
      LIMIT 10
    `);
    console.log('Dates in database:', dateCheck);
    
    // Get all sales for this date - simple query
    const sales = await all(`
      SELECT 
        s.id,
        s.invoice_number,
        s.total_amount,
        s.customer_name,
        s.customer_phone,
        s.created_at,
        s.sale_date
      FROM sales s
      WHERE s.sale_date::date = $date
      ORDER BY s.created_at DESC
    `, { date });
    
    console.log('Sales found for date:', sales.length);
    if (sales.length > 0) {
      console.log('First sale:', sales[0]);
    }
    
    // Calculate totals
    let total_revenue = 0;
    let total_transactions = sales.length;
    let total_profit = 0;
    let profit_incl_gst = 0;
    
    // Get sale items for each sale
    const salesWithDetails = [];
    for (const sale of sales) {
      const items = await all(`
        SELECT 
          si.qty,
          si.total_amount,
          si.unit_cost,
          si.unit_price,
          p.cost_price,
          p.gst_rate
        FROM sale_items si
        LEFT JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = $sale_id
      `, { sale_id: sale.id });
      
      let saleTotal = 0;
      let saleQty = 0;
      let saleProfit = 0;
      let saleProfitInclGst = 0;
      
      for (const item of items) {
        const itemTotal = parseFloat(item.total_amount) || 0;
        saleTotal += itemTotal;
        const cost = (item.unit_cost || item.cost_price || 0) * (item.qty || 0);
        const gstRate = parseFloat(item.gst_rate) || 12;
        
        console.log(`DEBUG ITEM: sale=${sale.invoice_number}, item_total=${itemTotal}, cost=${cost}, gst_rate=${gstRate}`);
        
        // Profit including GST = Revenue - Cost (simple!)
        saleProfitInclGst += itemTotal - cost;
        
        // For profit excluding GST, we need to subtract GST from revenue first
        // If total_amount includes GST, then: amount_excl = amount_incl / (1 + gst_rate/100)
        const revenueExclGst = itemTotal / (1 + gstRate / 100);
        saleProfit += revenueExclGst - cost;
      }
      
      total_revenue += saleTotal;
      total_profit += saleProfit;
      profit_incl_gst += saleProfitInclGst;
      
      salesWithDetails.push({
        id: sale.id,
        invoice_number: sale.invoice_number,
        total: saleTotal,
        created_at: sale.created_at,
        customer_name: sale.customer_name,
        customer_phone: sale.customer_phone,
        item_count: items.length
      });
    }
    
    const response = {
      date: date,
      total_revenue: total_revenue,
      total_profit: total_profit,
      profit_incl_gst: profit_incl_gst,
      total_transactions: total_transactions,
      sales_details: salesWithDetails
    };
    
    console.log('Response:', JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (err) {
    console.error('Daily report error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message,
      stack: err.stack
    });
  }
});

router.get('/weekly', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const weeklyQuery = `
      SELECT
        DATE(s.sale_date) AS date,
        COALESCE(SUM(si.total_amount), 0) AS revenue,
        COUNT(DISTINCT s.id) AS transactions
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.sale_date >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY DATE(s.sale_date)
      ORDER BY DATE(s.sale_date) ASC
    `;
    
    const weeklyData = await all(weeklyQuery);
    
    const result = weeklyData.map(row => ({
      date: row.date,
      revenue: parseFloat(row.revenue || 0),
      transactions: parseInt(row.transactions || 0)
    }));
    
    res.json(result);
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
