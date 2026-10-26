const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const dataService = require('../services/dataService');
const { requireAdmin, requireAnyAuth } = require('../middlewares/sessionAuth');

// Goal for a month (default: this month in WIB); created empty the first time.
router.get('/', async (req, res) => {
  try {
    const bulan = /^\d{4}-\d{2}$/.test(req.query.bulan || '') ? req.query.bulan : undefined;
    res.json(await dataService.goal(bulan));
  } catch (err) {
    fail(res, err);
  }
});

// Update goal bulan ini (admin only)
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { bulan, target_omset, tercapai } = req.body || {};
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(bulan || ''))) throw bad(400, 'Bulan harus berformat YYYY-MM');
    for (const [label, v] of [['Target', target_omset], ['Tercapai', tercapai]]) {
      if (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1e13) throw bad(400, label + ' harus angka 0 atau lebih');
    }
    
    const result = await db.query(
      `INSERT INTO affiliate_goals (bulan, target_omset, tercapai) VALUES ($1, $2, $3)
       ON CONFLICT (bulan) DO UPDATE SET target_omset = $2, tercapai = $3 RETURNING *`,
      [bulan, Number(target_omset), Number(tercapai)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    fail(res, err);
  }
});

// PUT /api/goals/impor — monthly totals from an affiliate report (CSV) read in the browser.
// Only "tercapai" of the months in the file is replaced; targets stay as they are.
router.put('/impor', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const bulan = b.bulan && typeof b.bulan === 'object' ? Object.entries(b.bulan) : [];
    if (!bulan.length || bulan.length > 36) throw bad(400, 'File tidak berisi bulan yang bisa dibaca');
    for (const [k, v] of bulan) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)) throw bad(400, `Bulan "${k}" tidak valid`);
      if (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1e13) throw bad(400, `Jumlah bulan ${k} tidak valid`);
    }
    const info = {
      sumber: String(b.sumber || 'Afiliasi').slice(0, 60), file: String(b.file || '').slice(0, 120),
      baris: Number.isInteger(b.baris) ? b.baris : null, bulan: bulan.map(([k]) => k).sort(), waktu: new Date().toISOString(),
    };
    for (const [k, v] of bulan) {
      await db.query(
        `INSERT INTO affiliate_goals (bulan, target_omset, tercapai) VALUES ($1, 0, $2)
         ON CONFLICT (bulan) DO UPDATE SET tercapai = $2`,
        [k, Math.round(Number(v))]
      );
    }
    await db.query(`INSERT INTO settings (key, value, updated_at) VALUES ('afiliasi_impor', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify(info)]);
    res.json({ ...(await dataService.goal()), impor: info });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;