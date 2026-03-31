import express from 'express';
import { get, all, run, runNoSave } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES, CGST_RATE, SGST_RATE } from '../../../shared/constants.js';
import { toWords } from '../../../shared/toWords.js';
import { getDb, saveDatabase } from '../db/pool.js';

const router = express.Router();

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
  const cgst = parseFloat((subtotal * CGST_RATE).toFixed(2));
  const sgst = parseFloat((subtotal * SGST_RATE).toFixed(2));
  const total = parseFloat((subtotal + cgst + sgst).toFixed(2));
  const receivedAmount = received_amount != null ? parseFloat(received_amount) : total;
  const balance = parseFloat((total - receivedAmount).toFixed(2));
  const saleDate = sale_date ? new Date(sale_date) : new Date();
  const amountInWords = toWords(total);

  // Step 3 — run transaction using raw SQLite to avoid saveDatabase interference
  const db = getDb();
  
  try {
    console.log('SALE: Starting transaction');
    
    // Start transaction
    db.exec('BEGIN TRANSACTION');
    console.log('SALE: Transaction started');
    
    // 3a. generate invoice number - query actual sales table to avoid conflicts
    const period = String(saleDate.getFullYear()).slice(-2) + String(saleDate.getMonth() + 1).padStart(2, '0');
    console.log('SALE: Period:', period);
    
    // Find the highest existing invoice number for this period
    console.log('SALE: Querying for existing invoices with pattern:', `TYR-${period}-%`);
    const existingInvoices = get(`
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
    
    // Also update the sequence table for consistency (but don't rely on it)
    try {
      runNoSave('UPDATE invoice_sequences SET last_sequence = $seq WHERE yymm = $period', { 
        seq: nextSeq, 
        period 
      });
    } catch (e) {
      console.log('SALE: Warning - could not update sequence table:', e.message);
    }

    console.log('SALE: Checking/updating customer');
    // 3b. upsert customer
    const existingCustomer = get('SELECT id FROM customers WHERE phone = $phone', { phone: customer_phone });
    let customerId;
    
    if (existingCustomer) {
      runNoSave('UPDATE customers SET name = $name, vehicle_reg = $vehicle_reg WHERE id = $id', {
        name: customer_name,
        vehicle_reg: vehicle_reg || null,
        id: existingCustomer.id
      });
      customerId = existingCustomer.id;
    } else {
      const newCustomer = get(`
        INSERT INTO customers (id, name, phone, vehicle_reg)
        VALUES ((lower(hex(randomblob(16)))), $name, $phone, $vehicle_reg)
        RETURNING id, name, phone
      `, {
        name: customer_name,
        phone: customer_phone,
        vehicle_reg: vehicle_reg || null
      });
      customerId = newCustomer.id;
    }

    const customer = get('SELECT id, name, phone FROM customers WHERE id = $id', { id: customerId });

    // 3c. check stock availability AND get cost prices in one query
    const productDetails = [];
    for (const item of parsedItems) {
      const product = get(`
        SELECT id, stock_qty, company_name, size_spec, cost_price, hsn_code
        FROM products 
        WHERE id = $id AND is_deleted = 0
      `, { id: item.product_id });
      
      if (!product) {
        db.exec('ROLLBACK');
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }
      
      if (product.stock_qty < item.qty) {
        db.exec('ROLLBACK');
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.company_name} ${product.size_spec}. Available: ${product.stock_qty}, Requested: ${item.qty}` 
        });
      }
      
      // Store cost price for this item
      item.unitCost = product.cost_price || 0;
      productDetails.push(product);
    }

    // 3d. insert sale
    const sale = get(`
      INSERT INTO sales (id, customer_id, user_id, invoice_number, subtotal, cgst, sgst, total, received_amount, balance, sale_date, notes)
      VALUES ((lower(hex(randomblob(16)))), $customer_id, $user_id, $invoice_number, $subtotal, $cgst, $sgst, $total, $received_amount, $balance, $sale_date, $notes)
      RETURNING id
    `, {
      customer_id: customer.id,
      user_id: req.user.id,
      invoice_number: invoiceNumber,
      subtotal,
      cgst,
      sgst,
      total,
      received_amount: receivedAmount,
      balance,
      sale_date: saleDate.toISOString(),
      notes: notes || ''
    });
    const saleId = sale.id;

    // 3e. insert sale items with unit_cost and deduct stock
    for (const item of parsedItems) {
      runNoSave(`
        INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price, unit_cost, gst_rate, gst_amount, amount)
        VALUES ((lower(hex(randomblob(16)))), $sale_id, $product_id, $qty, $unit_price, $unit_cost, $gst_rate, $gst_amount, $amount)
      `, {
        sale_id: saleId,
        product_id: item.product_id,
        qty: item.qty,
        unit_price: item.unitPrice,
        unit_cost: item.unitCost,
        gst_rate: item.gstRate,
        gst_amount: item.gstAmount,
        amount: item.amount
      });
      
      runNoSave(`
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

    runNoSave(`
      INSERT INTO invoices (id, sale_id, invoice_data, public_token)
      VALUES ((lower(hex(randomblob(16)))), $sale_id, $invoice_data, $public_token)
    `, {
      sale_id: saleId,
      invoice_data: JSON.stringify(invoiceData),
      public_token: publicToken
    });

    // Commit transaction
    db.exec('COMMIT');
    saveDatabase();

    // Step 4 — send response
    return res.status(201).json({
      sale_id: saleId,
      invoice_number: invoiceNumber,
      total,
      subtotal,
      cgst,
      sgst,
      customer_phone: customer.phone,
      customer_name: customer.name,
      amount_in_words: amountInWords,
      invoice_url: `${process.env.APP_BASE_URL || 'http://localhost:4000'}/invoice/${invoiceNumber}`
    });

  } catch (err) {
    // Rollback on any error
    try { db.exec('ROLLBACK'); } catch (_) {}
    
    console.error('POST /sales failed:', err.message);
    console.error('Error stack:', err.stack);
    
    return res.status(500).json({ error: 'Failed to process sale. Please try again.' });
  }
});

router.get('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), (req, res) => {
  try {
    const { from, to } = req.query;
    
    let query = `
      SELECT s.id, s.invoice_number, s.total, s.received_amount, s.balance, s.created_at,
             c.name as customer_name, c.phone as customer_phone, u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    
    const params = {};
    
    if (from) {
      query += ` AND s.created_at >= $from`;
      params.from = from;
    }
    
    if (to) {
      query += ` AND s.created_at <= $to`;
      params.to = to;
    }
    
    query += ' ORDER BY s.created_at DESC';
    
    const result = all(query, params);
    res.json(result);
  } catch (err) {
    console.error('Get sales error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), (req, res) => {
  try {
    const { id } = req.params;
    
    const sale = get(`
      SELECT s.id, s.invoice_number, s.subtotal, s.cgst, s.sgst, s.total, 
             s.received_amount, s.balance, s.notes, s.created_at,
             c.name as customer_name, c.phone as customer_phone,
             u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = $id
    `, { id });
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const items = all(`
      SELECT si.qty, si.unit_price, si.unit_cost, si.gst_rate, si.gst_amount, si.amount,
             p.company_name, p.size_spec
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $sale_id
    `, { sale_id: id });
    
    res.json({ ...sale, items });
  } catch (err) {
    console.error('Get sale error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
