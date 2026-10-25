const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const dataService = require('../services/dataService');

// GET /api/analytics?dari=YYYY-MM-DD&sampai=YYYY-MM-DD — daily channel numbers from YouTube Analytics
router.get('/', async (req, res) => {
  try {
    res.json(await dataService.daily({ isAdmin: req.isAdmin, dari: req.query.dari, sampai: req.query.sampai }));
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
