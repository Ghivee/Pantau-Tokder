import { requireAnyAuth } from '../../src/middlewares/sessionAuth.js';
import db from '../../src/config/db.js';

const LIST_COLUMNS = `id, post_id, platform, url, judul, tanggal_upload, editor_id, status_identifikasi, tipe_video,
  duration_secs, channel_id, channel_nama, revenue, views, likes, comments, stats_at,
  (retention_data IS NOT NULL) AS punya_retensi`;

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
  }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

  try {
    const { id } = req.query;
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID video tidak valid' });
    const r = await db.query(`SELECT ${LIST_COLUMNS}, retention_data, retention_source FROM content WHERE id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Video tidak ditemukan' });
    if (!req.isAdmin) delete r.rows[0].revenue;
    return res.json(r.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Gagal mengambil detail video' });
  }
}

export default handler;