const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const { identify } = require('../middlewares/adminAuth');

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
    await identify(req).catch(() => {});
    if (!req.isAdmin) result.rows.forEach((r) => { delete r.revenue; });
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
    await identify(req).catch(() => {});
    if (!req.isAdmin) delete r.rows[0].revenue;
    res.json(r.rows[0]);
  } catch (err) {
    fail(res, err);
  }
});

router.post('/:id/assign', async (req, res) => {
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

module.exports = router;
