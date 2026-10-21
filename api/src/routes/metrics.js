const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const metricsService = require('../services/metricsService');

router.get('/summary', async (req, res) => {
  try {
    const summary = await metricsService.getSummary();
    res.json(summary);
  } catch (err) {
    fail(res, err);
  }
});

router.get('/trend', async (req, res) => {
  try {
    const trend = await metricsService.getTrend();
    res.json(trend);
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
