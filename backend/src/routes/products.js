import express from 'express';
import { get, all, run } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// Helper function to calculate prices
function calculatePrices(price, gstRate, mode) {
  const rate = parseFloat(gstRate) || 12;
  const priceValue = parseFloat(price) || 0;
  
  if (mode === 'excl') {
    const sellingPriceExcl = priceValue;
    const sellingPriceIncl = Math.round(sellingPriceExcl * (1 + rate / 100) * 100) / 100;
    return { sellingPriceExcl, sellingPriceIncl };
  } else {
    const sellingPriceIncl = priceValue;
    const sellingPriceExcl = Math.round(sellingPriceIncl / (1 + rate / 100) * 100) / 100;
    return { sellingPriceExcl, sellingPriceIncl };
  }
}

router.get('/', verifyToken, (req, res) => {
  try {
    const { search } = req.query;
    
    let query = `
      SELECT 
        id,
        company_name,
        size_spec,
        cost_price,
        selling_price_excl_gst,
        selling_price_incl_gst,
        gst_rate,
        price_entry_mode,
        stock_qty,
        is_deleted,
        created_at,
        COALESCE(company_name, '') || ' ' || COALESCE(size_spec, '') as display_name
      FROM products
      WHERE is_deleted = 0
    `;
    
    const params = {};
    
    if (search) {
      query += ` AND (company_name LIKE $search OR size_spec LIKE $search)`;
      params.search = `%${search}%`;
    }
    
    query += ' ORDER BY company_name, size_spec';
    
    const result = all(query, params);
    res.json(result);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), (req, res) => {
  try {
    console.log('POST /products - Request body:', req.body);
    
    const { 
      company_name, 
      size_spec, 
      cost_price, 
      selling_price_excl_gst,
      selling_price_incl_gst,
      gst_rate = 12,
      price_entry_mode = 'excl',
      stock_qty = 0 
    } = req.body;
    
    if (!company_name || !size_spec) {
      return res.status(400).json({ error: 'Company name and size specification are required' });
    }
    
    // Validate that at least one price is provided
    if (!selling_price_excl_gst && !selling_price_incl_gst) {
      return res.status(400).json({ error: 'Selling price is required' });
    }
    
    // Parse numeric values
    const costPrice = parseFloat(cost_price) || null;
    const gstRate = parseFloat(gst_rate) || 12;
    const stockQty = parseInt(stock_qty) || 0;
    
    let sellingPriceExcl = parseFloat(selling_price_excl_gst);
    let sellingPriceIncl = parseFloat(selling_price_incl_gst);
    
    // Calculate missing price if needed
    if (isNaN(sellingPriceExcl) || isNaN(sellingPriceIncl)) {
      const priceToUse = !isNaN(sellingPriceExcl) ? sellingPriceExcl : sellingPriceIncl;
      const mode = !isNaN(sellingPriceExcl) ? 'excl' : 'incl';
      const calculated = calculatePrices(priceToUse, gstRate, mode);
      sellingPriceExcl = calculated.sellingPriceExcl;
      sellingPriceIncl = calculated.sellingPriceIncl;
    }
    
    // Generate UUID for new product
    const productId = randomUUID();
    
    const result = get(`
      INSERT INTO products (
        id,
        company_name, 
        size_spec, 
        cost_price, 
        selling_price_excl_gst, 
        selling_price_incl_gst, 
        gst_rate, 
        price_entry_mode, 
        stock_qty
      )
      VALUES ($id, $company_name, $size_spec, $cost_price, $selling_price_excl_gst, $selling_price_incl_gst, $gst_rate, $price_entry_mode, $stock_qty)
      RETURNING 
        id, 
        company_name, 
        size_spec, 
        cost_price, 
        selling_price_excl_gst, 
        selling_price_incl_gst, 
        gst_rate, 
        price_entry_mode, 
        stock_qty, 
        is_deleted, 
        created_at,
        COALESCE(company_name, '') || ' ' || COALESCE(size_spec, '') as display_name
    `, {
      id: productId,
      company_name,
      size_spec,
      cost_price: cost_price || null,
      selling_price_excl_gst: sellingPriceExcl,
      selling_price_incl_gst: sellingPriceIncl,
      gst_rate,
      price_entry_mode,
      stock_qty
    });
    
    res.status(201).json(result);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

router.put('/:id', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log('PUT /products/:id - Product ID:', id);
    console.log('PUT /products/:id - Request body:', updates);
    
    // Check if stock_qty is being set to 0 (soft delete)
    if ('stock_qty' in updates && parseInt(updates.stock_qty) === 0) {
      const result = get(`
        UPDATE products 
        SET is_deleted = 1, stock_qty = 0 
        WHERE id = $id 
        RETURNING 
          id,
          company_name,
          size_spec,
          COALESCE(company_name, '') || ' ' || COALESCE(size_spec, '') as display_name
      `, { id });
      
      if (!result) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      return res.json({ 
        deleted: true, 
        id: result.id, 
        display_name: result.display_name 
      });
    }
    
    // Get current product to know the GST rate if not provided
    // Check without is_deleted filter so we can update soft-deleted products
    const currentProduct = get('SELECT gst_rate FROM products WHERE id = $id', { id });
    if (!currentProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // If selling_price_excl_gst is being updated, recalculate selling_price_incl_gst
    if ('selling_price_excl_gst' in updates) {
      const gstRate = updates.gst_rate || currentProduct.gst_rate || 12;
      const { sellingPriceExcl, sellingPriceIncl } = calculatePrices(updates.selling_price_excl_gst, gstRate, 'excl');
      updates.selling_price_excl_gst = sellingPriceExcl;
      updates.selling_price_incl_gst = sellingPriceIncl;
    }
    
    const allowedFields = ['company_name', 'size_spec', 'cost_price', 'selling_price_excl_gst', 'selling_price_incl_gst', 'gst_rate', 'price_entry_mode', 'stock_qty', 'is_deleted'];
    const fields = [];
    const values = {};
    
    // Always set is_deleted = false when updating (restocking a deleted product)
    fields.push('is_deleted = 0');
    
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${key}`);
        values[key] = updates[key];
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.id = id;
    
    const result = get(`
      UPDATE products SET ${fields.join(', ')}, created_at = created_at WHERE id = $id
      RETURNING 
        id, 
        company_name, 
        size_spec, 
        cost_price, 
        selling_price_excl_gst, 
        selling_price_incl_gst, 
        gst_rate, 
        price_entry_mode, 
        stock_qty, 
        is_deleted, 
        created_at,
        COALESCE(company_name, '') || ' ' || COALESCE(size_spec, '') as display_name
    `, values);
    
    if (!result) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
