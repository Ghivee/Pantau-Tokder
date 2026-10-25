const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const db = require('../config/db');
const dataService = require('../services/dataService');
const { getAuthUrl, exchangeCodeForTokens, fetchOwnChannel } = require('../integrations/analytics');
const analyticsService = require('../services/analyticsService');
const { getChannelIds, getChannelNames } = require('../services/channelService');
const {
  verifyPin, verifyAdminPassword, saveAdminPassword, startSession, endSession, revokeAdminSessions, requireAdmin,
} = require('../middlewares/sessionAuth');
const { authLimiter, editorLoginLimiter } = require('../middlewares/rateLimit');
const { tooManyFailures, recordFailure, clearFailures, WINDOW_MIN } = require('../middlewares/loginGuard');
const { createAuditMiddleware } = require('../utils/auditLog');
const { clientIp } = require('../utils/clientIp');
const { escapeHtml } = require('../utils/html');

const OAUTH_COOKIE = 'pt_oauth';
const secure = () => (process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '');

function redirectUri(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'pantautokder.vercel.app';
  return `${protocol}://${host}/api/auth/callback`;
}

function page(res, status, title, body) {
  res.status(status).send(`<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
    <body style="font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F4F6F2;color:#17201B">
    <div style="max-width:440px;margin:16px;padding:28px;background:#fff;border:1px solid #E0E5DE;border-radius:14px">
      <h2 style="margin:0 0 8px;font-size:20px">${escapeHtml(title)}</h2>${body}
    </div></body></html>`);
}

const back = '<p style="margin-top:18px"><a href="/pengaturan">Kembali ke Pengaturan</a></p>';

// GET /api/auth/google — owner starts connecting a channel to YouTube Analytics
router.get('/google', requireAdmin, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({ error: 'GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diatur di Vercel Environment Variables.' });
  }
  // A one-time value tied to this browser, so a link from someone else cannot connect their account here.
  const state = crypto.randomBytes(24).toString('base64url');
  res.append('Set-Cookie', `${OAUTH_COOKIE}=${state}; HttpOnly${secure()}; SameSite=Lax; Path=/api/auth; Max-Age=600`);
  res.redirect(getAuthUrl(redirectUri(req), state));
});

