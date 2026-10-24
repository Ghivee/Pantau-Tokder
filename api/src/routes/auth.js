const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const { getAuthUrl, exchangeCodeForTokens, fetchOwnChannel } = require('../integrations/analytics');
const analyticsService = require('../services/analyticsService');
const { getChannelIds, getChannelNames } = require('../services/channelService');
const { verifyPin, createSessionPayload, setSessionCookie, clearSessionCookie } = require('../middlewares/sessionAuth');
const { authLimiter, editorLoginLimiter } = require('../middlewares/rateLimit');
const { createAuditMiddleware, logAudit } = require('../utils/auditLog');

// GET /api/auth/google — Redirect user to Google OAuth consent screen
router.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({ 
      error: 'GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diatur di Vercel Environment Variables.' 
    });
  }
  
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'pantautokder.vercel.app';
  const redirectUri = `${protocol}://${host}/api/auth/callback`;
  
  const url = getAuthUrl(redirectUri);
  res.redirect(url);
});

// GET /api/auth/callback — Google redirects here after user grants access
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.send(`<html><body style="font-family:sans-serif; padding:40px; text-align:center;">
      <h2>❌ Akses Ditolak</h2>
      <p>${error}</p>
      <a href="/">Kembali ke Dashboard</a>
    </body></html>`);
  }

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'pantautokder.vercel.app';
    const redirectUri = `${protocol}://${host}/api/auth/callback`;

    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) throw new Error('Google tidak mengirim refresh token. Coba hubungkan ulang.');
    const channel = await fetchOwnChannel(tokens.access_token);
    if (!channel) throw new Error('Akun yang dipilih tidak punya channel YouTube.');
    await analyticsService.saveConnection(channel, tokens.refresh_token);

    // Pull the channel's daily numbers right away so the Analytics page fills in.
    try { await analyticsService.syncChannelDaily(channel.id, tokens.access_token); } catch (e) { console.warn('First analytics sync failed:', e.message); }

    const safe = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": "'" }[c]));
    return res.send(`<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Channel terhubung</title></head>
      <body style="font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F4F6F2;color:#17201B">
      <div style="max-width:440px;margin:16px;padding:28px;background:#fff;border:1px solid #E0E5DE;border-radius:14px">
        <h2 style="margin:0 0 8px;font-size:20px">${safe(channel.nama)} terhubung</h2>
        <p style="margin:0 0 18px;color:#44524A;line-height:1.5">YouTube Analytics untuk channel ini sudah tersambung. Untuk channel lain, klik tombol di bawah lalu pilih channel tersebut di layar Google.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="/api/auth/google" style="padding:10px 16px;border-radius:9px;border:1px solid #C9D1C7;color:#17201B;text-decoration:none;font-weight:600">Hubungkan channel lain</a>
          <a href="/#analytics" style="padding:10px 16px;border-radius:9px;background:#1E6B45;color:#fff;text-decoration:none;font-weight:600">Lihat Analytics</a>
        </div>
      </div></body></html>`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.status(500).send(`<html><body style="font-family:sans-serif; padding:40px; text-align:center;">
      <h2>❌ Gagal menyimpan token</h2>
      <p>${err.message}</p>
      <a href="/">Kembali ke Dashboard</a>
    </body></html>`);
  }
});

// GET /api/auth/status — which monitored channels have YouTube Analytics connected
router.get('/status', async (req, res) => {
  try {
    await analyticsService.migrateLegacyToken();
    const [connections, ids, names] = await Promise.all([analyticsService.listConnections(), getChannelIds(), getChannelNames()]);
    const byId = Object.fromEntries(connections.map((c) => [c.channel_id, c]));
    const all = [...new Set([...ids, ...connections.map((c) => c.channel_id)])];
    const channels = all.map((id) => ({
      id,
      nama: names[id] || (byId[id] && byId[id].nama) || id,
      connected: !!byId[id],
      connected_at: byId[id] ? byId[id].updated_at : null,
    }));
    res.json({ connected: connections.length > 0, channels });
  } catch (err) {
    res.json({ connected: false, channels: [], message: 'Tidak dapat memeriksa status: ' + err.message });
  }
});

// DELETE /api/auth/google/:channelId — owner disconnects one channel's analytics
router.delete('/google/:channelId', createAuditMiddleware('auth', 'disconnect_analytics', (req) => req.params.channelId), async (req, res) => {
  try {
    await analyticsService.removeConnection(req.params.channelId);
    res.status(204).send();
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/auth/login — Admin password verification
router.post('/login', authLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    const result = await db.query(`SELECT value FROM settings WHERE key = 'admin_password'`);
    const correctPassword = result.rows.length > 0 && result.rows[0].value ? result.rows[0].value : 'admin123';
    
    if (password === correctPassword) {
      const session = createSessionPayload({ type: 'admin', password });
      setSessionCookie(res, session);
      res.json({ success: true, message: 'Login berhasil', role: 'admin' });
    } else {
      res.status(401).json({ error: 'Password salah' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Gagal memverifikasi password' });
  }
});

// POST /api/auth/editor-login — Employee sign-in with their PIN
router.post('/editor-login', editorLoginLimiter, async (req, res) => {
  const { editor_id, pin } = req.body || {};
  if (!editor_id || !pin) return res.status(400).json({ error: 'Pilih nama dan isi PIN' });
  try {
    const result = await db.query(
      `SELECT id, nama, peran, pin, foto_url FROM editors WHERE id = $1 AND status = 'aktif'`,
      [editor_id]
    );
    const row = result.rows[0];
    if (!row || !row.pin) return res.status(401).json({ error: 'PIN belum diatur untuk karyawan ini. Minta pemilik mengaturnya.' });
    if (!verifyPin(pin, row.pin)) return res.status(401).json({ error: 'PIN salah' });
    const session = createSessionPayload({ type: 'karyawan', id: row.id, nama: row.nama, peran: row.peran || 'editor', pin });
    setSessionCookie(res, session);
    res.json({ id: row.id, nama: row.nama, peran: row.peran || 'editor', foto_url: row.foto_url });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memverifikasi PIN' });
  }
});

// POST /api/auth/logout — Clear session cookie
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true, message: 'Logout berhasil' });
});

// GET /api/auth/me — Get current session info (for frontend to restore UI state)
router.get('/me', (req, res) => {
  const { parseSessionCookie } = require('../middlewares/sessionAuth');
  const session = parseSessionCookie(req);
  if (!session) return res.json({ authenticated: false });
  
  if (session.type === 'admin') {
    return res.json({ authenticated: true, type: 'admin' });
  }
  if (session.type === 'karyawan') {
    return res.json({ authenticated: true, type: 'karyawan', id: session.id, nama: session.nama, peran: session.peran });
  }
  return res.json({ authenticated: false });
});

// POST /api/auth/password — Owner changes the admin password
router.post('/password', createAuditMiddleware('auth', 'password_change'), async (req, res) => {
  if (!req.isAdmin) return res.status(401).json({ error: 'Hanya pemilik yang bisa mengganti password' });
  const baru = String((req.body || {}).baru || '');
  if (baru.length < 8) return res.status(400).json({ error: 'Password baru minimal 8 karakter' });
  try {
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('admin_password', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [baru]
    );
    // Update session cookie with new password
    const session = createSessionPayload({ type: 'admin', password: baru });
    setSessionCookie(res, session);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan password' });
  }
});

module.exports = router;