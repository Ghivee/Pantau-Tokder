const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const { requireAdmin, requireAnyAuth } = require('../middlewares/sessionAuth');
const jejak = require('../services/jejakService');
const jm = require('../services/jejakMasterService');

// Browser memberi tahu halaman yang dibuka (semua orang yang sudah masuk). Tidak pernah gagal untuk pemanggil.
router.post('/halaman', requireAnyAuth, async (req, res) => {
  try { res.json(await jejak.catatHalaman(req, (req.body || {}).rute)); } catch (err) { res.json({ dicatat: false }); }
});

// Selebihnya hanya untuk pemilik.
router.use(requireAdmin);

const SARING = ['nama', 'jenis', 'sumber', 'hasil', 'risikoMin', 'ip', 'hari', 'dari', 'sampai', 'q', 'batas', 'sebelum'];
const dariQuery = (q) => ({ ...Object.fromEntries(SARING.filter((k) => typeof q[k] === 'string').map((k) => [k, q[k]])), belumDitinjau: q.belumDitinjau === '1' });
const oleh = (req) => req.namaAkun || 'Pemilik';

// Menarik catatan terbaru dari Master sebelum membaca (paling cepat sekali per menit); kegagalannya tidak menghalangi tampilan.
const selaras = () => jm.sinkron().catch((e) => ({ terhubung: true, baru: 0, galat: e.message }));

router.get('/', async (req, res) => { try { await selaras(); res.json(await jejak.daftar(dariQuery(req.query))); } catch (err) { fail(res, err); } });
router.get('/ringkasan', async (req, res) => { try { const master = await selaras(); res.json({ ...(await jejak.ringkasan()), master }); } catch (err) { fail(res, err); } });
router.post('/sinkron', async (req, res) => { try { res.json(await jm.sinkron({ paksa: true })); } catch (err) { fail(res, err); } });
router.get('/pengguna', async (req, res) => {
  const nama = typeof req.query.nama === 'string' ? req.query.nama.slice(0, 120) : '';
  if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
  try { res.json(await jejak.detailPengguna(nama)); } catch (err) { fail(res, err); }
});
router.post('/tinjau/:id', async (req, res) => {
  try { res.json({ ok: await jejak.tinjau(req.params.id, oleh(req)) }); } catch (err) { fail(res, err); }
});
router.post('/tinjau-semua', async (req, res) => {
  try { res.json({ jumlah: await jejak.tinjauSemua(oleh(req), typeof (req.body || {}).nama === 'string' ? req.body.nama.slice(0, 120) : null) }); } catch (err) { fail(res, err); }
});
router.get('/sesi', async (req, res) => {
  try { res.json({ sesi: (await jejak.sesiAktif()).map((s) => ({ ...s, ini: s.id === req.sesiId })), master: await jm.sesiMaster() }); } catch (err) { fail(res, err); }
});
router.post('/sesi/:id/cabut', async (req, res) => {
  try {
    const n = await jejak.cabutSesi(req.params.id);
    if (!n) return res.status(404).json({ error: 'Sesi tidak ditemukan atau sudah berakhir' });
    res.json({ dicabut: n, sesiIni: req.params.id === req.sesiId });
  } catch (err) { fail(res, err); }
});
router.get('/ekspor', async (req, res) => {
  try {
    const csv = await jejak.ekspor(dariQuery(req.query));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jejak-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(csv);
  } catch (err) { fail(res, err); }
});

module.exports = router;
