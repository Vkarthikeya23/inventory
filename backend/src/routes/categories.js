import express from 'express';
import { get, all } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await all('SELECT id, name, description, created_at FROM categories ORDER BY name');
    res.json(result);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name required' });
    }
    
    const result = await get('INSERT INTO categories (name, description) VALUES ($name, $description) RETURNING id, name, description, created_at', { name, description: description || null });
    
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
