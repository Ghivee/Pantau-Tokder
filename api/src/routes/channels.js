const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const dataService = require('../services/dataService');
const { getChannelIds, getChannelNames, saveChannels } = require('../services/channelService');
const { requireAdmin, requireAnyAuth } = require('../middlewares/sessionAuth');
const { createAuditMiddleware } = require('../utils/auditLog');

// GET /api/channels — channels being monitored, with names from YouTube
router.get('/', async (req, res) => {
  try {
    res.json(await dataService.channels());
  } catch (err) {
    fail(res, err);
  }
});

// PUT /api/channels — owner replaces the monitored channels: { channels: ["UC…", "@handle", "https://youtube.com/@…"] }
router.put('/', requireAdmin, createAuditMiddleware('channel', 'update_channels', (req, body) => JSON.stringify(body?.channels || [])), async (req, res) => {
  try {
    const inputs = Array.isArray((req.body || {}).channels) ? req.body.channels : [];
    const list = await saveChannels(inputs);
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

module.exports = router;