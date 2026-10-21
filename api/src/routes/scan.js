const express = require('express');
const router = express.Router();
const scanService = require('../services/scanService');
const db = require('../config/db');
const { getChannelIds } = require('../services/channelService');

// GET: Check API configuration status (for debugging)
router.get('/status', async (req, res) => {
  const ids = await getChannelIds();
  let lastScan = null;
  try {
    const r = await db.query('SELECT * FROM scan_log ORDER BY id DESC LIMIT 1');
    lastScan = r.rows[0] || null;
  } catch (e) { /* scan_log may not exist yet */ }
  res.json({
    youtube_api_key: !!process.env.YOUTUBE_API_KEY,
    youtube_channels: ids.length,
    database_url: !!process.env.DATABASE_URL,
    google_oauth_client: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    last_scan: lastScan,
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
