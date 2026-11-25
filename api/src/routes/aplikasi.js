const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { fail } = require('../utils/httpError');
const { requireAdmin } = require('../middlewares/sessionAuth');
const { createAuditMiddleware } = require('../utils/auditLog');
const { urlDariEnv } = require('../services/ssoMasterService');
const akses = require('../services/aksesWebService');

const NAMA = { master: 'Master', telprom: 'Telprom' };

// Daftar web untuk halaman "Aplikasi". Pemilik melihat semuanya; karyawan hanya yang diizinkan pemilik.
router.get('/', async (req, res) => {
  try {
    const semua = [
      { id: 'pantau', nama: 'Pantau Tokder', ket: 'Performa channel, saran, affiliate, dan upload sosmed', url: '', sekarang: true },
      { id: 'master', nama: 'Master', ket: 'Order, kas harian, konten, tim, dan absen', url: urlDariEnv('MASTER_APP_URL'), env: 'MASTER_APP_URL' },
      { id: 'telprom', nama: 'Telprom', ket: 'Ide, naskah, dan rekam video', url: urlDariEnv('TELPROM_APP_URL'), env: 'TELPROM_APP_URL' },
    ];
    if (req.isAdmin) return res.json({ daftar: semua });
    const boleh = await akses.izinKaryawan(req.editor.id);
    res.json({ daftar: semua.filter((a) => a.sekarang || boleh.includes(a.id)) });
  } catch (err) { fail(res, err); }
});

// Pemilik: siapa boleh membuka web apa.
router.get('/akses', requireAdmin, async (req, res) => {
  try {
    const peta = await akses.bacaPeta();
    const r = await db.query(`SELECT id, nama FROM editors WHERE status = 'aktif' ORDER BY nama`);
    res.json({
      web: akses.WEB.map((id) => ({ id, nama: NAMA[id] })),
      karyawan: r.rows.map((e) => ({ id: e.id, nama: e.nama, web: Object.fromEntries(akses.WEB.map((w) => [w, akses.izinDari(peta, e.id).includes(w)])) })),
    });
  } catch (err) { fail(res, err); }
});

router.put('/akses', requireAdmin, createAuditMiddleware('settings', 'akses_web', (req) => `${(req.body || {}).editor_id}:${(req.body || {}).web}`, () => null, (req) => ({ nilai: (req.body || {}).nilai === true })), async (req, res) => {
  const { editor_id: id, web, nilai } = req.body || {};
  if (!/^\d+$/.test(String(id)) || typeof nilai !== 'boolean' || !akses.WEB.includes(web)) return res.status(400).json({ error: 'Permintaan tidak lengkap' });
  try {
    const e = await db.query(`SELECT id FROM editors WHERE id = $1 AND status = 'aktif'`, [id]);
    if (!e.rows[0]) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    const boleh = await akses.atur(+id, web, nilai);
    res.json({ editor_id: +id, web: Object.fromEntries(akses.WEB.map((w) => [w, boleh.includes(w)])) });
  } catch (err) { fail(res, err); }
});

module.exports = router;
