const express = require('express');
const router = express.Router();
const scanService = require('../services/scanService');

router.post('/', async (req, res) => {
  try {
    await scanService.runFullScan();
    res.json({ message: 'Scan started/completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
