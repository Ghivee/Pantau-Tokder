const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const { requireAnyAuth } = require('../middlewares/sessionAuth');
const { bisaLihatUang } = require('../utils/izin');
const svc = require('../services/afiliasiService');

router.use(requireAnyAuth);

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

// Produk affiliate terlaris; nominal rupiah hanya untuk pemilik atau karyawan yang diberi izin penghasilan.
router.get('/', async (req, res) => {
  try { res.json(await svc.terlaris({ hari: parseInt(req.query.hari, 10), uang: bisaLihatUang(req) })); } catch (err) { fail(res, err); }
});

// Impor laporan komisi (dibaca di browser dari CSV). Hanya yang boleh melihat penghasilan.
router.post('/impor', async (req, res) => {
  try {
    if (!bisaLihatUang(req)) return res.status(403).json({ error: 'Hanya yang boleh melihat penghasilan yang bisa mengimpor' });
    const b = req.body || {};
    const baris = Array.isArray(b.baris) ? b.baris : [];
    if (!baris.length || baris.length > 2000) throw bad(400, 'Kirim 1–2.000 baris per impor');
    const bersih = baris.map((r, i) => {
      const komisi = Number(r.komisi), qty = r.qty == null || r.qty === '' ? null : Number(r.qty);
      if (!/^[a-f0-9]{16,64}$/.test(String(r.kunci))) throw bad(400, `Baris ${i + 1}: kunci tidak valid`);
      if (!TANGGAL.test(String(r.tanggal))) throw bad(400, `Baris ${i + 1}: tanggal tidak valid`);
      if (!String(r.produk || '').trim()) throw bad(400, `Baris ${i + 1}: nama produk kosong`);
      if (!Number.isFinite(komisi) || Math.abs(komisi) > 1e10) throw bad(400, `Baris ${i + 1}: komisi tidak valid`);
      if (qty != null && (!Number.isInteger(qty) || qty < 0 || qty > 1e6)) throw bad(400, `Baris ${i + 1}: jumlah tidak valid`);
      return { kunci: String(r.kunci), tanggal: r.tanggal, produk: r.produk, komisi, qty };
    });
    const sumber = String(b.sumber || 'Afiliasi').slice(0, 40);
    res.json({ ok: true, baris: await svc.simpan(sumber, bersih) });
  } catch (err) { fail(res, err); }
});

module.exports = router;
