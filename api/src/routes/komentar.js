const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const { komentar } = require('../services/komentarService');

router.get('/', async (req, res) => {
  try { res.json(await komentar()); } catch (err) { fail(res, err); }
});

module.exports = router;
