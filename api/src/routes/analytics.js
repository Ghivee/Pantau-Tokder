const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const { requireAnyAuth } = require('../middlewares/sessionAuth');

// GET /api/analytics?dari=YYYY-MM-DD&sampai=YYYY-MM-DD — daily channel numbers from YouTube Analytics
router.get('/', requireAnyAuth, async (req, res) => {
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
    // Cache 5 menit, stale-while-revalidate 10 menit
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json(result.rows);
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;