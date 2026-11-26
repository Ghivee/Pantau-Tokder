const express = require('express');
const router = express.Router();
const kontenMaster = require('../services/kontenMasterService');

// Untuk semua yang masuk. Kegagalan Master tidak boleh mengganggu halaman lain: jawab kosong dengan pesan.
router.get('/', async (req, res) => {
  try { res.json(await kontenMaster.daftar()); } catch (err) {
    console.error('konten-master', err.message);
    res.json({ terhubung: false, daftar: {}, galat: 'Konten Office belum bisa dibaca' });
  }
});

module.exports = router;
