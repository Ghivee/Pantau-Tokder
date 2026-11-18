const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const saranService = require('../services/saranService');

// Saran konten untuk semua yang masuk (pemilik dan karyawan).
router.get('/', async (req, res) => {
  try { res.json(await saranService.saran()); } catch (err) {
    if (err.response || err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND') { console.error('saran', err.message); return res.status(502).json({ error: 'Data cuaca belum bisa diambil. Coba lagi sebentar lagi.' }); }
    fail(res, err);
  }
});

module.exports = router;
