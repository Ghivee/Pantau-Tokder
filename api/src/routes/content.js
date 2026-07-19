const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const { editor_id, platform, status } = req.query;
    let query = 'SELECT c.*, m.views, m.likes, m.comments FROM content c LEFT JOIN (SELECT DISTINCT ON (content_id) * FROM metrics_snapshot ORDER BY content_id, timestamp DESC) m ON c.id = m.content_id WHERE 1=1';
    const params = [];
    let i = 1;

    if (editor_id && editor_id !== 'all') {
      query += ` AND c.editor_id = $${i++}`;
      params.push(editor_id);
    }
    if (platform && platform !== 'all') {
      query += ` AND c.platform = $${i++}`;
      params.push(platform);
    }
    if (status) {
      query += ` AND c.status_identifikasi = $${i++}`;
      params.push(status);
    }

    query += ' ORDER BY c.tanggal_upload DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { editor_id } = req.body;
    await db.query('UPDATE content SET editor_id = $1, status_identifikasi = $2 WHERE id = $3', [editor_id, 'matched', id]);
    res.json({ message: 'Success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
