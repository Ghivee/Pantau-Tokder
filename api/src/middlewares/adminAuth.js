const crypto = require('crypto');
const db = require('../config/db');

function hashPin(pin) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  if (!pin || !stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

async function adminPassword() {
  const result = await db.query(`SELECT value FROM settings WHERE key = 'admin_password'`);
  return result.rows.length > 0 && result.rows[0].value ? result.rows[0].value : 'admin123'; // Default to admin123
}

// Works out who is calling: the owner (admin password) or an employee (editor id + PIN).
async function identify(req) {
  req.isAdmin = false;
  req.editor = null;
  const providedPassword = req.headers['x-admin-password'];
  if (providedPassword && providedPassword === (await adminPassword())) req.isAdmin = true;

  const editorId = req.headers['x-editor-id'];
  const pin = req.headers['x-editor-pin'];
  if (editorId && pin) {
    const r = await db.query(`SELECT id, nama, peran, pin FROM editors WHERE id = $1 AND status = 'aktif'`, [editorId]);
    if (r.rows.length && verifyPin(pin, r.rows[0].pin)) {
      const { id, nama, peran } = r.rows[0];
      req.editor = { id, nama, peran: peran || 'editor' };
    }
  }
}

async function requireAdmin(req, res, next) {
  // Only protect POST, PUT, DELETE requests
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next();

  // Exempt login endpoints
  if (req.originalUrl.includes('/api/auth/login') || req.originalUrl.includes('/api/auth/editor-login')) {
    return next();
  }

  // Check if it's the cron job hitting /api/scan
  const isCron = req.originalUrl.includes('/api/scan') &&
    (req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}` || req.headers['user-agent'] === 'vercel-cron/1.0');
  if (isCron) return next();

  try {
    await identify(req);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Gagal memeriksa akses' });
  }

  if (req.isAdmin) return next();

  // Employees may log their own activities; a full editor may also assign unidentified videos.
  if (req.editor && req.originalUrl.startsWith('/api/aktivitas')) return next();
  if (req.editor && req.editor.peran === 'editor' && /^\/api\/content\/\d+\/assign/.test(req.originalUrl)) return next();

  if (!req.headers['x-admin-password'] && !req.headers['x-editor-pin']) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }
  return res.status(401).json({ error: 'Akses ditolak untuk akun ini' });
}

module.exports = requireAdmin;
module.exports.hashPin = hashPin;
module.exports.verifyPin = verifyPin;
module.exports.adminPassword = adminPassword;
