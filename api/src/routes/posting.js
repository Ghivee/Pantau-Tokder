const express = require('express');
const { Readable } = require('stream');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const { sign } = require('../utils/encryption');
const posting = require('../services/postingService');
const { requireAdmin } = require('../middlewares/sessionAuth');
const { createAuditMiddleware } = require('../utils/auditLog');

const base = (req) => (process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'pantautokder.vercel.app'}`).replace(/\/+$/, '');
const idOf = (req) => { if (!/^\d+$/.test(req.params.id)) throw bad(400, 'Posting tidak dikenal'); return Number(req.params.id); };
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

// POST /api/posting/blob: the browser asks for permission to upload one video straight to Vercel Blob
// (the video never passes through this server). Open to Vercel's own completion call, so the owner
// check is made inside onBeforeGenerateToken.
router.post('/blob', async (req, res) => {
  try {
    const { handleUpload } = require('@vercel/blob/client');
    const out = await handleUpload({
      body: req.body, request: req,
      onBeforeGenerateToken: async () => {
        if (!req.isAdmin) throw bad(401, 'Masuk sebagai pemilik dulu');
        return { allowedContentTypes: VIDEO_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
    });
    res.json(out);
  } catch (err) { fail(res, err, 'Izin unggah ditolak'); }
});

router.get('/', requireAdmin, async (req, res) => { try { res.json(await posting.daftar()); } catch (err) { fail(res, err); } });

// POST /api/posting: video is already in Blob; prepare it on every chosen account (as drafts)
router.post('/', requireAdmin, createAuditMiddleware('posting', 'create', () => 'baru'), async (req, res) => {
  try {
    const b = req.body || {};
    const ids = (a) => (Array.isArray(a) ? a.filter((x) => /^\d+$/.test(String(x))).map(Number) : []);
    const yt = Array.isArray(b.youtube) ? b.youtube.filter((x) => /^UC[\w-]{22}$/.test(String(x))) : [];
    res.status(201).json(await posting.buat({ judul: b.judul, deskripsi: b.deskripsi, blob_url: b.blob_url, ukuran: b.ukuran, mime: b.mime, sosmedIds: ids(b.akun), youtubeIds: yt }, base(req)));
  } catch (err) { fail(res, err); }
});

router.post('/:id/segarkan', requireAdmin, async (req, res) => { try { res.json(await posting.segarkan(idOf(req))); } catch (err) { fail(res, err); } });
router.post('/:id/tayang', requireAdmin, createAuditMiddleware('posting', 'publish', (req) => req.params.id), async (req, res) => { try { res.json(await posting.tayangkan(idOf(req))); } catch (err) { fail(res, err); } });
router.delete('/:id', requireAdmin, createAuditMiddleware('posting', 'delete', (req) => req.params.id), async (req, res) => { try { await posting.hapus(idOf(req)); res.status(204).send(); } catch (err) { fail(res, err); } });

// GET /api/posting/media/:id/:sig: the address TikTok pulls the video from. TikTok only accepts
// addresses under a domain verified in its portal, so the video is passed through our own address.
// The link carries a signature only this server can make, and it supports Range requests.
router.get('/media/:id/:sig', async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id) || req.params.sig !== sign(req.params.id)) return res.status(404).end();
    const r = await db.query('SELECT blob_url, mime FROM posting WHERE id = $1', [req.params.id]);
    if (!r.rows[0] || !r.rows[0].blob_url) return res.status(404).end();
    const up = await fetch(r.rows[0].blob_url, { headers: req.headers.range ? { Range: req.headers.range } : {} });
    if (!up.ok && up.status !== 206) return res.status(502).end();
    res.status(up.status);
    res.setHeader('Content-Type', up.headers.get('content-type') || r.rows[0].mime || 'video/mp4');
    for (const h of ['content-length', 'content-range', 'accept-ranges']) if (up.headers.get(h)) res.setHeader(h, up.headers.get(h));
    res.setHeader('Cache-Control', 'private, no-store');
    Readable.fromWeb(up.body).pipe(res);
  } catch (err) { if (!res.headersSent) res.status(502).end(); }
});

// YouTube uploads are done by a GitHub Actions job that signs in with CRON_SECRET.
const cron = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Tidak diizinkan' });
  next();
};
router.get('/yt/antrean', cron, async (req, res) => { try { res.json(await posting.antreanYoutube()); } catch (err) { fail(res, err); } });
router.post('/yt/:id/hasil', cron, async (req, res) => { try { await posting.hasilYoutube(idOf(req), req.body || {}); res.json({ ok: true }); } catch (err) { fail(res, err); } });

module.exports = router;
