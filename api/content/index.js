import { requireAnyAuth, requireRole } from '../../src/middlewares/sessionAuth.js';
import { createAuditMiddleware } from '../../src/utils/auditLog.js';
import { checkIdempotency } from '../../src/middlewares/rateLimit.js';
import db from '../../src/config/db.js';

const LIST_COLUMNS = `id, post_id, platform, url, judul, tanggal_upload, editor_id, status_identifikasi, tipe_video,
  duration_secs, channel_id, channel_nama, revenue, views, likes, comments, stats_at,
  (retention_data IS NOT NULL) AS punya_retensi`;

const auditAssign = createAuditMiddleware('content', 'assign', (req) => req.query.id, (req) => ({ editor_id: req.body?.editor_id }), (req, body) => ({ editor_id: body?.editor_id }));

async function handler(req, res) {
  if (req.method === 'GET') {
    await new Promise((resolve, reject) => {
      requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

    try {
      const { editor_id, platform, status } = req.query;
      let query = `SELECT ${LIST_COLUMNS} FROM content WHERE 1=1`;
      const params = [];
      if (editor_id && editor_id !== 'all') { params.push(editor_id); query += ` AND editor_id = $${params.length}`; }
      if (platform && platform !== 'all') { params.push(platform); query += ` AND platform = $${params.length}`; }
      if (status) { params.push(status); query += ` AND status_identifikasi = $${params.length}`; }
      query += ' ORDER BY tanggal_upload DESC';
      const result = await db.query(query, params);
      if (!req.isAdmin) result.rows.forEach((r) => { delete r.revenue; });
      return res.json(result.rows);
    } catch (err) {
      return res.status(500).json({ error: 'Gagal mengambil data konten' });
    }
  }

  if (req.method === 'POST') {
    await new Promise((resolve, reject) => {
      requireRole('editor')(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(403).json({ error: 'Akses ditolak' }); });

    await new Promise((resolve, reject) => checkIdempotency(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});
    await new Promise((resolve, reject) => auditAssign(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});

    try {
      const { id } = req.query;
      const editorId = Number((req.body || {}).editor_id);
      if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID video tidak valid' });
      if (!Number.isInteger(editorId) || editorId <= 0) return res.status(400).json({ error: 'Pilih karyawan' });
      const ed = await db.query(`SELECT id FROM editors WHERE id = $1 AND status <> 'nonaktif'`, [editorId]);
      if (!ed.rows.length) return res.status(400).json({ error: 'Karyawan tidak ditemukan atau nonaktif' });
      const r = await db.query('UPDATE content SET editor_id = $1, status_identifikasi = $2 WHERE id = $3', [editorId, 'matched', id]);
      if (!r.rowCount) return res.status(404).json({ error: 'Video tidak ditemukan' });
      return res.json({ message: 'Success' });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal menetapkan pembuat' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;