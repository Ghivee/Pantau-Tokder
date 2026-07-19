const express = require('express');
const router = express.Router();
const metricsService = require('../services/metricsService');

router.get('/summary', async (req, res) => {
  try {
    const summary = await metricsService.getSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/trend', async (req, res) => {
  try {
    const trend = await metricsService.getTrend();
    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
