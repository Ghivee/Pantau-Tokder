const express = require('express');
const { bisaLihatUang } = require('../utils/izin');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const analyticsService = require('../services/analyticsService');
const { retentionCurve } = require('../integrations/analytics');
const { requireAnyAuth, requireRole } = require('../middlewares/sessionAuth');
const { createAuditMiddleware } = require('../utils/auditLog');
const { checkIdempotency } = require('../middlewares/rateLimit');

const { content: listContent, LIST_COLUMNS, samarkan } = require('../services/dataService');

router.get('/', async (req, res) => {
  try {
    const { editor_id, platform, status } = req.query;
    res.json(await listContent({ isAdmin: req.isAdmin, selfId: req.editor && req.editor.id, editorId: req.isAdmin ? editor_id : null, platform, status }));
  } catch (err) {
    fail(res, err);
  }
});

// One video with its retention curve. When none is stored yet, it is asked from YouTube Analytics
// right away (at most every 6 hours per video) and the answer says why a curve is missing.
router.get('/:id', async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) throw bad(400, 'ID video tidak valid');
    const r = await db.query(
      `SELECT ${LIST_COLUMNS}, retention_data, retention_source,
         (retention_cek IS NOT NULL AND retention_cek > NOW() - INTERVAL '6 hours') AS baru_dicek
       FROM content WHERE id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) throw bad(404, 'Video tidak ditemukan');
    const v = r.rows[0];
    if (!bisaLihatUang(req)) delete v.revenue;
    if (!req.isAdmin) samarkan(v, req.editor.id);
    v.retensi_status = v.retention_data ? 'ada' : 'belum_ada';
    if (!v.retention_data && v.channel_id && !v.baru_dicek) {
      let token = null;
      try {
        token = await analyticsService.accessTokenFor(v.channel_id);
      } catch (e) {
        v.retensi_status = 'error';
        v.retensi_pesan = e.message;
      }
      if (!token && v.retensi_status !== 'error') v.retensi_status = 'tidak_tersambung';
      if (token) {
        try {
          const curve = await retentionCurve(v.post_id, token);
          await db.query(
            `UPDATE content SET retention_cek = NOW(), retention_data = COALESCE($1, retention_data),
               retention_source = CASE WHEN $1::jsonb IS NULL THEN retention_source ELSE 'youtube' END WHERE id = $2`,
            [curve.length ? JSON.stringify(curve) : null, v.id]
          );
          if (curve.length) { v.retention_data = curve; v.retention_source = 'youtube'; v.retensi_status = 'ada'; }
        } catch (e) {
          v.retensi_status = 'error';
          v.retensi_pesan = 'YouTube Analytics menolak: ' + e.message;
        }
      }
    }
    delete v.baru_dicek;
    res.json(v);
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
    // An employee can claim an unrecognized video as their own, nothing else.
    if (!req.isAdmin && editorId !== req.editor.id) throw bad(403, 'Anda hanya bisa menetapkan video sebagai milik Anda sendiri');
    const ed = await db.query(`SELECT id FROM editors WHERE id = $1 AND status <> 'nonaktif'`, [editorId]);
    if (!ed.rows.length) throw bad(400, 'Karyawan tidak ditemukan atau nonaktif');
    const r = await db.query(`UPDATE content SET editor_id = $1, status_identifikasi = $2 WHERE id = $3${req.isAdmin ? '' : ' AND editor_id IS NULL'}`, [editorId, 'matched', id]);
    if (!r.rowCount) throw bad(404, req.isAdmin ? 'Video tidak ditemukan' : 'Video tidak ditemukan atau sudah ada pembuatnya');
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
    if (!req.isAdmin && editorId !== req.editor.id) {
      return res.status(403).json({ error: 'Anda hanya bisa menetapkan video sebagai milik Anda sendiri' });
    }
    // Verify editor exists and is active
    const ed = await db.query(`SELECT id FROM editors WHERE id = $1 AND status <> 'nonaktif'`, [editorId]);
    if (!ed.rows.length) {
      return res.status(400).json({ error: 'Karyawan tidak ditemukan atau nonaktif' });
    }
    // Verify all videos exist
    const placeholders = video_ids.map((_, i) => `$${i + 1}`).join(',');
    const videos = await db.query(
      `SELECT id FROM content WHERE id IN (${placeholders})${req.isAdmin ? '' : ' AND editor_id IS NULL'}`,
      video_ids
    );
    if (videos.rows.length !== video_ids.length) {
      return res.status(400).json({ error: req.isAdmin ? 'Beberapa video tidak ditemukan' : 'Beberapa video tidak ditemukan atau sudah ada pembuatnya' });
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