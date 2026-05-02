import express from 'express';
import { all } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

router.get('/daily', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER), async (req, res) => {
  try {
    // Get dates from query - support both single date and range
    let { date, from_date, to_date } = req.query;
    
    // If no dates provided, default to today
    if (!date && !from_date && !to_date) {
      date = new Date().toISOString().split('T')[0];
      from_date = date;
      to_date = date;
    } else if (date) {
      // Single date mode
      from_date = date;
      to_date = date;
    }
    
    console.log('Daily Report - Date range:', from_date, 'to', to_date);
    
    // Build the date filter clause
    let dateFilter = '';
    let dateParams = {};
    
    if (from_date && to_date) {
      dateFilter = 'WHERE s.sale_date::date BETWEEN $from_date AND $to_date';
      dateParams = { from_date, to_date };
    } else if (from_date) {
      dateFilter = 'WHERE s.sale_date::date = $from_date';
      dateParams = { from_date };
    } else if (to_date) {
      dateFilter = 'WHERE s.sale_date::date = $to_date';
      dateParams = { to_date };
    }
    
    // Get all sales for the date range
    const sales = await all(`
      SELECT 
        s.id,
        s.invoice_number,
        s.total_amount,
        s.customer_name,
        s.customer_phone,
        s.vehicle_reg,
        s.created_at,
        s.sale_date
      FROM sales s
      ${dateFilter}
      ORDER BY s.created_at DESC
    `, dateParams);
    
    console.log('Sales found for date range:', sales.length);
    
    // Calculate totals
    let total_revenue = 0;
    let total_transactions = sales.length;
    let total_profit = 0;
    let profit_incl_gst = 0;
    
    // Get sale items for each sale with product/service names
    const salesWithDetails = [];
    for (const sale of sales) {
      const items = await all(`
        SELECT 
          si.qty,
          si.total_amount,
          si.unit_cost,
          si.gst_rate as item_gst_rate,
          p.cost_price,
          p.company_name,
          p.size_spec,
          si.product_id,
          si.service_name
        FROM sale_items si
        LEFT JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = $sale_id
      `, { sale_id: sale.id });
      
      let saleTotal = 0;
      let saleProfit = 0;
      let saleProfitInclGst = 0;
      
      // Build items bought string
      const itemsBought = items.map(item => {
        const itemTotal = parseFloat(item.total_amount) || 0;
        const cost = (item.unit_cost || item.cost_price || 0) * (item.qty || 0);
        const gstRate = parseFloat(item.item_gst_rate);
        
        saleTotal += itemTotal;
        saleProfitInclGst += itemTotal - cost;
        
        let revenueExclGst = itemTotal;
        if (gstRate > 0) {
          revenueExclGst = itemTotal / (1 + gstRate / 100);
        }
        saleProfit += revenueExclGst - cost;
        
        // Return product/service name - if product_id is null, it's a service (use item name from invoice_data)
        if (!item.product_id) {
          // Service - use the service_name from the sale item
          return item.service_name || 'Service';
        } else if (item.company_name && item.size_spec) {
          return `${item.company_name} ${item.size_spec}`;
        } else if (item.company_name) {
          return item.company_name;
        }
        return 'Item';
      });
      
      total_revenue += saleTotal;
      total_profit += saleProfit;
      profit_incl_gst += saleProfitInclGst;
      
      // Format items bought string
      let itemsBoughtStr = '';
      if (itemsBought.length === 1) {
        itemsBoughtStr = itemsBought[0];
      } else if (itemsBought.length === 2) {
        itemsBoughtStr = itemsBought.join(' + ');
      } else if (itemsBought.length > 2) {
        itemsBoughtStr = `${itemsBought[0]} +${itemsBought.length - 1} more`;
      }
      
      salesWithDetails.push({
        id: sale.id,
        invoice_number: sale.invoice_number,
        total: saleTotal,
        created_at: sale.created_at,
        customer_name: sale.customer_name,
        customer_phone: sale.customer_phone,
        vehicle_reg: sale.vehicle_reg || '-',
        items_bought: itemsBoughtStr
      });
    }
    
    const response = {
      date: from_date === to_date ? from_date : `${from_date} to ${to_date}`,
      total_revenue: total_revenue,
      total_profit: total_profit,
      profit_incl_gst: profit_incl_gst,
      total_transactions: total_transactions,
      sales_details: salesWithDetails
    };
    
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
