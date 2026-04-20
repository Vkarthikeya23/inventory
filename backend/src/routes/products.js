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

router.get('/', verifyToken, async (req, res) => {
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
        hsn_code,
        is_deleted,
        created_at,
        COALESCE(company_name, '') || ' ' || COALESCE(size_spec, '') as display_name
      FROM products
      WHERE is_deleted = false
    `;
    
    const params = {};
    
    if (search) {
      query += ` AND (company_name ILIKE $search OR size_spec ILIKE $search OR display_name ILIKE $search)`;
      params.search = `%${search}%`;
    }
    
    query += ' ORDER BY company_name, size_spec';
    
    const result = await all(query, params);
    
    // If search is provided and results found, calculate combined stock for matching company
    let brandStockSummary = null;
    if (search && result.length > 0) {
      // Get unique company names from results
      const companyNames = [...new Set(result.map(p => p.company_name))];
      
      if (companyNames.length === 1) {
        // Single company match - calculate total stock
        const companyName = companyNames[0];
        
        const stockResult = await get(`
          SELECT 
            company_name,
            SUM(stock_qty) as total_stock,
            COUNT(*) as product_count
          FROM products
          WHERE is_deleted = false 
            AND company_name ILIKE $company_name
          GROUP BY company_name
        `, { company_name: companyName });
        
        if (stockResult) {
          brandStockSummary = {
            company_name: stockResult.company_name,
            total_stock: parseInt(stockResult.total_stock) || 0,
            product_count: parseInt(stockResult.product_count) || 0
          };
        }
      }
    }
    
    res.json({
      products: result,
      brand_summary: brandStockSummary
    });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
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
      stock_qty = 0,
      hsn_code = ''
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
    
    const result = await get(`
      INSERT INTO products (
        id,
        company_name, 
        size_spec, 
        cost_price, 
        selling_price_excl_gst, 
        selling_price_incl_gst, 
        gst_rate, 
        price_entry_mode, 
        stock_qty,
        hsn_code
      )
      VALUES ($id, $company_name, $size_spec, $cost_price, $selling_price_excl_gst, $selling_price_incl_gst, $gst_rate, $price_entry_mode, $stock_qty, $hsn_code)
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
        hsn_code,
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
      stock_qty,
      hsn_code: hsn_code || ''
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

router.put('/:id', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log('PUT /products/:id - Product ID:', id);
    console.log('PUT /products/:id - Request body:', updates);
    
    // Get current product to know the GST rate
    const currentProduct = await get('SELECT gst_rate FROM products WHERE id = $id AND is_deleted = false', { id });
    if (!currentProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Handle GST rate update
    let gstRate = updates.gst_rate !== undefined ? parseFloat(updates.gst_rate) : (currentProduct.gst_rate || 12);
    
    // Handle selling price updates with the GST rate (either updated or current)
    if ('selling_price_excl_gst' in updates) {
      const { sellingPriceExcl, sellingPriceIncl } = calculatePrices(updates.selling_price_excl_gst, gstRate, 'excl');
      updates.selling_price_excl_gst = sellingPriceExcl;
      updates.selling_price_incl_gst = sellingPriceIncl;
    } else if ('selling_price_incl_gst' in updates) {
      const { sellingPriceExcl, sellingPriceIncl } = calculatePrices(updates.selling_price_incl_gst, gstRate, 'incl');
      updates.selling_price_excl_gst = sellingPriceExcl;
      updates.selling_price_incl_gst = sellingPriceIncl;
    }
    
    const allowedFields = ['company_name', 'size_spec', 'cost_price', 'selling_price_excl_gst', 'selling_price_incl_gst', 'stock_qty', 'gst_rate'];
    const fields = [];
    const values = {};
    
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
    
    const result = await get(`
      UPDATE products SET ${fields.join(', ')} WHERE id = $id
      RETURNING 
        id, company_name, size_spec, cost_price, 
        selling_price_excl_gst, selling_price_incl_gst, gst_rate, 
        stock_qty, is_deleted, created_at,
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

router.delete('/:id', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('DELETE /products/:id - Product ID:', id);
    
    // Check if product exists
    const product = await get('SELECT id, company_name, size_spec FROM products WHERE id = $id', { id });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Check if product is referenced in sales
    const salesCheck = await get('SELECT COUNT(*) as count FROM sale_items WHERE product_id = $id', { id });
    if (salesCheck.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product that has sales history. Use stock = 0 to hide it instead.' 
      });
    }
    
    // Permanently delete the product
    await run('DELETE FROM products WHERE id = $id', { id });
    
    console.log('DELETE /products/:id - Product deleted:', id);
    res.json({ 
      message: 'Product deleted permanently',
      id: id,
      display_name: `${product.company_name} ${product.size_spec}`
    });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
