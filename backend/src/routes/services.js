import express from 'express';
import { run, get, all } from '../db/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../../../shared/constants.js';

const router = express.Router();

// Create a new service
router.post('/', verifyToken, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res) => {
  try {
    const { service_name, price } = req.body;
    
    if (!service_name || !price) {
      return res.status(400).json({ error: 'Service name and price are required' });
    }
    
    await run(`
      INSERT INTO services (id, service_name, price, created_at)
      VALUES (gen_random_uuid(), $service_name, $price, CURRENT_TIMESTAMP)
    `, {
      service_name,
      price: parseFloat(price)
    });
    
    res.status(201).json({ message: 'Service added successfully' });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Failed to add service' });
  }
});

// Get all services
router.get('/', verifyToken, async (req, res) => {
  try {
    const services = await all(`
      SELECT * FROM services
      ORDER BY service_name ASC
    `);
    
    res.json(services);
  } catch (err) {
    console.error('Fetch services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

export default router;
