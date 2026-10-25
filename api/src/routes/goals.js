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

module.exports = router;