const crypto = require('crypto');
const db = require('../config/db');
const { bad } = require('../utils/httpError');
const { resolve: resolveIzin } = require('../utils/izin');

const SESSION_COOKIE_NAME = 'pt_session';
const SESSION_DAYS = 30;
const HASH_FORMAT = /^[0-9a-f]{16}:[0-9a-f]{64}$/;

function hashPin(pin) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  if (!pin || !stored || !HASH_FORMAT.test(stored)) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(pin), salt, 32);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), test);
}

function sameText(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

async function saveAdminPassword(password) {
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('admin_password', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [hashPin(password)]
  );
}

// Checks the owner password. There is no built-in default: the first password comes from the
// ADMIN_PASSWORD environment variable, after that it is stored hashed in the database.
// A password saved in plain text by older versions is upgraded to a hash on the first sign-in.
async function verifyAdminPassword(password) {
  if (!password) return false;
  const r = await db.query(`SELECT value FROM settings WHERE key = 'admin_password'`);
  const stored = r.rows[0] && r.rows[0].value;
  if (stored) {
    if (HASH_FORMAT.test(stored)) return verifyPin(password, stored);
    if (!sameText(password, stored)) return false;
    await saveAdminPassword(password);
    return true;
  }
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (!fromEnv) throw bad(503, 'Password pemilik belum diatur. Isi ADMIN_PASSWORD di Environment Variables Vercel, lalu masuk dengan password itu.');
  if (!sameText(password, fromEnv)) return false;
  await saveAdminPassword(password);
  return true;
}

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

function readToken(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([A-Za-z0-9_-]{43})(?:;|$)`));
  return m ? m[1] : null;
}

function writeCookie(res, value, maxAge) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${SESSION_COOKIE_NAME}=${value}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}

// Starts a session: the browser gets a random token, the database keeps only its hash.
async function startSession(res, { tipe, editorId = null, hari = SESSION_DAYS }) {
  const umur = Math.min(SESSION_DAYS, Math.max(1, Math.floor(Number(hari)) || SESSION_DAYS));
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO sesi (token_hash, tipe, editor_id, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '${umur} days')`,
    [tokenHash(token), tipe, editorId]
  );
  db.query(`DELETE FROM sesi WHERE expires_at < NOW()`).catch(() => {});
  writeCookie(res, token, umur * 86400);
}

async function endSession(req, res) {
  const token = readToken(req);
  if (token) await db.query(`DELETE FROM sesi WHERE token_hash = $1`, [tokenHash(token)]);
  writeCookie(res, '', 0);
}

const revokeAdminSessions = () => db.query(`DELETE FROM sesi WHERE tipe = 'admin'`);
const revokeEditorSessions = (editorId) => db.query(`DELETE FROM sesi WHERE editor_id = $1`, [editorId]);

// Works out who is calling from the session cookie. Employees who were deactivated or
// removed lose access straight away.
async function identify(req, res, next) {
  req.isAdmin = false;
  req.editor = null;
  try {
    const token = readToken(req);
    if (token) {
      const r = await db.query(
        `SELECT s.tipe, e.id, e.nama, e.peran, e.status, e.lihat_penghasilan, e.izin FROM sesi s LEFT JOIN editors e ON e.id = s.editor_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
        [tokenHash(token)]
      );
      const row = r.rows[0];
      if (row && row.tipe === 'admin') req.isAdmin = true;
      if (row && row.tipe === 'karyawan' && row.id && row.status === 'aktif') {
        const r = resolveIzin(row);
        req.editor = { id: row.id, nama: row.nama, peran: row.peran || 'editor', izin: r.izin, izinTersimpan: r.tersimpan, uang: r.izin.uang === true };
      }
    }
  } catch (err) {
    return next(err);
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.isAdmin) return next();
  return res.status(req.editor ? 403 : 401).json({ error: 'Hanya pemilik yang bisa melakukan ini' });
}

function requireEditor(req, res, next) {
  if (req.editor) return next();
  return res.status(403).json({ error: 'Hanya karyawan yang bisa melakukan ini' });
}

function requireAnyAuth(req, res, next) {
  if (req.isAdmin || req.editor) return next();
  return res.status(401).json({ error: 'Silakan masuk terlebih dahulu' });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (req.isAdmin) return next();
    if (req.editor && allowedRoles.includes(req.editor.peran)) return next();
    return res.status(req.editor ? 403 : 401).json({ error: 'Peran Anda tidak punya izin untuk ini' });
  };
}

module.exports = {
  hashPin,
  verifyPin,
  verifyAdminPassword,
  saveAdminPassword,
  startSession,
  endSession,
  revokeAdminSessions,
  revokeEditorSessions,
  identify,
  requireAdmin,
  requireEditor,
  requireAnyAuth,
  requireRole,
  SESSION_COOKIE_NAME,
};
