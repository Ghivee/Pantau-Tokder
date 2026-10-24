import { requireRole } from '../../src/middlewares/sessionAuth.js';
import { checkIdempotency } from '../../src/middlewares/rateLimit.js';
import db from '../../src/config/db.js';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireRole('editor')(req, res, (err) => err ? reject(err) : resolve());
  }).catch(() => { return res.status(403).json({ error: 'Akses ditolak' }); });

  await new Promise((resolve, reject) => checkIdempotency(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});

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
    const ed = await db.query(`SELECT id FROM editors WHERE id = $1 AND status <> 'nonaktif'`, [editorId]);
    if (!ed.rows.length) {
      return res.status(400).json({ error: 'Karyawan tidak ditemukan atau nonaktif' });
    }
    const placeholders = video_ids.map((_, i) => `$${i + 1}`).join(',');
    const videos = await db.query(
      `SELECT id FROM content WHERE id IN (${placeholders})`,
      video_ids
    );
    if (videos.rows.length !== video_ids.length) {
      return res.status(400).json({ error: 'Beberapa video tidak ditemukan' });
    }
    await db.query(
      `UPDATE content SET editor_id = $1, status_identifikasi = 'matched' WHERE id IN (${placeholders})`,
      [editorId, ...video_ids]
    );
    return res.json({ message: 'Success', assigned: video_ids.length });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal bulk assign' });
  }
}

export default handler;