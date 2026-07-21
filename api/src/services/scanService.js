const db = require('../config/db');
const { fetchNewVideos } = require('../integrations/youtube');
const { fetchTikTokVideos } = require('../integrations/tiktok');

function matchEditorCode(captionText, editors) {
  if (!captionText) return null;
  const found = editors.find(e =>
    captionText.toUpperCase().includes(e.kode_identifikasi.toUpperCase())
  );
  return found ? found.id : null;
}

// Generate mock retention data for new videos
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

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function processVideo(vid, editors) {
  const existing = await db.query(
    'SELECT id FROM content WHERE post_id = $1 AND platform = $2',
    [vid.post_id, vid.platform]
  );

  const matchedEditorId = matchEditorCode(vid.description, editors);
  const statusIdentifikasi = matchedEditorId ? 'matched' : 'unmatched';

  if (existing.rows.length === 0) {
    // New video — insert
    const avgDurationSecs = (vid.durationSecs || 60) * (Math.random() * 0.3 + 0.4);
    const retentionData = generateRetentionMock(vid.durationSecs || 60);

    const insertRes = await db.query(
      `INSERT INTO content 
       (post_id, platform, url, judul, tanggal_upload, editor_id, status_identifikasi, tipe_video, avg_view_duration, retention_data) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        vid.post_id, vid.platform, vid.url, vid.title, vid.publishedAt,
        matchedEditorId, statusIdentifikasi, vid.tipe_video,
        formatDuration(avgDurationSecs), JSON.stringify(retentionData)
      ]
    );
    const newContentId = insertRes.rows[0].id;
    await db.query(
      `INSERT INTO metrics_snapshot (content_id, views, likes, comments) VALUES ($1, $2, $3, $4)`,
      [newContentId, vid.views || 0, vid.likes || 0, vid.comments || 0]
    );
    return { isNew: true, unmatched: !matchedEditorId };
  } else {
    // Existing — update metrics snapshot
    await db.query(
      `INSERT INTO metrics_snapshot (content_id, views, likes, comments) VALUES ($1, $2, $3, $4)`,
      [existing.rows[0].id, vid.views || 0, vid.likes || 0, vid.comments || 0]
    );
    return { isNew: false, unmatched: false };
  }
}

async function runFullScan() {
  console.log('=== Starting full scan ===');

  const editorsRes = await db.query('SELECT * FROM editors WHERE status = $1', ['aktif']);
  const editors = editorsRes.rows;
  console.log(`Found ${editors.length} active editors.`);

  let newPosts = 0;
  let updatedPosts = 0;
  let unmatched = 0;
  const errors = [];

  // 1. YouTube
  try {
    console.log('Fetching YouTube videos...');
    const ytVideos = await fetchNewVideos();
    console.log(`Got ${ytVideos.length} YouTube videos.`);

    for (const vid of ytVideos) {
      try {
        const result = await processVideo(vid, editors);
        if (result.isNew) newPosts++;
        else updatedPosts++;
        if (result.unmatched) unmatched++;
      } catch (e) {
        console.error(`Error processing YT video ${vid.post_id}:`, e.message);
        errors.push(`YT:${vid.post_id} - ${e.message}`);
      }
    }
  } catch (e) {
    console.error('YouTube fetch failed:', e.message);
    errors.push(`YouTube fetch failed: ${e.message}`);
  }

  // 2. TikTok (Mock)
  try {
    console.log('Fetching TikTok videos (mock)...');
    const tkVideos = await fetchTikTokVideos();
    console.log(`Got ${tkVideos.length} TikTok videos.`);

    for (const vid of tkVideos) {
      try {
        const result = await processVideo(vid, editors);
        if (result.isNew) newPosts++;
        else updatedPosts++;
        if (result.unmatched) unmatched++;
      } catch (e) {
        console.error(`Error processing TK video ${vid.post_id}:`, e.message);
        errors.push(`TK:${vid.post_id} - ${e.message}`);
      }
    }
  } catch (e) {
    console.error('TikTok fetch failed:', e.message);
    errors.push(`TikTok fetch failed: ${e.message}`);
  }

  // Log the scan result
  try {
    await db.query(
      'INSERT INTO scan_log (platform, jumlah_post_baru, jumlah_unmatched) VALUES ($1, $2, $3)',
      ['ALL', newPosts, unmatched]
    );
  } catch (e) {
    console.error('Could not write scan_log:', e.message);
  }

  const summary = {
    newPosts,
    updatedPosts,
    unmatched,
    errors: errors.length > 0 ? errors : undefined
  };
  console.log('=== Scan complete ===', summary);
  return summary;
}

module.exports = { runFullScan, matchEditorCode };
