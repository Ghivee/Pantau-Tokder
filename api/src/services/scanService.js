const db = require('../config/db');
const { fetchNewVideos } = require('../integrations/youtube');
const { fetchRetentionData, getAccessToken } = require('../integrations/analytics');

function matchEditorCode(captionText, editors) {
  if (!captionText) return null;
  const upperCaption = captionText.toUpperCase();
  for (const ed of editors) {
    const code = (ed.kode_identifikasi || ed.kode).toUpperCase();
    if (upperCaption.includes(code)) return ed.id;
  }
  return null;
}

function generateRetentionMock(durationSecs) {
  const points = [];
  let currentRetention = 100;
  // create ~10 data points
  for (let pct = 0; pct <= 100; pct += 10) {
    points.push({ percent_duration: pct, retention: currentRetention });
    // Simulate drop-off: steeper at the beginning, flattening out
    const drop = pct < 30 ? (Math.random() * 15 + 5) : (Math.random() * 5 + 1);
    currentRetention = Math.max(10, currentRetention - drop);
  }
  return points;
}

function formatAvgDuration(secs) {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function processVideo(vid, editors, accessToken = null) {
  const existing = await db.query(
    'SELECT id, editor_id, status_identifikasi FROM content WHERE post_id = $1 AND platform = $2',
    [vid.post_id, vid.platform]
  );

  const matchedEditorId = matchEditorCode(vid.description, editors);
  const statusIdentifikasi = matchedEditorId ? 'matched' : 'unmatched';

  if (existing.rows.length === 0) {
    // New video — get real retention or generate mock
    const avgDurationSecs = vid.durationSecs * (Math.random() * 0.3 + 0.4);
    
    // Try real retention data first
    let retentionData = null;
    if (accessToken) {
      retentionData = await fetchRetentionData(vid.post_id, accessToken);
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
    const contentRow = existing.rows[0];
    const contentId = contentRow.id;
    
    // Update editor if previously unmatched and now we found a match
    let finalEditorId = contentRow.editor_id;
    let finalStatus = contentRow.status_identifikasi;
    if (finalStatus === 'unmatched' && matchedEditorId) {
      finalEditorId = matchedEditorId;
      finalStatus = 'matched';
    }
    
    if (accessToken) {
      const retentionData = await fetchRetentionData(vid.post_id, accessToken);
      if (retentionData) {
        await db.query(
          `UPDATE content SET duration_secs = $1, retention_data = $2, editor_id = $3, status_identifikasi = $4 WHERE id = $5`,
          [vid.durationSecs, JSON.stringify(retentionData), finalEditorId, finalStatus, contentId]
        );
      } else {
        await db.query(
          `UPDATE content SET duration_secs = $1, editor_id = $2, status_identifikasi = $3 WHERE id = $4`, 
          [vid.durationSecs, finalEditorId, finalStatus, contentId]
        );
      }
    } else {
      await db.query(
        `UPDATE content SET duration_secs = $1, editor_id = $2, status_identifikasi = $3 WHERE id = $4`, 
        [vid.durationSecs, finalEditorId, finalStatus, contentId]
      );
    }
    
    await db.query(
      `INSERT INTO metrics_snapshot (content_id, views, likes, comments) VALUES ($1, $2, $3, $4)`,
      [contentId, vid.views || 0, vid.likes || 0, vid.comments || 0]
    );
    // If it was unmatched but now matched, we can return false for unmatched
    return { isNew: false, unmatched: finalStatus === 'unmatched' };
  }
}

async function runFullScan() {
  console.log('=== Starting full scan (YouTube only) ===');

  const editorsRes = await db.query('SELECT * FROM editors WHERE status = $1', ['aktif']);
  const editors = editorsRes.rows;
  console.log(`Found ${editors.length} active editors.`);

  // Check if YouTube Analytics OAuth token is available
  let accessToken = null;
  try {
    const tokenRes = await db.query(`SELECT value FROM settings WHERE key = 'google_refresh_token'`);
    if (tokenRes.rows.length > 0 && tokenRes.rows[0].value) {
      const refreshToken = tokenRes.rows[0].value;
      console.log('YouTube Analytics OAuth token found — generating access token...');
      accessToken = await getAccessToken(refreshToken);
      console.log('✅ Access token generated.');
    } else {
      console.log('No OAuth token found — retention data will be simulated.');
    }
  } catch(e) {
    console.warn('Could not generate OAuth access token:', e.message);
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

    // Process videos in chunks of 10 concurrently to avoid Vercel 10s timeout
    const chunkSize = 10;
    for (let i = 0; i < ytVideos.length; i += chunkSize) {
      const chunk = ytVideos.slice(i, i + chunkSize);
      const promises = chunk.map(async (vid) => {
        try {
          const result = await processVideo(vid, editors, accessToken);
          if (result.isNew) newPosts++;
          else updatedPosts++;
          if (result.unmatched) unmatched++;
        } catch(e) {
          console.error(`Error processing video ${vid.post_id}:`, e.message);
          errors.push(`Gagal memproses video ${vid.title}: ${e.message}`);
        }
      });
      await Promise.all(promises);
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
