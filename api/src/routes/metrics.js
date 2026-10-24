const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const metricsService = require('../services/metricsService');
const { requireAnyAuth } = require('../middlewares/sessionAuth');

router.get('/summary', async (req, res) => {
  try {
    const summary = await metricsService.getSummary();
    // Cache 2 menit, stale-while-revalidate 5 menit
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.json(summary);
  } catch (err) {
    fail(res, err);
  }
});

router.get('/trend', async (req, res) => {
  try {
    const trend = await metricsService.getTrend();
    // Cache 2 menit, stale-while-revalidate 5 menit
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.json(trend);
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;