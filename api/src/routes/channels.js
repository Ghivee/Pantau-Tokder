const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { channelIds } = require('../integrations/youtube');

// GET /api/channels — channels configured in YOUTUBE_CHANNEL_IDS, with the names seen during sync
router.get('/', async (req, res) => {
  try {
    const seen = await db.query(
      `SELECT channel_id, MAX(channel_nama) AS nama, COUNT(*)::int AS jumlah_video
       FROM content WHERE channel_id IS NOT NULL GROUP BY channel_id`
    );
    const byId = Object.fromEntries(seen.rows.map((r) => [r.channel_id, r]));
    const ids = [...new Set([...channelIds(), ...Object.keys(byId)])];
    res.json(ids.map((id) => ({ id, nama: (byId[id] && byId[id].nama) || id, jumlah_video: (byId[id] && byId[id].jumlah_video) || 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
