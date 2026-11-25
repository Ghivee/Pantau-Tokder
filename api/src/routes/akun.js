const express = require('express');
const router = express.Router();
const { KATALOG, resolve } = require('../utils/izin');

// Halaman "Akun saya": siapa yang masuk dan apa saja aksesnya. Hanya data pemanggil sendiri.
router.get('/', (req, res) => {
  if (req.isAdmin) {
    return res.json({ nama: 'Pemilik', jenis: 'Pemilik', semua: true, akses: [] });
  }
  const izin = req.editor.izin || resolve({}).izin;
  res.json({
    nama: req.editor.nama,
    jenis: 'Karyawan',
    semua: false,
    akses: KATALOG.map((g) => ({ grup: g.grup, butir: g.butir.map((b) => ({ nama: b.nama, boleh: izin[b.k] === true })) })),
  });
});

module.exports = router;
