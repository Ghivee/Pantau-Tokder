const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const { requireAnyAuth } = require('../middlewares/sessionAuth');
const kalender = require('../services/kalenderAktivitasService');
const jejakMaster = require('../services/jejakMasterService');

// GET /api/kalender?bulan=YYYY-MM. Pemilik melihat semua orang beserta ringkasan Jejak; karyawan hanya miliknya.
// Cakupan ditentukan dari sesi, tidak dari parameter.
router.get('/', requireAnyAuth, async (req, res) => {
  try {
    if (req.isAdmin) await jejakMaster.sinkron().catch(() => {});
    res.set('Cache-Control', 'no-store');
    res.json(await kalender.sebulan(String(req.query.bulan || ''), req.isAdmin ? { admin: true } : { editorId: req.editor.id }));
  } catch (err) { fail(res, err); }
});

module.exports = router;
