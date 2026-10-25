const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const db = require('../config/db');
const { getChannelIds, getChannelNames, saveChannels } = require('../services/channelService');
const { requireAdmin, requireAnyAuth } = require('../middlewares/sessionAuth');
const { createAuditMiddleware } = require('../utils/auditLog');

// GET /api/channels — channels being monitored, with names from YouTube
router.get('/', async (req, res) => {
  try {
    const [ids, names, seen] = await Promise.all([
      getChannelIds(),
      getChannelNames(),
      db.query(
        `SELECT channel_id, MAX(channel_nama) AS nama, COUNT(*)::int AS jumlah_video
         FROM content WHERE channel_id IS NOT NULL GROUP BY channel_id`
      ),
    ]);
    const byId = Object.fromEntries(seen.rows.map((r) => [r.channel_id, r]));
    res.json(ids.map((id) => ({
      id,
      nama: names[id] || (byId[id] && byId[id].nama) || id,
      jumlah_video: (byId[id] && byId[id].jumlah_video) || 0,
    })));
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