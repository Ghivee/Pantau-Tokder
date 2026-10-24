const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const editorService = require('../services/editorService');
const { requireAdmin, requireAnyAuth } = require('../middlewares/sessionAuth');
const { createAuditMiddleware, getClientIp, getUserAgent, logAudit } = require('../utils/auditLog');

router.get('/', requireAnyAuth, async (req, res) => {
  try {
    const editors = await editorService.getAllEditors();
    res.json(editors);
  } catch (err) {
    fail(res, err);
  }
});

// Checks and tidies what the owner typed; throws a readable error.
function validate(body) {
  const b = body || {};
  const nama = String(b.nama || '').trim();
  const kode = String(b.kode || '').trim().toUpperCase().replace(/^#/, '');
  if (!nama || nama.length > 100) throw bad(400, 'Nama wajib diisi (maksimal 100 karakter)');
  if (!/^[A-Z0-9]{2,10}$/.test(kode)) throw bad(400, 'Kode harus 2–10 huruf/angka, misal AL');
  if (b.peran !== undefined && !['editor', 'terbatas'].includes(b.peran)) throw bad(400, 'Peran tidak dikenal');
  if (b.status !== undefined && !['aktif', 'nonaktif'].includes(b.status)) throw bad(400, 'Status tidak dikenal');
  if (b.target_harian !== undefined) {
    const t = Number(b.target_harian);
    if (!Number.isInteger(t) || t < 1 || t > 50) throw bad(400, 'Target harian harus 1–50 video');
  }
  if (b.foto_url && !/^https:\/\/\S+$/i.test(b.foto_url)) throw bad(400, 'Link foto harus diawali https://');
  if (b.pin && !/^\d{4,12}$/.test(String(b.pin))) throw bad(400, 'PIN harus 4–12 angka');
  if (b.jadwal && String(b.jadwal).split(/[\s,;]+/).filter(Boolean).some((x) => !/^([01]?\d|2[0-3])[:.][0-5]\d$/.test(x))) {
    throw bad(400, 'Jadwal harus jam WIB seperti 06:00, 12:30 (pisahkan dengan koma)');
  }
  return { nama, kode, extra: b };
}

router.post('/', requireAdmin, createAuditMiddleware('editor', 'create', (req, body) => body?.id), async (req, res) => {
  try {
    const { nama, kode, extra } = validate(req.body);
    const editor = await editorService.addEditor(nama, kode, extra);
    res.status(201).json(editor);
  } catch (err) {
    fail(res, err);
  }
});

router.put('/:id', requireAdmin, createAuditMiddleware('editor', 'update', (req) => req.params.id, (req) => req.body), async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) throw bad(400, 'ID karyawan tidak valid');
    const { nama, kode, extra } = validate(req.body);
    const editor = await editorService.updateEditor(id, nama, kode, extra);
    if (!editor) throw bad(404, 'Karyawan tidak ditemukan');
    res.json(editor);
  } catch (err) {
    fail(res, err);
  }
});

router.delete('/:id', requireAdmin, createAuditMiddleware('editor', 'delete', (req) => req.params.id), async (req, res) => {
  try {
    const { id } = req.params;
    await editorService.deleteEditor(id);
    res.status(204).send();
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;