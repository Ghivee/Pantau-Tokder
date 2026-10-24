import { requireAnyAuth, requireAdmin } from '../../src/middlewares/sessionAuth.js';
import db from '../../src/config/db.js';

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    req.method === 'PUT' ? requireAdmin(req, res, (err) => err ? reject(err) : resolve()) : requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
  }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

  try {
    if (req.method === 'GET') {
      const bulan = req.query.bulan || new Date().toISOString().slice(0, 7);
      let result = await db.query('SELECT * FROM affiliate_goals WHERE bulan = $1', [bulan]);
      if (result.rows.length === 0) {
        result = await db.query('INSERT INTO affiliate_goals (bulan, target_omset, tercapai) VALUES ($1, 0, 0) RETURNING *', [bulan]);
      }
      return res.json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const { bulan, target_omset, tercapai } = req.body || {};
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(bulan || ''))) return res.status(400).json({ error: 'Bulan harus berformat YYYY-MM' });
      for (const [label, v] of [['Target', target_omset], ['Tercapai', tercapai]]) {
        if (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1e13) return res.status(400).json({ error: label + ' harus angka 0 atau lebih' });
      }
      const result = await db.query(
        `INSERT INTO affiliate_goals (bulan, target_omset, tercapai) VALUES ($1, $2, $3)
         ON CONFLICT (bulan) DO UPDATE SET target_omset = $2, tercapai = $3 RETURNING *`,
        [bulan, Number(target_omset), Number(tercapai)]
      );
      return res.json(result.rows[0]);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Gagal mengelola target' });
  }
}

export default handler;