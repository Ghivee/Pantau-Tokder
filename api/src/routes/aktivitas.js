const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const { requireAnyAuth, requireRole } = require('../middlewares/sessionAuth');
const { createAuditMiddleware } = require('../utils/auditLog');
const { userMutationLimiter } = require('../middlewares/rateLimit');

const TUGAS = ['Riset harga cabai', 'Buat thumbnail', 'Cek SEO & tag', 'Balas komentar', 'Edit video', 'Lainnya'];

function todayWib(offsetDays = 0) {
  const d = new Date(Date.now() + 7 * 3600 * 1000 - offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

// GET /api/aktivitas?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&editor_id=1
router.get('/', async (req, res) => {
  try {
    const dari = req.query.dari || todayWib(30);
    const sampai = req.query.sampai || todayWib(0);
    const params = [dari, sampai];
    let sql = `SELECT id, editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jam, tugas, detail, jumlah, channel_id, created_at
               FROM aktivitas WHERE tanggal BETWEEN $1 AND $2`;
    if (req.query.editor_id) {
      params.push(req.query.editor_id);
      sql += ` AND editor_id = $3`;
    }
    // Non-admin users can only see their own activities
    if (!req.isAdmin && req.editor) {
      params.push(req.editor.id);
      sql += ` AND editor_id = $${params.length}`;
    }
    sql += ' ORDER BY tanggal, jam';
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    fail(res, err);
  }
});

router.get('/jenis', (req, res) => res.json(TUGAS));

router.post('/', requireAnyAuth, userMutationLimiter, createAuditMiddleware('aktivitas', 'create', (req, body) => body?.id, (req) => req.body), async (req, res) => {
  try {
    const b = req.body || {};
    // Admin can log for anyone, editors can only log for themselves
    const editorId = req.isAdmin ? Number(b.editor_id) : (req.editor && req.editor.id);
    const tanggal = String(b.tanggal || todayWib());
    const jam = String(b.jam || '');
    const tugas = String(b.tugas || '').trim().slice(0, 60);
    const jumlah = Math.max(1, Math.min(9999, parseInt(b.jumlah, 10) || 1));

    if (!editorId) return res.status(400).json({ error: 'Pilih karyawan' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return res.status(400).json({ error: 'Format tanggal harus YYYY-MM-DD' });
    if (!/^\d{2}:\d{2}$/.test(jam)) return res.status(400).json({ error: 'Format jam harus HH:MM' });
    if (!tugas) return res.status(400).json({ error: 'Jenis tugas wajib diisi' });
    if (tanggal > todayWib()) return res.status(400).json({ error: 'Tanggal tidak boleh di masa depan' });
    // Editors can only log for last 2 days
    if (!req.isAdmin && tanggal < todayWib(2)) {
      return res.status(403).json({ error: 'Karyawan hanya bisa mencatat aktivitas 2 hari terakhir' });
    }

    const result = await db.query(
      `INSERT INTO aktivitas (editor_id, tanggal, jam, tugas, detail, jumlah, channel_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jam, tugas, detail, jumlah, channel_id, created_at`,
      [editorId, tanggal, jam, tugas, String(b.detail || '').slice(0, 300), jumlah, b.channel_id ? String(b.channel_id).slice(0, 40) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    fail(res, err);
  }
});

router.delete('/:id', requireAnyAuth, userMutationLimiter, createAuditMiddleware('aktivitas', 'delete', (req) => req.params.id), async (req, res) => {
  try {
    const row = await db.query('SELECT editor_id, created_at FROM aktivitas WHERE id = $1', [req.params.id]);
    if (!row.rows.length) return res.status(404).json({ error: 'Aktivitas tidak ditemukan' });
    const own = req.editor && row.rows[0].editor_id === req.editor.id;
    const fresh = Date.now() - new Date(row.rows[0].created_at).getTime() < 24 * 3600 * 1000;
    if (!req.isAdmin && !(own && fresh)) {
      return res.status(403).json({ error: 'Hanya pemilik atau pencatatnya (dalam 24 jam) yang bisa menghapus' });
    }
    await db.query('DELETE FROM aktivitas WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;