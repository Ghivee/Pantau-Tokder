const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const sosmed = require('../integrations/sosmed');
const social = require('../services/socialService');
const { requireAdmin } = require('../middlewares/sessionAuth');
const { createAuditMiddleware, logAudit } = require('../utils/auditLog');
const { escapeHtml } = require('../utils/html');

const COOKIE = 'pt_sosmed';
const secure = () => (process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '');
const base = (req) => (process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'pantautokder.vercel.app'}`).replace(/\/+$/, '');
// Register exactly this address as the redirect URI in the TikTok and Meta developer portals.
const redirectUri = (req) => base(req) + '/api/social/callback';

function page(res, status, title, body) {
  res.status(status).send(`<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
    <body style="font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F4F6F2;color:#17201B">
    <div style="max-width:440px;margin:16px;padding:28px;background:#fff;border:1px solid #E0E5DE;border-radius:14px">
      <h2 style="margin:0 0 8px;font-size:20px">${escapeHtml(title)}</h2>${body}
    </div></body></html>`);
}
const back = '<p style="margin-top:18px"><a href="/sosmed">Kembali ke Sosmed</a></p>';

// GET /api/social/connect/:platform: the owner starts connecting an account
router.get('/connect/:platform', requireAdmin, (req, res) => {
  const platform = req.params.platform;
  if (!sosmed.PLATFORMS[platform]) return res.status(404).json({ error: 'Platform tidak dikenal' });
  if (!sosmed.configured(platform)) {
    return page(res, 400, `${sosmed.PLATFORMS[platform].nama} belum diatur`, `<p>Isi ${sosmed.PLATFORMS[platform].env.join(' dan ')} di Vercel Environment Variables, lalu deploy ulang.</p>${back}`);
  }
  const state = crypto.randomBytes(24).toString('base64url');
  res.append('Set-Cookie', `${COOKIE}=${platform}.${state}; HttpOnly${secure()}; SameSite=Lax; Path=/api/social; Max-Age=600`);
  res.redirect(sosmed.authUrl(platform, redirectUri(req), state));
});

// GET /api/social/callback: TikTok / Meta send the owner back here with a one-time code
router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const cookie = ((req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_.-]+)`)) || [])[1] || '';
  res.append('Set-Cookie', `${COOKIE}=; HttpOnly${secure()}; SameSite=Lax; Path=/api/social; Max-Age=0`);
  const [platform, expected] = cookie.split('.');
  if (error) return page(res, 400, 'Akses ditolak', `<p>Platform menjawab: ${escapeHtml(req.query.error_description || error)}</p>${back}`);
  if (!req.isAdmin) return page(res, 401, 'Sesi pemilik tidak ditemukan', `<p>Masuk sebagai pemilik dulu, lalu hubungkan dari menu Sosmed.</p>${back}`);
  if (!sosmed.PLATFORMS[platform] || !code || !state || !expected || state !== expected) {
    return page(res, 400, 'Permintaan tidak valid', `<p>Tautan ini kedaluwarsa atau bukan dari aplikasi ini. Ulangi dari menu Sosmed.</p>${back}`);
  }
  try {
    const uri = redirectUri(req);
    // Instagram appends "#_" to the code; it is not part of it.
    const kode = String(code).replace(/#_$/, '');
    const dihubungkan = [];
    if (platform === 'tiktok') {
      const t = await sosmed.tiktok.exchange(kode, uri);
      const p = await sosmed.tiktok.profile(t.access);
      await social.simpan({ platform, ...t, ...p, pemilik_id: t.user_id });
      dihubungkan.push(p.nama);
    } else if (platform === 'instagram') {
      const t = await sosmed.instagram.exchange(kode, uri);
      const p = await sosmed.instagram.profile(t.access);
      await social.simpan({ platform, ...t, ...p, pemilik_id: t.user_id });
      dihubungkan.push(p.nama);
    } else {
      const t = await sosmed.facebook.exchange(kode, uri);
      if (!t.pages.length) throw new Error('Akun Facebook ini tidak mengelola Page. Pilih Page di layar izin Facebook.');
      for (const pg of t.pages) { await social.simpan({ platform, ...pg, pemilik_id: t.user_id, scope: t.scope }); dihubungkan.push(pg.nama); }
    }
    // First pull right away so the Sosmed page is not empty.
    const { matchEditorCode } = require('../services/scanService');
    const editors = (await db.query(`SELECT * FROM editors WHERE status = 'aktif'`)).rows;
    const rows = (await db.query('SELECT * FROM social_koneksi WHERE platform = $1 AND last_sync IS NULL', [platform])).rows;
    for (const row of rows) await social.sinkron(row, { editors, match: matchEditorCode });
    return page(res, 200, `${sosmed.PLATFORMS[platform].nama} terhubung`, `
      <p style="margin:0 0 18px;color:#44524A;line-height:1.5">${escapeHtml(dihubungkan.join(', '))} sudah tersambung. Aplikasi hanya membaca profil dan statistik; tidak ada yang diposting atau diubah.</p>
      <a href="/sosmed" style="padding:10px 16px;border-radius:9px;background:#1E6B45;color:#fff;text-decoration:none;font-weight:600">Lihat Sosmed</a>`);
  } catch (err) {
    console.error('Social callback error:', err.response ? err.response.data : err.message);
    const d = err.response && err.response.data;
    return page(res, 500, 'Gagal menghubungkan', `<p>${escapeHtml((d && (d.error_description || (d.error && (d.error.message || d.error)))) || err.message)}</p>${back}`);
  }
});

