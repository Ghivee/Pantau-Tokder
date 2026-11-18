const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const { perbaiki } = require('../services/perbaikiService');

// Video yang perlu diperbaiki lebih dulu; untuk semua yang masuk (tidak memuat penghasilan).
router.get('/', async (req, res) => {
  try { res.json(await perbaiki()); } catch (err) { fail(res, err); }
});

module.exports = router;
