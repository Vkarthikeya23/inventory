import express from 'express';
import { get, all, run } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

function buildPoUrl(poNumber) {
  const base = (process.env.APP_BASE_URL || 'http://localhost:4000').replace(/\/+$/g, '');
  return `${base}/po/${poNumber}`;
}

// POST /purchase-orders — save a generated PO (any logged-in role)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { po_data, supplier_phone } = req.body;

    if (!po_data || !Array.isArray(po_data.items) || po_data.items.length === 0) {
      return res.status(400).json({ error: 'PO items required' });
    }

    const hasInvalidItem = po_data.items.some(
      item => !item || typeof item !== 'object' || !String(item.name || '').trim()
    );
    if (hasInvalidItem) {
      return res.status(400).json({ error: 'Each PO item requires a product name' });
    }

    // Generate PO number: PO-YYMM-NNNNN (same pattern as invoice numbers)
    const now = new Date();
    const period = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');
    const existing = await get(`
      SELECT po_number FROM purchase_orders
      WHERE po_number LIKE $pattern
      ORDER BY po_number DESC
      LIMIT 1
    `, { pattern: `PO-${period}-%` });

    let nextSeq = 1;
    if (existing) {
      const parts = existing.po_number.split('-');
      if (parts.length === 3) {
        nextSeq = parseInt(parts[2], 10) + 1 || 1;
      }
    }
    const poNumber = `PO-${period}-${String(nextSeq).padStart(5, '0')}`;

    const totalAmount = parseFloat(po_data.total_amount) || 0;
    const itemCount = po_data.items.length;

    await run(`
      INSERT INTO purchase_orders (po_number, po_data, supplier_phone, total_amount, item_count, created_by)
      VALUES ($po_number, $po_data, $supplier_phone, $total_amount, $item_count, $created_by)
    `, {
      po_number: poNumber,
      po_data: JSON.stringify(po_data),
      supplier_phone: supplier_phone || null,
      total_amount: totalAmount,
      item_count: itemCount,
      created_by: req.user.id || null
    });

    res.status(201).json({ po_number: poNumber, po_url: buildPoUrl(poNumber) });
  } catch (err) {
    console.error('Create purchase order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /purchase-orders — list saved POs (owner + manager)
router.get('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const rows = await all(`
      SELECT id, po_number, supplier_phone, total_amount, item_count, created_by, created_at
      FROM purchase_orders
      ORDER BY created_at DESC
      LIMIT 200
    `);

    res.json(rows.map(row => ({
      ...row,
      total_amount: parseFloat(row.total_amount || 0),
      item_count: parseInt(row.item_count || 0, 10),
      po_url: buildPoUrl(row.po_number)
    })));
  } catch (err) {
    console.error('Get purchase orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /purchase-orders/:id — remove a saved PO (owner only)
router.delete('/:id', verifyToken, requireRole(ROLES.OWNER), async (req, res) => {
  try {
    const deleted = await get(
      'DELETE FROM purchase_orders WHERE id = $id RETURNING id',
      { id: req.params.id }
    );

    if (!deleted) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete purchase order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
