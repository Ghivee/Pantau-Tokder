import { requireAnyAuth } from '../../src/middlewares/sessionAuth.js';
import db from '../../src/config/db.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
  }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

  try {
    const wib = (n) => new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);
    const dari = /^\d{4}-\d{2}-\d{2}$/.test(req.query.dari || '') ? req.query.dari : wib(95);
    const sampai = /^\d{4}-\d{2}-\d{2}$/.test(req.query.sampai || '') ? req.query.sampai : wib(0);
    const result = await db.query(
      `SELECT channel_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, views, menit_tonton::float AS menit_tonton,
              sub_naik, sub_turun, revenue::float AS revenue
       FROM channel_daily WHERE tanggal BETWEEN $1 AND $2 ORDER BY tanggal`,
      [dari, sampai]
    );
    if (!req.isAdmin) result.rows.forEach((r) => { delete r.revenue; });
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Gagal mengambil analytics' });
  }
}

export default handler;