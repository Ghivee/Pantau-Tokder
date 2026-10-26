const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { fail, bad } = require('../utils/httpError');
const gaji = require('../services/gajiService');
const { requireAdmin } = require('../middlewares/sessionAuth');
const { createAuditMiddleware } = require('../utils/auditLog');
const push = require('../services/pushService');
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const namaBulan = (b) => BLN[+b.slice(5, 7) - 1] + ' ' + b.slice(0, 4);

const bulanIni = () => gaji.tglWib(Date.now()).slice(0, 7);
const idOf = (v) => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw bad(400, 'Karyawan tidak valid'); return n; };
const bulanOf = (v) => { const b = String(v || ''); if (!gaji.BULAN.test(b)) throw bad(400, 'Bulan harus berformat YYYY-MM'); return b; };

// GET /api/gaji?bulan=YYYY-MM — the owner sees everyone; an employee only their own pay.
router.get('/', async (req, res) => {
  try {
    const bulan = req.query.bulan ? bulanOf(req.query.bulan) : bulanIni();
    res.json(await gaji.hitungBulan(bulan, { editorId: req.isAdmin ? null : req.editor.id }));
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/gaji/riwayat — finalized months (an employee: their own slips)
router.get('/riwayat', async (req, res) => {
  try {
    const params = req.isAdmin ? [] : [req.editor.id];
    const r = await db.query(
      `SELECT editor_id, bulan, total::float AS total, final_at, dibayar_at FROM gaji_final
       ${req.isAdmin ? '' : 'WHERE editor_id = $1'} ORDER BY bulan DESC, editor_id LIMIT 240`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    fail(res, err);
  }
});

router.get('/aturan', requireAdmin, async (req, res) => {
  try {
    const [config, rows] = await Promise.all([gaji.getConfig(), db.query('SELECT * FROM gaji_aturan')]);
    res.json({ config, aturan: rows.rows });
  } catch (err) {
    fail(res, err);
  }
});

router.put('/config', requireAdmin, createAuditMiddleware('settings', 'gaji_config', () => 'gaji', null, (req) => req.body), async (req, res) => {
  try {
    const cfg = gaji.validasiConfig(req.body);
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [gaji.CONFIG_KEY, JSON.stringify(cfg)]
    );
    res.json(cfg);
  } catch (err) {
    fail(res, err);
  }
});

router.put('/aturan/:editorId', requireAdmin, createAuditMiddleware('editor', 'gaji_aturan', (req) => req.params.editorId, null, (req) => req.body), async (req, res) => {
  try {
    const id = idOf(req.params.editorId);
    const a = gaji.validasiAturan(req.body);
    const cols = gaji.ATURAN;
    const r = await db.query(
      `INSERT INTO gaji_aturan (editor_id, ${cols.join(', ')}, updated_at) VALUES ($1, ${cols.map((_, i) => '$' + (i + 2)).join(', ')}, NOW())
       ON CONFLICT (editor_id) DO UPDATE SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW() RETURNING *`,
      [id, ...cols.map((c) => a[c])]
    );
    res.json(r.rows[0]);
  } catch (err) {
    fail(res, err);
  }
});

// A one-off bonus (positive) or deduction (negative) with a note.
router.post('/penyesuaian', requireAdmin, createAuditMiddleware('editor', 'gaji_penyesuaian', (req) => req.body && req.body.editor_id, null, (req) => req.body), async (req, res) => {
  try {
    const b = req.body || {};
    const id = idOf(b.editor_id);
    const bulan = bulanOf(b.bulan);
    const jumlah = Math.round(Number(b.jumlah));
    if (!Number.isFinite(jumlah) || jumlah === 0 || Math.abs(jumlah) > 1e10) throw bad(400, 'Jumlah harus angka selain 0. Pakai minus untuk potongan.');
    const ket = String(b.keterangan || '').trim();
    if (ket.length < 3 || ket.length > 200) throw bad(400, 'Tulis keterangan 3–200 karakter');
    if (await gaji.isFinal(id, bulan)) throw bad(409, 'Gaji bulan ini sudah final. Buka lagi dulu untuk mengubahnya.');
    const r = await db.query(
      `INSERT INTO gaji_penyesuaian (editor_id, bulan, jumlah, keterangan) VALUES ($1, $2, $3, $4) RETURNING id, editor_id, bulan, jumlah::float AS jumlah, keterangan`,
      [id, bulan, jumlah, ket]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    fail(res, err);
  }
});

router.delete('/penyesuaian/:id', requireAdmin, async (req, res) => {
  try {
    const id = idOf(req.params.id);
    const r = await db.query('SELECT editor_id, bulan FROM gaji_penyesuaian WHERE id = $1', [id]);
    if (!r.rows.length) throw bad(404, 'Penyesuaian tidak ditemukan');
    if (await gaji.isFinal(r.rows[0].editor_id, r.rows[0].bulan)) throw bad(409, 'Gaji bulan ini sudah final. Buka lagi dulu untuk mengubahnya.');
    await db.query('DELETE FROM gaji_penyesuaian WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/gaji/final { bulan, editor_ids? } — freeze the month for everyone, or for the chosen people.
router.post('/final', requireAdmin, createAuditMiddleware('settings', 'gaji_final', (req) => req.body && req.body.bulan, null, (req) => req.body), async (req, res) => {
  try {
    const b = req.body || {};
    const bulan = bulanOf(b.bulan);
    const ids = Array.isArray(b.editor_ids) && b.editor_ids.length ? b.editor_ids.map(idOf) : null;
    const final = await gaji.finalkan(bulan, ids);
    await Promise.all(final.map((id) => push.kirim({ editorId: id }, { title: `Slip gaji ${namaBulan(bulan)} sudah final`, body: 'Buka menu Gaji untuk melihat rinciannya.', url: '/gaji', tag: 'gaji-' + bulan })));
    res.json({ final });
  } catch (err) {
    fail(res, err);
  }
});

router.delete('/final', requireAdmin, createAuditMiddleware('settings', 'gaji_buka', (req) => req.query.bulan, null, (req) => req.query), async (req, res) => {
  try {
    await gaji.bukaLagi(bulanOf(req.query.bulan), idOf(req.query.editor_id));
    res.status(204).end();
  } catch (err) {
    fail(res, err);
  }
});

router.put('/dibayar', requireAdmin, createAuditMiddleware('settings', 'gaji_dibayar', (req) => req.body && req.body.bulan, null, (req) => req.body), async (req, res) => {
  try {
    const b = req.body || {};
    const bulan = bulanOf(b.bulan), id = idOf(b.editor_id);
    const r = await gaji.tandaiDibayar(bulan, id, b.dibayar !== false);
    if (r.dibayar_at) {
      const t = await db.query('SELECT total::float AS total FROM gaji_final WHERE editor_id = $1 AND bulan = $2', [id, bulan]);
      await push.kirim({ editorId: id }, { title: `Gaji ${namaBulan(bulan)} sudah dibayar`, body: t.rows[0] ? 'Rp' + Math.round(t.rows[0].total).toLocaleString('id-ID') + '. Cek rekening Anda.' : 'Cek rekening Anda.', url: '/gaji', tag: 'gaji-' + bulan });
    }
    res.json(r);
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
