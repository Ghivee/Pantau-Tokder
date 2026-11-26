const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middlewares/sessionAuth');
const draf = require('../services/drafPendapatanService');

// Penghasilan itu rahasia: hanya pemilik.
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try { res.json(await draf.pratinjau()); } catch (err) {
    console.error('draf-pendapatan', err.message);
    res.status(502).json({ error: 'Office belum bisa dihubungi: ' + err.message });
  }
});

router.post('/', async (req, res) => {
  try { res.json(await draf.kirim()); } catch (err) {
    console.error('draf-pendapatan', err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
