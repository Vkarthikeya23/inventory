import express from 'express';
import { get, all, run, transaction } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

router.get('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const result = await all(`
      SELECT po.id, po.supplier_id, s.name as supplier_name, po.status, po.notes,
             po.created_by, u.name as created_by_name, po.created_at,
             COUNT(poi.id) as item_count
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by = u.id
      LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
      GROUP BY po.id, s.name, u.name
      ORDER BY po.created_at DESC
    `);
    res.json(result);
  } catch (err) {
    console.error('Get purchase orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    
    const po = await get(`
      SELECT po.id, po.supplier_id, s.name as supplier_name, po.status, po.notes,
             po.created_by, u.name as created_by_name, po.created_at
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.id = $id
    `, { id });
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    const items = await all(`
      SELECT poi.id, poi.product_id, p.name as product_name, poi.qty_ordered,
             poi.qty_received, poi.unit_cost
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      WHERE poi.po_id = $po_id
    `, { po_id: id });
    
    res.json({ ...po, items });
  } catch (err) {
    console.error('Get purchase order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const { supplier_id, items, notes } = req.body;
    
    if (!supplier_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Supplier and items required' });
    }
    
    const insertPO = await transaction(async (client) => {
      const po = await get(`
        INSERT INTO purchase_orders (supplier_id, status, notes, created_by)
        VALUES ($supplier_id, 'draft', $notes, $created_by)
        RETURNING id
      `, { supplier_id, notes, created_by: req.user.id });
      
      const poId = po.id;
      
      for (const item of items) {
        await run(`
          INSERT INTO purchase_order_items (po_id, product_id, qty_ordered, unit_cost)
          VALUES ($po_id, $product_id, $qty_ordered, $unit_cost)
        `, {
          po_id: poId,
          product_id: item.product_id,
          qty_ordered: item.qty_ordered,
          unit_cost: item.unit_cost
        });
      }
      
      return poId;
    });
    
    res.status(201).json({ id: insertPO, status: 'draft' });
  } catch (err) {
    console.error('Create purchase order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/receive', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }
    
    await transaction(async (client) => {
      for (const item of items) {
        await run('UPDATE purchase_order_items SET qty_received = $qty_received WHERE id = $id', { qty_received: item.qty_received, id: item.po_item_id });
        
        const poItem = await get('SELECT product_id, qty_received FROM purchase_order_items WHERE id = $id', { id: item.po_item_id });
        await run('UPDATE products SET stock_qty = stock_qty + $qty WHERE id = $id', { qty: poItem.qty_received, id: poItem.product_id });
      }
      
      await run("UPDATE purchase_orders SET status = 'received' WHERE id = $id", { id });
    });
    
    res.json({ status: 'received' });
  } catch (err) {
    console.error('Receive purchase order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
