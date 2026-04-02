import express from 'express';
import { get, all } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

router.get('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const result = await all('SELECT id, name, contact_person, phone, email, gstin, created_at FROM suppliers ORDER BY name');
    res.json(result);
  } catch (err) {
    console.error('Get suppliers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const { name, contact_person, phone, email, gstin } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Supplier name required' });
    }
    
    const result = await get(`
      INSERT INTO suppliers (name, contact_person, phone, email, gstin)
      VALUES ($name, $contact_person, $phone, $email, $gstin)
      RETURNING id, name, contact_person, phone, email, gstin, created_at
    `, { name, contact_person, phone, email, gstin });
    
    res.status(201).json(result);
  } catch (err) {
    console.error('Create supplier error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
