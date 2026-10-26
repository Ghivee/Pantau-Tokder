const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { fail, bad } = require('../utils/httpError');
const pengajuan = require('../services/pengajuanService');
const gaji = require('../services/gajiService');
const { requireAdmin, requireEditor } = require('../middlewares/sessionAuth');
const { userMutationLimiter } = require('../middlewares/rateLimit');
const { createAuditMiddleware } = require('../utils/auditLog');

router.get('/', async (req, res) => {
  try {
    const cfg = await gaji.getConfig();
    const editorId = req.isAdmin ? null : req.editor.id;
    const [list, cuti] = await Promise.all([pengajuan.daftar({ editorId }), pengajuan.sisaCuti(cfg, editorId)]);
    res.json({ list, cuti });
  } catch (err) {
    fail(res, err);
  }
});

// An employee asks for leave or a claim for themselves.
router.post('/', requireEditor, userMutationLimiter, async (req, res) => {
  try {
    const p = pengajuan.validasi(req.body);
    const fin = await gaji.bulanFinalDalam(req.editor.id, p.dari, p.sampai);
    if (fin) throw bad(409, `Gaji ${fin} sudah final, jadi tanggal itu tidak bisa diajukan lagi. Hubungi pemilik.`);
    res.status(201).json(await pengajuan.ajukan(req.editor, req.body, await gaji.getConfig()));
  } catch (err) {
    fail(res, err);
  }
});

// Cancel: an employee their own pending request; the owner any pending one.
router.delete('/:id', userMutationLimiter, async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) throw bad(400, 'Pengajuan tidak valid');
    const params = [req.params.id];
    let sql = `DELETE FROM pengajuan WHERE id = $1 AND status = 'menunggu'`;
    if (!req.isAdmin) { params.push(req.editor.id); sql += ' AND editor_id = $2'; }
    const r = await db.query(sql + ' RETURNING id', params);
    if (!r.rows.length) throw bad(409, 'Hanya pengajuan yang masih menunggu yang bisa dibatalkan');
    res.status(204).end();
  } catch (err) {
    fail(res, err);
  }
});

// PUT /api/pengajuan/:id { status: 'disetujui' | 'ditolak', catatan }
router.put('/:id', requireAdmin, createAuditMiddleware('pengajuan', 'putuskan', (req) => req.params.id, null, (req) => req.body), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) throw bad(400, 'Pengajuan tidak valid');
    const b = req.body || {};
    if (!['disetujui', 'ditolak'].includes(b.status)) throw bad(400, 'Pilih setujui atau tolak');
    const catatan = String(b.catatan || '').trim().slice(0, 200) || null;
    const cur = await db.query(`SELECT ${pengajuan.KOLOM} FROM pengajuan WHERE id = $1`, [req.params.id]);
    const p = cur.rows[0];
    if (!p) throw bad(404, 'Pengajuan tidak ditemukan');
    const fin = await gaji.bulanFinalDalam(p.editor_id, p.dari, p.sampai);
    if (fin) throw bad(409, `Gaji ${fin} karyawan ini sudah final. Buka lagi dulu di menu Gaji supaya keputusan ini ikut terhitung.`);
    if (b.status === 'disetujui' && p.jenis === 'cuti' && p.status !== 'disetujui') {
      const cfg = await gaji.getConfig();
      const tahun = p.dari.slice(0, 4);
      const sisa = cfg.jatah_cuti - (await pengajuan.cutiTerpakai(p.editor_id, tahun, cfg, p.id));
      const minta = pengajuan.workdaysIn(p.dari, p.sampai, cfg).length;
      if (minta > sisa) throw bad(400, `Sisa cuti karyawan ini ${Math.max(0, sisa)} hari kerja, pengajuan ${minta} hari`);
    }
    const r = await db.query(
      `UPDATE pengajuan SET status = $1, catatan = $2, diputus_at = NOW() WHERE id = $3 RETURNING ${pengajuan.KOLOM}`,
      [b.status, catatan, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