// DELETE /api/social/koneksi/:id: disconnect, which also removes that account's stored posts
router.delete('/koneksi/:id', requireAdmin, createAuditMiddleware('social', 'disconnect', (req) => req.params.id), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) throw bad(400, 'Sambungan tidak dikenal');
    if (!(await social.hapus(Number(req.params.id)))) throw bad(404, 'Sambungan tidak ditemukan');
    res.status(204).send();
  } catch (err) { fail(res, err); }
});

// POST /api/social/sync: pull TikTok / Instagram / Facebook now
router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const { matchEditorCode } = require('../services/scanService');
    const editors = (await db.query(`SELECT * FROM editors WHERE status = 'aktif'`)).rows;
    res.json(await social.sinkronSemua({ editors, match: matchEditorCode }));
  } catch (err) { fail(res, err); }
});

// Meta calls these two addresses itself (no browser, no cookie); a signed_request proves it is Meta.
const secrets = () => [process.env.FACEBOOK_APP_SECRET, process.env.INSTAGRAM_APP_SECRET];
const form = express.urlencoded({ extended: false, limit: '10kb' });

router.post('/meta/deauthorize', form, async (req, res) => {
  const data = sosmed.parseSignedRequest(req.body && req.body.signed_request, secrets());
  if (!data || !data.user_id) return res.status(400).json({ error: 'signed_request tidak valid' });
  try {
    const n = await social.hapusByPemilik(['instagram', 'facebook'], data.user_id);
    logAudit({ actorType: 'system', actorNama: 'Meta', action: 'deauthorize', targetType: 'social', targetId: String(data.user_id), after: { dihapus: n } });
    res.json({ success: true });
  } catch (err) { fail(res, err); }
});

router.post('/meta/data-deletion', form, async (req, res) => {
  const data = sosmed.parseSignedRequest(req.body && req.body.signed_request, secrets());
  if (!data || !data.user_id) return res.status(400).json({ error: 'signed_request tidak valid' });
  try {
    const n = await social.hapusByPemilik(['instagram', 'facebook'], data.user_id);
    const kode = crypto.randomBytes(8).toString('hex');
    logAudit({ actorType: 'system', actorNama: 'Meta', action: 'data_deletion', targetType: 'social', targetId: String(data.user_id), after: { kode, dihapus: n } });
    res.json({ url: `${base(req)}/data-deletion.html?kode=${kode}`, confirmation_code: kode });
  } catch (err) { fail(res, err); }
});

module.exports = router;
