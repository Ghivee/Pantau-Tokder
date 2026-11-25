const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const { requireAdmin } = require('../middlewares/sessionAuth');
const { createAuditMiddleware } = require('../utils/auditLog');
const akses = require('../services/aksesService');

// Hanya pemilik yang boleh melihat dan mengubah akses.
router.use(requireAdmin);

router.get('/', async (req, res) => { try { res.json(await akses.daftar()); } catch (err) { fail(res, err); } });

router.put('/:id', createAuditMiddleware('settings', 'akses_karyawan', (req) => `${req.params.id}:${(req.body || {}).kunci}`, () => null, (req) => ({ nilai: (req.body || {}).nilai === true })), async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'ID karyawan tidak valid' });
  try {
    const { kunci, nilai } = req.body || {};
    res.json(await akses.ubah(Number(req.params.id), kunci, nilai));
  } catch (err) {
    if (err.status >= 400 && err.status < 600) return res.status(err.status).json({ error: err.message });
    fail(res, err);
  }
});

router.post('/sinkron', async (req, res) => { try { res.json({ hasil: await akses.sinkronSemua() }); } catch (err) { fail(res, err); } });

module.exports = router;
