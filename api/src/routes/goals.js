const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Dapatkan goal bulan ini
router.get('/', async (req, res) => {
  try {
    const bulan = req.query.bulan || new Date().toISOString().slice(0, 7); // Format YYYY-MM
    
    let result = await db.query('SELECT * FROM affiliate_goals WHERE bulan = $1', [bulan]);
    
    if (result.rows.length === 0) {
      // Jika belum ada, buat otomatis
      result = await db.query(
        'INSERT INTO affiliate_goals (bulan, target_omset, tercapai) VALUES ($1, 0, 0) RETURNING *',
        [bulan]
      );
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update goal bulan ini
router.put('/', async (req, res) => {
  try {
    const { bulan, target_omset, tercapai } = req.body;
    
    const result = await db.query(
      'UPDATE affiliate_goals SET target_omset = $1, tercapai = $2 WHERE bulan = $3 RETURNING *',
      [target_omset, tercapai, bulan]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
