const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const { urlDariEnv } = require('../services/ssoMasterService');
const akses = require('../services/aksesWebService');

// Daftar web untuk halaman "Aplikasi". Pemilik melihat semuanya; karyawan hanya yang diizinkan pemilik.
router.get('/', async (req, res) => {
  try {
    const master = urlDariEnv('MASTER_APP_URL'), telprom = urlDariEnv('TELPROM_APP_URL');
    // Telprom dibuka lewat Master (penyedia identitas) supaya otomatis masuk; tanpa alamat Master, tautan biasa.
    const lompatTelprom = master && telprom ? `${master}/?sso=telprom&kembali=${encodeURIComponent(telprom)}` : telprom;
    const semua = [
      { id: 'pantau', nama: 'Tokder', ket: 'Performa channel, saran, affiliate, dan upload sosmed', url: '', sekarang: true },
      { id: 'master', nama: 'Master', ket: 'Order, kas harian, konten, tim, dan absen', url: master, env: 'MASTER_APP_URL' },
      { id: 'telprom', nama: 'Telprom', ket: 'Ide, naskah, dan rekam video', url: lompatTelprom, langsung: telprom, env: 'TELPROM_APP_URL' },
    ];
    if (req.isAdmin) return res.json({ daftar: semua });
    // Sudah diatur per orang: pakai izin web_*. Belum: ikuti pengaturan web yang lama.
    const boleh = req.editor.izinTersimpan ? ['master', 'telprom'].filter((w) => req.editor.izin['web_' + w]) : await akses.izinKaryawan(req.editor.id);
    res.json({ daftar: semua.filter((a) => a.sekarang || boleh.includes(a.id)) });
  } catch (err) { fail(res, err); }
});

module.exports = router;
