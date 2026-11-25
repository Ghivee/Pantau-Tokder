const express = require('express');
const router = express.Router();

// Halaman "Akun saya": hanya siapa yang masuk. Daftar akses sengaja TIDAK dikirim ke karyawan.
router.get('/', (req, res) => {
  if (req.isAdmin) return res.json({ nama: req.namaAkun || 'Pemilik', jenis: 'Pemilik' });
  res.json({ nama: req.editor.nama, jenis: 'Karyawan' });
});

module.exports = router;
