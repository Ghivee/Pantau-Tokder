const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const { bisaLihatUang } = require('../utils/izin');
const { saranProduk } = require('../services/produkSaranService');

// Saran produk untuk menu Tautan. Komisi (rupiah) hanya untuk pemilik atau karyawan yang boleh melihat penghasilan.
router.get('/', async (req, res) => {
  try { res.json(await saranProduk({ uang: bisaLihatUang(req) })); } catch (err) { fail(res, err); }
});

module.exports = router;
