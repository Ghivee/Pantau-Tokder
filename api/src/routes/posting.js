const express = require('express');
const { Readable } = require('stream');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const { sign } = require('../utils/encryption');
const posting = require('../services/postingService');
const { requireAnyAuth } = require('../middlewares/sessionAuth');

const { createAuditMiddleware } = require('../utils/auditLog');
const { requireIzin, bisa } = require('../utils/izin');
const { susunDeskripsi } = require('../utils/deskripsi');

const base = (req) => (process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'tokder.vercel.app'}`).replace(/\/+$/, '');
const idOf = (req) => { if (!/^\d+$/.test(req.params.id)) throw bad(400, 'Posting tidak dikenal'); return Number(req.params.id); };

// Video dari karyawan membawa kodenya di deskripsi (mis. #AL), supaya sinkronisasi mengenali pembuatnya.
function sisipKode(deskripsi, kode) {
  const k = String(kode || '').replace(/^#/, '').trim();
  const teks = String(deskripsi || '');
  if (!k) return teks;
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])#?${esc}($|[^A-Za-z0-9])`, 'i').test(teks) ? teks : (teks.trimEnd() + '\n#' + k).trim();
}

async function denganKode(req, deskripsi) {
  if (!req.editor) return deskripsi;
  const r = await db.query('SELECT kode_identifikasi FROM editors WHERE id = $1', [req.editor.id]);
  return sisipKode(deskripsi, r.rows[0] && r.rows[0].kode_identifikasi);
}
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
        if (!bisa(req, 'upload')) throw bad(req.editor ? 403 : 401, req.editor ? 'Peran Anda tidak boleh mengunggah' : 'Masuk dulu');
        return { allowedContentTypes: VIDEO_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
    });
    res.json(out);
  } catch (err) { fail(res, err, 'Izin unggah ditolak'); }
});

// POST /api/posting/deskripsi: menyusun deskripsi siap pakai dari judul dan tautan pelacak yang dipilih.
router.post('/deskripsi', requireIzin('upload'), async (req, res) => {
  try {
    const b = req.body || {};
    const kode = (Array.isArray(b.tautan) ? b.tautan : []).map((x) => String(x).toLowerCase()).filter((x) => /^[a-z0-9]{3,16}$/.test(x)).slice(0, 10);
    const r = kode.length ? await db.query('SELECT kode, label FROM tautan WHERE kode = ANY($1)', [kode]) : { rows: [] };
    const label = new Map(r.rows.map((x) => [x.kode, x.label]));
    const tautan = kode.filter((k) => label.has(k)).map((k) => ({ label: label.get(k), url: `${base(req)}/go/${k}` }));
    res.json({ deskripsi: susunDeskripsi({ judul: String(b.judul || '').slice(0, 100), tautan }) });
  } catch (err) { fail(res, err); }
});

router.get('/', requireAnyAuth, async (req, res) => { try { res.json(await posting.daftar()); } catch (err) { fail(res, err); } });

// POST /api/posting: video is already in Blob; prepare it on every chosen account (as drafts)
router.post('/', requireIzin('upload'), createAuditMiddleware('posting', 'create', () => 'baru'), async (req, res) => {
  try {
    const b = req.body || {};
    const ids = (a) => (Array.isArray(a) ? a.filter((x) => /^\d+$/.test(String(x))).map(Number) : []);
    const yt = Array.isArray(b.youtube) ? b.youtube.filter((x) => /^UC[\w-]{22}$/.test(String(x))) : [];
    const deskripsi = await denganKode(req, b.deskripsi);
    res.status(201).json(await posting.buat({ judul: b.judul, deskripsi, blob_url: b.blob_url, ukuran: b.ukuran, mime: b.mime, sosmedIds: ids(b.akun), youtubeIds: yt, editorId: req.editor ? req.editor.id : null }, base(req)));
  } catch (err) { fail(res, err); }
});

router.post('/:id/segarkan', requireAnyAuth, async (req, res) => { try { res.json(await posting.segarkan(idOf(req))); } catch (err) { fail(res, err); } });
router.post('/:id/tayang', requireIzin('tayang'), createAuditMiddleware('posting', 'publish', (req) => req.params.id), async (req, res) => { try { res.json(await posting.tayangkan(idOf(req))); } catch (err) { fail(res, err); } });
router.delete('/:id', requireIzin('hapus'), createAuditMiddleware('posting', 'delete', (req) => req.params.id), async (req, res) => { try { await posting.hapus(idOf(req)); res.status(204).send(); } catch (err) { fail(res, err); } });

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
module.exports.sisipKode = sisipKode;
