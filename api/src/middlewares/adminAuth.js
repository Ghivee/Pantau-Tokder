const db = require('../config/db');

async function requireAdmin(req, res, next) {
  // Only protect POST, PUT, DELETE requests
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    // Exempt login endpoint
    if (req.originalUrl.includes('/api/auth/login')) {
      return next();
    }
    
    // Check if it's the cron job hitting /api/scan
    const isCron = req.originalUrl.includes('/api/scan') && 
      (req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}` || req.headers['user-agent'] === 'vercel-cron/1.0');
    
    if (isCron) {
      return next();
    }

    const providedPassword = req.headers['x-admin-password'];
    if (!providedPassword) {
      return res.status(401).json({ error: 'Unauthorized: Admin password required' });
    }

    try {
      const result = await db.query(`SELECT value FROM settings WHERE key = 'admin_password'`);
      const correctPassword = result.rows.length > 0 && result.rows[0].value ? result.rows[0].value : 'admin123'; // Default to admin123

      if (providedPassword !== correctPassword) {
        return res.status(401).json({ error: 'Unauthorized: Incorrect admin password' });
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to verify admin password' });
    }
  }
  next();
}

module.exports = requireAdmin;
