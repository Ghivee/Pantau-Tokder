const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const { requireAnyAuth, requireRole } = require('../middlewares/sessionAuth');
const { createAuditMiddleware } = require('../utils/auditLog');
const { checkIdempotency } = require('../middlewares/rateLimit');

// List without the retention curves (they are large); latest numbers are stored on each row.
const LIST_COLUMNS = `id, post_id, platform, url, judul, tanggal_upload, editor_id, status_identifikasi, tipe_video,
  duration_secs, channel_id, channel_nama, revenue, views, likes, comments, stats_at,
  (retention_data IS NOT NULL) AS punya_retensi`;

router.get('/', async (req, res) => {
  try {
    const { editor_id, platform, status } = req.query;
    let query = `SELECT ${LIST_COLUMNS} FROM content WHERE 1=1`;
    const params = [];
    if (editor_id && editor_id !== 'all') { params.push(editor_id); query += ` AND editor_id = $${params.length}`; }
    if (platform && platform !== 'all') { params.push(platform); query += ` AND platform = $${params.length}`; }
    if (status) { params.push(status); query += ` AND status_identifikasi = $${params.length}`; }
    query += ' ORDER BY tanggal_upload DESC';
    const result = await db.query(query, params);
    // Revenue is for the owner only.
    if (!req.isAdmin) result.rows.forEach((r) => { delete r.revenue; });
    // Cache 1 menit, stale-while-revalidate 5 menit
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(result.rows);
  } catch (err) {
    fail(res, err);
  }
});

// One video with its retention curve
router.get('/:id', async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) throw bad(400, 'ID video tidak valid');
    const r = await db.query(`SELECT ${LIST_COLUMNS}, retention_data, retention_source FROM content WHERE id = $1`, [req.params.id]);
    if (!r.rows.length) throw bad(404, 'Video tidak ditemukan');
    if (!req.isAdmin) delete r.rows[0].revenue;
    res.json(r.rows[0]);
  } catch (err) {
    fail(res, err);
  }
});

router.post('/:id/assign', requireRole('editor'), checkIdempotency, createAuditMiddleware('content', 'assign', (req) => req.params.id, (req) => ({ editor_id: req.body?.editor_id }), (req, body) => ({ editor_id: body?.editor_id })), async (req, res) => {
  try {
    const { id } = req.params;
    const editorId = Number((req.body || {}).editor_id);
    if (!/^\d+$/.test(id)) throw bad(400, 'ID video tidak valid');
    if (!Number.isInteger(editorId) || editorId <= 0) throw bad(400, 'Pilih karyawan');
    const ed = await db.query(`SELECT id FROM editors WHERE id = $1 AND status <> 'nonaktif'`, [editorId]);
    if (!ed.rows.length) throw bad(400, 'Karyawan tidak ditemukan atau nonaktif');
    const r = await db.query('UPDATE content SET editor_id = $1, status_identifikasi = $2 WHERE id = $3', [editorId, 'matched', id]);
    if (!r.rowCount) throw bad(404, 'Video tidak ditemukan');
    res.json({ message: 'Success' });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/content/bulk-assign — Assign multiple videos to an editor (with hardening)
router.post('/bulk-assign', requireRole('editor'), checkIdempotency, async (req, res) => {
  try {
    const { video_ids, editor_id } = req.body || {};
    if (!Array.isArray(video_ids) || video_ids.length === 0) {
      return res.status(400).json({ error: 'video_ids harus array non-kosong' });
    }
    if (video_ids.length > 50) {
      return res.status(400).json({ error: 'Maksimal 50 video per bulk-assign' });
    }
    const editorId = Number(editor_id);
    if (!Number.isInteger(editorId) || editorId <= 0) {
      return res.status(400).json({ error: 'editor_id tidak valid' });
    }
    // Verify editor exists and is active
    const ed = await db.query(`SELECT id FROM editors WHERE id = $1 AND status <> 'nonaktif'`, [editorId]);
    if (!ed.rows.length) {
      return res.status(400).json({ error: 'Karyawan tidak ditemukan atau nonaktif' });
    }
    // Verify all videos exist
    const placeholders = video_ids.map((_, i) => `$${i + 1}`).join(',');
    const videos = await db.query(
      `SELECT id FROM content WHERE id IN (${placeholders})`,
      video_ids
    );
    if (videos.rows.length !== video_ids.length) {
      return res.status(400).json({ error: 'Beberapa video tidak ditemukan' });
    }
    // Bulk update
    await db.query(
      `UPDATE content SET editor_id = $1, status_identifikasi = 'matched' WHERE id IN (${placeholders})`,
      [editorId, ...video_ids]
    );
    res.json({ message: 'Success', assigned: video_ids.length });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;