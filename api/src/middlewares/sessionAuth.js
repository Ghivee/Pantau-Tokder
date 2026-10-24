const crypto = require('crypto');
const db = require('../config/db');

const SESSION_COOKIE_NAME = 'pt_session';

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
  return result.rows.length > 0 && result.rows[0].value ? result.rows[0].value : 'admin123';
}

function createSessionPayload(user) {
  if (user.type === 'admin') {
    return { type: 'admin', password: user.password, iat: Date.now() };
  }
  return { type: 'karyawan', id: user.id, nama: user.nama, peran: user.peran, pin: user.pin, iat: Date.now() };
}

function parseSessionCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[2]));
  } catch {
    return null;
  }
}

function setSessionCookie(res, session) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieValue = encodeURIComponent(JSON.stringify(session));
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}${isProd ? '' : ''}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

async function identify(req) {
  req.isAdmin = false;
  req.editor = null;
  req.sessionPayload = null;

  const session = parseSessionCookie(req);
  if (!session) return;

  req.sessionPayload = session;

  if (session.type === 'admin') {
    const correctPassword = await adminPassword();
    if (session.password === correctPassword) {
      req.isAdmin = true;
    }
    return;
  }

  if (session.type === 'karyawan' && session.id) {
    const r = await db.query(`SELECT id, nama, peran, pin FROM editors WHERE id = $1 AND status = 'aktif'`, [session.id]);
    if (r.rows.length) {
      const { id, nama, peran, pin } = r.rows[0];
      if (session.pin && verifyPin(session.pin, pin)) {
        req.editor = { id, nama, peran: peran || 'editor' };
      }
    }
  }
}

function requireAdmin(req, res, next) {
  if (req.isAdmin) return next();
  return res.status(403).json({ error: 'Hanya pemilik yang bisa mengakses' });
}

function requireEditor(req, res, next) {
  if (req.editor) return next();
  return res.status(403).json({ error: 'Akses ditolak untuk akun ini' });
}

function requireAnyAuth(req, res, next) {
  if (req.isAdmin || req.editor) return next();
  return res.status(401).json({ error: 'Unauthorized: Sesi tidak valid' });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (req.isAdmin) return next();
    if (req.editor && allowedRoles.includes(req.editor.peran)) return next();
    return res.status(403).json({ error: 'Peran tidak memiliki izin' });
  };
}

module.exports = {
  hashPin,
  verifyPin,
  adminPassword,
  identify,
  requireAdmin,
  requireEditor,
  requireAnyAuth,
  requireRole,
  createSessionPayload,
  setSessionCookie,
  clearSessionCookie,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
};