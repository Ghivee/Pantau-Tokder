const express = require('express');
const router = express.Router();
const kontenMaster = require('../services/kontenMasterService');

// Untuk semua yang masuk. Kegagalan Master tidak boleh mengganggu halaman lain: jawab kosong dengan pesan.
router.get('/', async (req, res) => {
  try { res.json(await kontenMaster.daftar()); } catch (err) {
    console.error('konten-master', err.message);
    res.json({ terhubung: false, daftar: {}, galat: 'Konten Master belum bisa dibaca' });
  }
});

// Naskah yang belum tayang, untuk mengisi judul di menu Upload.
router.get('/siap', async (req, res) => {
  try { res.json(await kontenMaster.siapUnggah()); } catch (err) {
    console.error('konten-master/siap', err.message);
    res.json({ terhubung: false, daftar: [], galat: 'Naskah Master belum bisa dibaca' });
  }
});

module.exports = router;
