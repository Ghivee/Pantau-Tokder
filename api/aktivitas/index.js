import { requireAnyAuth } from '../../src/middlewares/sessionAuth.js';
import { createAuditMiddleware } from '../../src/utils/auditLog.js';
import { userMutationLimiter } from '../../src/middlewares/rateLimit.js';
import db from '../../src/config/db.js';

const TUGAS = ['Riset harga cabai', 'Buat thumbnail', 'Cek SEO & tag', 'Balas komentar', 'Edit video', 'Lainnya'];

function todayWib(offsetDays = 0) {
  const d = new Date(Date.now() + 7 * 3600 * 1000 - offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

const auditCreate = createAuditMiddleware('aktivitas', 'create', (req, body) => body?.id, (req) => req.body);
const auditDelete = createAuditMiddleware('aktivitas', 'delete', (req) => req.query.id);

async function handler(req, res) {
  if (req.method === 'GET') {
    await new Promise((resolve, reject) => {
      requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

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
      if (!req.isAdmin && req.editor) {
        params.push(req.editor.id);
        sql += ` AND editor_id = $${params.length}`;
      }
      sql += ' ORDER BY tanggal, jam';
      const result = await db.query(sql, params);
      return res.json(result.rows);
    } catch (err) {
      return res.status(500).json({ error: 'Gagal mengambil aktivitas' });
    }
  }

  if (req.method === 'POST') {
    await new Promise((resolve, reject) => {
      requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

    await new Promise((resolve, reject) => userMutationLimiter(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});
    await new Promise((resolve, reject) => auditCreate(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});

    try {
      const b = req.body || {};
      const editorId = req.isAdmin ? Number(b.editor_id) : (req.editor && req.editor.id);
      const tanggal = String(b.tanggal || todayWib());
      const jam = String(b.jam || '');
      const tugas = String(b.tugas || '').trim().slice(0, 60);
      const jumlah = Math.max(1, Math.min(9999, parseInt(b.jumlah, 10) || 1));

      if (!editorId) return res.status(400).json({ error: 'Pilih karyawan' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return res.status(400).json({ error: 'Format tanggal harus YYYY-MM-DD' });
      if (!/^\d{2}:\d{2}$/.test(jam)) return res.status(400).json({ error: 'Format jam harus HH:MM' });
      if (!tugas) return res.status(400).json({ error: 'Jenis tugas wajib diisi' });
      if (!req.isAdmin && tanggal < todayWib(2)) {
        return res.status(403).json({ error: 'Karyawan hanya bisa mencatat aktivitas 2 hari terakhir' });
      }

      const result = await db.query(
        `INSERT INTO aktivitas (editor_id, tanggal, jam, tugas, detail, jumlah, channel_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jam, tugas, detail, jumlah, channel_id, created_at`,
        [editorId, tanggal, jam, tugas, String(b.detail || '').slice(0, 300), jumlah, b.channel_id || null]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      return res.status(500).json({ error: 'Gagal mencatat aktivitas' });
    }
  }

  if (req.method === 'DELETE') {
    await new Promise((resolve, reject) => {
      requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

    await new Promise((resolve, reject) => userMutationLimiter(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});
    await new Promise((resolve, reject) => auditDelete(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});

    try {
      const { id } = req.query;
      const row = await db.query('SELECT editor_id, created_at FROM aktivitas WHERE id = $1', [id]);
      if (!row.rows.length) return res.status(404).json({ error: 'Aktivitas tidak ditemukan' });
      const own = req.editor && row.rows[0].editor_id === req.editor.id;
      const fresh = Date.now() - new Date(row.rows[0].created_at).getTime() < 24 * 3600 * 1000;
      if (!req.isAdmin && !(own && fresh)) {
        return res.status(403).json({ error: 'Hanya pemilik atau pencatatnya (dalam 24 jam) yang bisa menghapus' });
      }
      await db.query('DELETE FROM aktivitas WHERE id = $1', [id]);
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: 'Gagal menghapus aktivitas' });
    }
  }

  if (req.method === 'GET' && req.url.includes('/jenis')) {
    await new Promise((resolve, reject) => {
      requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });
    return res.json(TUGAS);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;