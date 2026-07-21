const db = require('../config/db');
const { fetchNewVideos } = require('../integrations/youtube');
const { fetchRetentionData } = require('../integrations/analytics');

function matchEditorCode(captionText, editors) {
  if (!captionText) return null;
  const found = editors.find(e =>
    captionText.toUpperCase().includes(e.kode_identifikasi.toUpperCase())
  );
  return found ? found.id : null;
}

function generateRetentionMock(durationSecs) {
  const data = [];
  let currentVal = 100.0;
  for (let i = 0; i <= 100; i++) {
    data.push({ percent_duration: i, retention: currentVal });
    if (i < 10) currentVal -= (Math.random() * 2 + 1);
    else currentVal -= (Math.random() * 0.8);
    if (currentVal < 0) currentVal = 0;
  }
  return data;
}

function formatAvgDuration(secs) {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function processVideo(vid, editors, refreshToken = null) {
  const existing = await db.query(
    'SELECT id FROM content WHERE post_id = $1 AND platform = $2',
    [vid.post_id, vid.platform]
  );

  const matchedEditorId = matchEditorCode(vid.description, editors);
  const statusIdentifikasi = matchedEditorId ? 'matched' : 'unmatched';

  if (existing.rows.length === 0) {
    // New video — get real retention or generate mock
    const avgDurationSecs = vid.durationSecs * (Math.random() * 0.3 + 0.4);
    
    // Try real retention data first
    let retentionData = null;
    if (refreshToken) {
      retentionData = await fetchRetentionData(vid.post_id, refreshToken);
      if (retentionData) console.log(`  ✅ Real retention for ${vid.post_id}: ${retentionData.length} points`);
    }
    // Fall back to mock if no real data
    if (!retentionData) {
      retentionData = generateRetentionMock(vid.durationSecs);
    }

    const insertRes = await db.query(
      `INSERT INTO content 
       (post_id, platform, url, judul, tanggal_upload, editor_id, status_identifikasi, 
        tipe_video, duration_secs, avg_view_duration, retention_data) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        vid.post_id, vid.platform, vid.url, vid.title, vid.publishedAt,
        matchedEditorId, statusIdentifikasi, vid.tipe_video,
        vid.durationSecs,
        formatAvgDuration(avgDurationSecs),
        JSON.stringify(retentionData)
      ]
    );
    const newContentId = insertRes.rows[0].id;
    await db.query(
      `INSERT INTO metrics_snapshot (content_id, views, likes, comments) VALUES ($1, $2, $3, $4)`,
      [newContentId, vid.views || 0, vid.likes || 0, vid.comments || 0]
    );
    return { isNew: true, unmatched: !matchedEditorId };
  } else {
    // Existing video — update metrics + duration + retention if we have OAuth
    const contentId = existing.rows[0].id;
    
    if (refreshToken) {
      const retentionData = await fetchRetentionData(vid.post_id, refreshToken);
      if (retentionData) {
        await db.query(
          `UPDATE content SET duration_secs = $1, retention_data = $2 WHERE id = $3`,
          [vid.durationSecs, JSON.stringify(retentionData), contentId]
        );
      } else {
        await db.query(`UPDATE content SET duration_secs = $1 WHERE id = $2`, [vid.durationSecs, contentId]);
      }
    } else {
      await db.query(`UPDATE content SET duration_secs = $1 WHERE id = $2`, [vid.durationSecs, contentId]);
    }
    
    await db.query(
      `INSERT INTO metrics_snapshot (content_id, views, likes, comments) VALUES ($1, $2, $3, $4)`,
      [contentId, vid.views || 0, vid.likes || 0, vid.comments || 0]
    );
    return { isNew: false, unmatched: false };
  }
}

async function runFullScan() {
  console.log('=== Starting full scan (YouTube only) ===');

  const editorsRes = await db.query('SELECT * FROM editors WHERE status = $1', ['aktif']);
  const editors = editorsRes.rows;
  console.log(`Found ${editors.length} active editors.`);

  // Check if YouTube Analytics OAuth token is available
  let refreshToken = null;
  try {
    const tokenRes = await db.query(`SELECT value FROM settings WHERE key = 'google_refresh_token'`);
    if (tokenRes.rows.length > 0) {
      refreshToken = tokenRes.rows[0].value;
      console.log('YouTube Analytics OAuth token found — will fetch real retention data.');
    } else {
      console.log('No OAuth token found — retention data will be simulated.');
    }
  } catch(e) {
    console.warn('Could not check OAuth token (settings table may not exist):', e.message);
  }

  let newPosts = 0;
  let updatedPosts = 0;
  let unmatched = 0;
  const errors = [];

  // YouTube only — no TikTok/IG/FB mock
  try {
    console.log('Fetching YouTube videos (last 30 days)...');
    const ytVideos = await fetchNewVideos();
    console.log(`Got ${ytVideos.length} YouTube videos.`);

    for (const vid of ytVideos) {
      try {
        const result = await processVideo(vid, editors, refreshToken);
        if (result.isNew) newPosts++;
        else updatedPosts++;
        if (result.unmatched) unmatched++;
      } catch (e) {
        console.error(`Error processing video ${vid.post_id}:`, e.message);
        errors.push(`${vid.post_id}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('YouTube fetch failed:', e.message);
    errors.push(`YouTube fetch failed: ${e.message}`);
  }

  // Log scan
  try {
    await db.query(
      'INSERT INTO scan_log (platform, jumlah_post_baru, jumlah_unmatched) VALUES ($1, $2, $3)',
      ['youtube', newPosts, unmatched]
    );
  } catch (e) {
    console.error('scan_log write error:', e.message);
  }

  const summary = { newPosts, updatedPosts, unmatched, errors: errors.length > 0 ? errors : undefined };
  console.log('=== Scan complete ===', summary);
  return summary;
}

module.exports = { runFullScan, matchEditorCode };
