import express from 'express';
import { get, all, transaction } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES, CGST_RATE, SGST_RATE } from '../../../shared/constants.js';
import { toWords } from '../../../shared/toWords.js';

const router = express.Router();

// Helper functions for transaction-based queries
async function txGet(client, sql, params = {}) {
  const keys = [];
  const values = [];
  let paramIndex = 1;
  
  const newSql = sql.replace(/\$(\w+)/g, (match, key) => {
    keys.push(key);
    return `$${paramIndex++}`;
  });
  
  for (const key of keys) {
    values.push(params[key] ?? null);
  }
  
  const result = await client.query(newSql, values);
  return result.rows[0] || null;
}

async function txRun(client, sql, params = {}) {
  const keys = [];
  const values = [];
  let paramIndex = 1;
  
  const newSql = sql.replace(/\$(\w+)/g, (match, key) => {
    keys.push(key);
    return `$${paramIndex++}`;
  });
  
  for (const key of keys) {
    values.push(params[key] ?? null);
  }
  
  await client.query(newSql, values);
}

router.post('/', verifyToken, async (req, res) => {
  // Step 1 — parse and validate input BEFORE touching the database
  const {
    customer_name,
    customer_phone,
    vehicle_reg,
    sale_date,
    received_amount,
    items,
    notes
  } = req.body;

  if (!customer_name || !customer_phone) {
    return res.status(400).json({ error: 'Customer name and phone are required' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Add at least one product to the sale' });
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.product_id) {
      return res.status(400).json({ error: `Item ${i + 1}: Please select a product` });
    }
    if (!item.qty || Number(item.qty) <= 0) {
      return res.status(400).json({ error: `Item ${i + 1}: Quantity must be greater than 0` });
    }
    if (!item.unit_price || Number(item.unit_price) <= 0) {
      return res.status(400).json({ error: `Item ${i + 1}: Price must be greater than 0` });
    }
  }

  // Step 2 — compute all values in plain JS before opening DB connection
  const parsedItems = items.map(item => {
    const qty = Number(item.qty);
    const unitPrice = parseFloat(item.unit_price);
    const gstRate = parseFloat(item.gst_rate ?? 12);
    const gstAmount = parseFloat((unitPrice * qty * gstRate / 100).toFixed(2));
    const amount = parseFloat((unitPrice * qty + gstAmount).toFixed(2));
    return { 
      product_id: item.product_id, 
      qty, 
      unitPrice, 
      gstRate, 
      gstAmount, 
      amount,
      unitCost: null // Will be populated from DB
    };
  });

  const subtotal = parseFloat(parsedItems.reduce((s, i) => s + i.unitPrice * i.qty, 0).toFixed(2));
  
  // Calculate total GST from all items
  const totalGstAmount = parseFloat(parsedItems.reduce((s, i) => s + i.gstAmount, 0).toFixed(2));
  
  // Split total GST equally into CGST and SGST
  const cgst = parseFloat((totalGstAmount / 2).toFixed(2));
  const sgst = parseFloat((totalGstAmount / 2).toFixed(2));
  const total = parseFloat((subtotal + cgst + sgst).toFixed(2));
  const receivedAmount = received_amount != null ? parseFloat(received_amount) : total;
  const balance = parseFloat((total - receivedAmount).toFixed(2));
  const saleDate = sale_date ? new Date(sale_date) : new Date();
  const amountInWords = toWords(total);

  // Step 3 — run transaction using PostgreSQL
  try {
    const result = await transaction(async (client) => {
      console.log('SALE: Starting transaction');
      
      // 3a. generate invoice number - query actual sales table to avoid conflicts
      const period = String(saleDate.getFullYear()).slice(-2) + String(saleDate.getMonth() + 1).padStart(2, '0');
      console.log('SALE: Period:', period);
      
      // Find the highest existing invoice number for this period
      console.log('SALE: Querying for existing invoices with pattern:', `TYR-${period}-%`);
      const existingInvoices = await txGet(client, `
        SELECT invoice_number FROM sales 
        WHERE invoice_number LIKE $pattern 
        ORDER BY invoice_number DESC 
        LIMIT 1
      `, { pattern: `TYR-${period}-%` });
      console.log('SALE: Existing invoices:', existingInvoices);
      
      let nextSeq = 1;
      if (existingInvoices) {
        // Extract sequence number from invoice number like "TYR-2603-00017"
        const parts = existingInvoices.invoice_number.split('-');
        console.log('SALE: Invoice parts:', parts);
        if (parts.length === 3) {
          nextSeq = parseInt(parts[2]) + 1;
        }
      }
      console.log('SALE: Next sequence:', nextSeq);
      
      const invoiceNumber = `TYR-${period}-${String(nextSeq).padStart(5, '0')}`;
      console.log('SALE: Generated invoice number:', invoiceNumber);
      
      // Note: invoice_sequences table update removed - we query actual sales table instead

      console.log('SALE: Checking/updating customer');
      // 3b. upsert customer
      const existingCustomer = await txGet(client, 'SELECT id FROM customers WHERE phone = $phone', { phone: customer_phone });
      let customerId;
      
      if (existingCustomer) {
        await txRun(client, 'UPDATE customers SET name = $name, vehicle_reg = $vehicle_reg WHERE id = $id', {
          name: customer_name,
          vehicle_reg: vehicle_reg || null,
          id: existingCustomer.id
        });
        customerId = existingCustomer.id;
      } else {
        const newCustomer = await txGet(client, `
          INSERT INTO customers (id, name, phone, vehicle_reg)
          VALUES (gen_random_uuid(), $name, $phone, $vehicle_reg)
          RETURNING id, name, phone
        `, {
          name: customer_name,
          phone: customer_phone,
          vehicle_reg: vehicle_reg || null
        });
        customerId = newCustomer.id;
      }

      const customer = await txGet(client, 'SELECT id, name, phone FROM customers WHERE id = $id', { id: customerId });

      // 3c. check stock availability AND get cost prices in one query
      const productDetails = [];
      for (const item of parsedItems) {
        const product = await txGet(client, `
          SELECT id, stock_qty, company_name, size_spec, cost_price, hsn_code
          FROM products 
          WHERE id = $id AND is_deleted = false
        `, { id: item.product_id });
        
        if (!product) {
          throw new Error(`Product not found: ${item.product_id}`);
        }
        
        if (product.stock_qty < item.qty) {
          throw new Error(`Insufficient stock for ${product.company_name} ${product.size_spec}. Available: ${product.stock_qty}, Requested: ${item.qty}`);
        }
        
        // Store cost price for this item
        item.unitCost = product.cost_price || 0;
        productDetails.push(product);
      }

      // 3d. insert sale
      const sale = await txGet(client, `
        INSERT INTO sales (id, customer_name, customer_phone, vehicle_reg, user_id, invoice_number, subtotal, cgst_amount, sgst_amount, total_amount, received_amount, balance_amount, sale_date, notes)
        VALUES (gen_random_uuid(), $customer_name, $customer_phone, $vehicle_reg, $user_id, $invoice_number, $subtotal, $cgst_amount, $sgst_amount, $total_amount, $received_amount, $balance_amount, $sale_date, $notes)
        RETURNING id
      `, {
        customer_name: customer.name,
        customer_phone: customer.phone,
        vehicle_reg: vehicle_reg || null,
        user_id: req.user.id,
        invoice_number: invoiceNumber,
        subtotal,
        cgst_amount: cgst,
        sgst_amount: sgst,
        total_amount: total,
        received_amount: receivedAmount,
        balance_amount: balance,
        sale_date: saleDate.toISOString(),
        notes: notes || ''
      });
      const saleId = sale.id;

      // 3e. insert sale items with unit_cost and deduct stock
      for (const item of parsedItems) {
        await txRun(client, `
          INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price, unit_cost, gst_rate, subtotal, gst_amount, total_amount)
          VALUES (gen_random_uuid(), $sale_id, $product_id, $qty, $unit_price, $unit_cost, $gst_rate, $subtotal, $gst_amount, $total_amount)
        `, {
          sale_id: saleId,
          product_id: item.product_id,
          qty: item.qty,
          unit_price: item.unitPrice,
          unit_cost: item.unitCost,
          gst_rate: item.gstRate,
          subtotal: item.unitPrice * item.qty,
          gst_amount: item.gstAmount,
          total_amount: item.amount
        });
        
        await txRun(client, `
          UPDATE products SET stock_qty = stock_qty - $qty WHERE id = $id
        `, { qty: item.qty, id: item.product_id });
      }

      // 3f. build invoice snapshot and insert
      const productMap = {};
      productDetails.forEach(p => { productMap[p.id] = p; });

      const invoiceData = {
        invoice_number: invoiceNumber,
        sale_date: saleDate.toISOString(),
        shop: {
          name: process.env.SHOP_NAME ?? 'TyreShop',
          phone: process.env.SHOP_PHONE ?? '',
          address: process.env.SHOP_ADDRESS ?? '',
          gstin: process.env.SHOP_GSTIN ?? ''
        },
        customer: {
          name: customer.name,
          phone: customer.phone,
          vehicle_reg: vehicle_reg ?? ''
        },
        items: parsedItems.map(i => ({
          name: `${productMap[i.product_id]?.company_name ?? ''} ${productMap[i.product_id]?.size_spec ?? ''}`.trim(),
          company_name: productMap[i.product_id]?.company_name ?? '',
          size_spec: productMap[i.product_id]?.size_spec ?? '',
          hsn_code: productMap[i.product_id]?.hsn_code ?? '',
          qty: i.qty,
          unit_price: i.unitPrice,
          unit_cost: i.unitCost,
          gst_rate: i.gstRate,
          gst_amount: i.gstAmount,
          amount: i.amount
        })),
        subtotal,
        cgst,
        sgst,
        total,
        received_amount: receivedAmount,
        balance,
        amount_in_words: amountInWords,
        terms: process.env.INVOICE_TERMS ?? 'Thanks for doing business with us!'
      };

      const publicToken = Math.random().toString(36).slice(2, 14);

      const invoiceDataString = JSON.stringify(invoiceData);
      console.log('SALE: Invoice data to insert:', invoiceDataString.substring(0, 100) + '...');
      
      await txRun(client, `
        INSERT INTO invoices (id, sale_id, invoice_data, public_token)
        VALUES (gen_random_uuid(), $sale_id, $invoice_data, $public_token)
      `, {
        sale_id: saleId,
        invoice_data: invoiceDataString,
        public_token: publicToken
      });

      console.log('SALE: Transaction completed successfully');
      
      // Return data needed for response
      return {
        sale_id: saleId,
        invoice_number: invoiceNumber,
        total,
        subtotal,
        cgst,
        sgst,
        customer_phone: customer.phone,
        customer_name: customer.name,
        amount_in_words: amountInWords
      };
    });

    // Step 4 — send response
    let baseUrl = process.env.APP_BASE_URL || 'http://localhost:4000';
    // Remove any trailing slashes
    baseUrl = baseUrl.replace(/\/+$/g, '');
    
    console.log('APP_BASE_URL:', process.env.APP_BASE_URL);
    console.log('Generated invoice URL:', `${baseUrl}/invoice/${result.invoice_number}`);
    
    return res.status(201).json({
      ...result,
      invoice_url: `${baseUrl}/invoice/${result.invoice_number}`
    });

  } catch (err) {
    console.error('SALE: Error during sale creation:', err);
    if (err.message.includes('Product not found') || err.message.includes('Insufficient stock')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to create sale. Please try again.' });
  }
});

// Get all sales
router.get('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const sales = await all(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.sale_date DESC
      LIMIT 100
    `);
    
    res.json(sales);
  } catch (err) {
    console.error('Error fetching sales:', err);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Get single sale with items
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const sale = await get(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.vehicle_reg
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.id = $id
    `, { id: req.params.id });
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const items = await all(`
      SELECT si.*, p.display_name, p.company_name, p.size_spec
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = $sale_id
    `, { sale_id: sale.id });
    
    res.json({ ...sale, items });
  } catch (err) {
    console.error('Error fetching sale:', err);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// Get sale statistics
router.get('/stats/overview', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    const todayStats = await get(`
      SELECT 
        COUNT(*) as transaction_count,
        COALESCE(SUM(total), 0) as total_sales
      FROM sales
      WHERE date(sale_date) = $today
    `, { today });
    
    const monthStats = await get(`
      SELECT 
        COUNT(*) as transaction_count,
        COALESCE(SUM(total), 0) as total_sales
      FROM sales
      WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now')
    `);
    
    res.json({
      today: todayStats,
      month: monthStats
    });
  } catch (err) {
    console.error('Error fetching sale stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
