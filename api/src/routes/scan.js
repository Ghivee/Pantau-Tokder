const express = require('express');
const router = express.Router();
const scanService = require('../services/scanService');

// GET: Check API configuration status (for debugging)
router.get('/status', (req, res) => {
  const hasYtKey = !!process.env.YOUTUBE_API_KEY;
  const hasYtChannel = !!process.env.YOUTUBE_CHANNEL_ID;
  const hasDbUrl = !!process.env.DATABASE_URL;
  res.json({
    youtube_api_key: hasYtKey ? `✅ Set (${process.env.YOUTUBE_API_KEY.slice(0, 6)}...)` : '❌ Missing',
    youtube_channel_id: hasYtChannel ? `✅ Set (${process.env.YOUTUBE_CHANNEL_ID})` : '❌ Missing',
    database_url: hasDbUrl ? '✅ Set' : '❌ Missing',
  });
});

// POST: Run full sync
router.post('/', async (req, res) => {
  try {
    const result = await scanService.runFullScan();
    res.json({ message: 'Scan completed', ...result });
  } catch (err) {
    console.error('Scan route error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Cron endpoint (Vercel Cron hits this)
router.get('/cron', async (req, res) => {
  try {
    console.log('Cron triggered scan started');
    const result = await scanService.runFullScan();
    res.json({ message: 'Cron scan completed', ...result });
  } catch (err) {
    console.error('Cron scan route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
