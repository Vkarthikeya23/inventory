import express from 'express';
import { get } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

router.post('/:sale_id/send', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), (req, res) => {
  try {
    const { sale_id } = req.params;
    
    const invoice = get(`
      SELECT i.public_token, s.invoice_number
      FROM invoices i
      JOIN sales s ON s.id = i.sale_id
      WHERE i.sale_id = $sale_id
    `, { sale_id });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoiceUrl = `${process.env.APP_BASE_URL || 'http://localhost:4000'}/invoice/${invoice.invoice_number}`;
    
    res.json({ invoice_url: invoiceUrl });
  } catch (err) {
    console.error('Get invoice URL error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
