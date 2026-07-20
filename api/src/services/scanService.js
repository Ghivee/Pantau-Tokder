const db = require('../config/db');
const { fetchNewVideos, fetchVideoStats } = require('../integrations/youtube');
const { fetchTikTokVideos } = require('../integrations/tiktok');
const { fetchInstagramPosts, fetchInstagramStats } = require('../integrations/instagram');
const { fetchFacebookPosts, fetchFacebookStats } = require('../integrations/facebook');

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

async function runFullScan() {
  console.log('Starting full scan...');
  try {
    const editorsRes = await db.query('SELECT * FROM editors WHERE status = $1', ['aktif']);
    const editors = editorsRes.rows;

    let newPosts = 0;
    let unmatched = 0;
    
    // 1. Fetch from YT
    const ytVideos = await fetchNewVideos();
    
    for (const vid of ytVideos) {
      // check if exists
      const existing = await db.query('SELECT id FROM content WHERE post_id = $1 AND platform = $2', [vid.post_id, vid.platform]);
      
      const matchedEditorId = matchEditorCode(vid.description, editors);
      const statusIdentifikasi = matchedEditorId ? 'matched' : 'unmatched';
      if (!matchedEditorId) unmatched++;
      
      if (existing.rows.length === 0) {
        // Insert
        newPosts++;
        const avgDurationSecs = vid.durationSecs * (Math.random() * 0.3 + 0.4);
        const retentionData = generateRetentionMock(vid.durationSecs);
        
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
          [newContentId, vid.views, vid.likes, vid.comments]
        );
      } else {
        // Update stats
        await db.query(
          `INSERT INTO metrics_snapshot (content_id, views, likes, comments) VALUES ($1, $2, $3, $4)`,
          [existing.rows[0].id, vid.views, vid.likes, vid.comments]
        );
      }
    }
    
    // 2. Fetch from TikTok (Mock)
    const tkVideos = await fetchTikTokVideos();
    for (const vid of tkVideos) {
      const existing = await db.query('SELECT id FROM content WHERE post_id = $1 AND platform = $2', [vid.post_id, vid.platform]);
      const matchedEditorId = matchEditorCode(vid.description, editors);
      const statusIdentifikasi = matchedEditorId ? 'matched' : 'unmatched';
      if (!matchedEditorId) unmatched++;
      
      if (existing.rows.length === 0) {
        newPosts++;
        const avgDurationSecs = vid.durationSecs * (Math.random() * 0.3 + 0.4);
        const retentionData = generateRetentionMock(vid.durationSecs);
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
          [newContentId, vid.views, vid.likes, vid.comments]
        );
      } else {
        await db.query(
          `INSERT INTO metrics_snapshot (content_id, views, likes, comments) VALUES ($1, $2, $3, $4)`,
          [existing.rows[0].id, vid.views, vid.likes, vid.comments]
        );
      }
    }
    
    // Log the scan result
    await db.query(
      'INSERT INTO scan_log (platform, jumlah_post_baru, jumlah_unmatched) VALUES ($1, $2, $3)',
      ['ALL', newPosts, unmatched]
    );

    console.log('Scan completed. New Posts:', newPosts);
  } catch (err) {
    console.error('Scan failed:', err);
  }
}

module.exports = { runFullScan, matchEditorCode };