// GET /api/auth/callback — Google redirects here after the owner grants access
router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const expected = ((req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${OAUTH_COOKIE}=([A-Za-z0-9_-]+)`)) || [])[1];
  res.append('Set-Cookie', `${OAUTH_COOKIE}=; HttpOnly${secure()}; SameSite=Lax; Path=/api/auth; Max-Age=0`);

  if (error) return page(res, 400, 'Akses ditolak', `<p>Google menjawab: ${escapeHtml(error)}</p>${back}`);
  if (!req.isAdmin) return page(res, 401, 'Sesi pemilik tidak ditemukan', `<p>Masuk sebagai pemilik dulu, lalu hubungkan channel dari Pengaturan.</p>${back}`);
  if (!code || !state || !expected || state !== expected) {
    return page(res, 400, 'Permintaan tidak valid', `<p>Tautan ini kedaluwarsa atau bukan dari aplikasi ini. Ulangi dari Pengaturan.</p>${back}`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri(req));
    if (!tokens.refresh_token) throw new Error('Google tidak mengirim refresh token. Coba hubungkan ulang.');
    const channel = await fetchOwnChannel(tokens.access_token);
    if (!channel) throw new Error('Akun yang dipilih tidak punya channel YouTube.');
    await analyticsService.saveConnection(channel, tokens.refresh_token);

    // Pull the channel's daily numbers right away so the Analytics page fills in.
    try { await analyticsService.syncChannelDaily(channel.id, tokens.access_token); } catch (e) { console.warn('First analytics sync failed:', e.message); }

    return page(res, 200, `${channel.nama} terhubung`, `
      <p style="margin:0 0 18px;color:#44524A;line-height:1.5">YouTube Analytics untuk channel ini sudah tersambung. Untuk channel lain, klik tombol di bawah lalu pilih channel tersebut di layar Google.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="/api/auth/google" style="padding:10px 16px;border-radius:9px;border:1px solid #C9D1C7;color:#17201B;text-decoration:none;font-weight:600">Hubungkan channel lain</a>
        <a href="/analytics" style="padding:10px 16px;border-radius:9px;background:#1E6B45;color:#fff;text-decoration:none;font-weight:600">Lihat Analytics</a>
      </div>`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return page(res, 500, 'Gagal menyimpan token', `<p>${escapeHtml(err.message)}</p>${back}`);
  }
});

// GET /api/auth/status — which monitored channels have YouTube Analytics connected
router.get('/status', async (req, res) => {
  try {
    res.json(await dataService.oauthStatus());
  } catch (err) {
    fail(res, err, 'Tidak dapat memeriksa status YouTube Analytics');
  }
});

// DELETE /api/auth/google/:channelId — owner disconnects one channel's analytics
router.delete('/google/:channelId', requireAdmin, createAuditMiddleware('auth', 'disconnect_analytics', (req) => req.params.channelId), async (req, res) => {
  try {
    await analyticsService.removeConnection(req.params.channelId);
    res.status(204).send();
  } catch (err) {
    fail(res, err);
  }
});

const TOO_MANY = `Terlalu banyak percobaan yang salah. Coba lagi dalam ${WINDOW_MIN} menit.`;

// POST /api/auth/login — owner sign-in
router.post('/login', authLimiter, async (req, res) => {
  const password = String((req.body || {}).password || '');
  if (!password) return res.status(400).json({ error: 'Password wajib diisi' });
  const keys = ['admin', 'ip:' + clientIp(req)];
  try {
    if (await tooManyFailures(keys, 8)) return res.status(429).json({ error: TOO_MANY });
    if (!(await verifyAdminPassword(password))) {
      await recordFailure(keys);
      return res.status(401).json({ error: 'Password salah' });
    }
    await clearFailures(keys);
    await startSession(res, { tipe: 'admin' });
    res.json({ success: true, role: 'admin' });
  } catch (err) {
    fail(res, err, 'Gagal memverifikasi password');
  }
});

// POST /api/auth/editor-login — employee sign-in with their PIN
router.post('/editor-login', editorLoginLimiter, async (req, res) => {
  const { editor_id, pin } = req.body || {};
  if (!editor_id || !pin) return res.status(400).json({ error: 'Pilih nama dan isi PIN' });
  if (!/^\d+$/.test(String(editor_id))) return res.status(400).json({ error: 'Karyawan tidak dikenal' });
  const keys = ['editor:' + editor_id, 'ip:' + clientIp(req)];
  try {
    if (await tooManyFailures(keys, 6)) return res.status(429).json({ error: TOO_MANY });
    const result = await db.query(`SELECT id, nama, peran, pin, foto_url FROM editors WHERE id = $1 AND status = 'aktif'`, [editor_id]);
    const row = result.rows[0];
    if (!row || !row.pin) return res.status(401).json({ error: 'PIN belum diatur untuk karyawan ini. Minta pemilik mengaturnya.' });
    if (!verifyPin(pin, row.pin)) {
      await recordFailure(keys);
      return res.status(401).json({ error: 'PIN salah' });
    }
    await clearFailures(keys);
    await startSession(res, { tipe: 'karyawan', editorId: row.id });
    res.json({ id: row.id, nama: row.nama, peran: row.peran || 'editor', foto_url: row.foto_url });
  } catch (err) {
    fail(res, err, 'Gagal memverifikasi PIN');
  }
});

// POST /api/auth/logout — ends this session on the server too
router.post('/logout', async (req, res) => {
  try {
    await endSession(req, res);
    res.json({ success: true });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/auth/me — who is signed in (checked against the database, not trusted from the cookie)
router.get('/me', (req, res) => {
  if (req.isAdmin) return res.json({ authenticated: true, type: 'admin' });
  if (req.editor) return res.json({ authenticated: true, type: 'karyawan', ...req.editor });
  res.json({ authenticated: false });
});

// POST /api/auth/password — owner changes the password; every other owner session is signed out
router.post('/password', requireAdmin, createAuditMiddleware('auth', 'password_change'), async (req, res) => {
  const baru = String((req.body || {}).baru || '');
  if (baru.length < 8) return res.status(400).json({ error: 'Password baru minimal 8 karakter' });
  if (baru.length > 200) return res.status(400).json({ error: 'Password baru terlalu panjang' });
  try {
    await saveAdminPassword(baru);
    await revokeAdminSessions();
    await startSession(res, { tipe: 'admin' });
    res.json({ success: true });
  } catch (err) {
    fail(res, err, 'Gagal menyimpan password');
  }
});

module.exports = router;
