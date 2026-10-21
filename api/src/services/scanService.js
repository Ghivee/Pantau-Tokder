const db = require('../config/db');
const { fetchNewVideos, fetchVideosByIds, channelIds } = require('../integrations/youtube');
const { fetchRetentionData, fetchRevenueData, getAccessToken } = require('../integrations/analytics');

function matchEditorCode(captionText, editors) {
  if (!captionText) return null;
  const upperCaption = captionText.toUpperCase();
  for (const ed of editors) {
    const code = (ed.kode_identifikasi || ed.kode || '').toUpperCase().replace(/^#/, '');
    if (!code) continue;
    // The code must stand alone ("#DE" or "DE"), so "KODE" or "DESA" do not count as DE.
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^A-Z0-9])#?${escaped}($|[^A-Z0-9])`).test(upperCaption)) return ed.id;
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
    'SELECT id, editor_id, status_identifikasi, revenue FROM content WHERE post_id = $1 AND platform = $2',
    [vid.post_id, vid.platform]
  );

  const matchedEditorId = matchEditorCode(vid.description, editors);
  const statusIdentifikasi = matchedEditorId ? 'matched' : 'unmatched';

  if (existing.rows.length === 0) {
    // New video — get real retention or generate mock
    const avgDurationSecs = vid.durationSecs * (Math.random() * 0.3 + 0.4);
    
    // Try real retention data and revenue first
    let retentionData = null;
    let revenueData = 0;
    if (accessToken) {
      retentionData = await fetchRetentionData(vid.post_id, accessToken);
      if (retentionData) console.log(`  ✅ Real retention for ${vid.post_id}: ${retentionData.length} points`);
      
      const rev = await fetchRevenueData(vid.post_id, accessToken);
      if (rev !== null) {
        revenueData = rev;
        console.log(`  💰 Revenue for ${vid.post_id}: ${revenueData}`);
      }
    }
    // Fall back to mock if no real data
    if (!retentionData) {
      retentionData = generateRetentionMock(vid.durationSecs);
    }

    const insertRes = await db.query(
      `INSERT INTO content 
       (post_id, platform, url, judul, tanggal_upload, editor_id, status_identifikasi, 
        tipe_video, duration_secs, avg_view_duration, retention_data, revenue, channel_id, channel_nama) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [
        vid.post_id, vid.platform, vid.url, vid.title, vid.publishedAt,
        matchedEditorId, statusIdentifikasi, vid.tipe_video,
        vid.durationSecs,
        formatAvgDuration(avgDurationSecs),
        JSON.stringify(retentionData),
        revenueData,
        vid.channelId || null,
        vid.channelTitle || null
      ]
    );
    const newContentId = insertRes.rows[0].id;
    await db.query(
      `INSERT INTO metrics_snapshot (content_id, views, likes, comments, revenue) VALUES ($1, $2, $3, $4, $5)`,
      [newContentId, vid.views || 0, vid.likes || 0, vid.comments || 0, revenueData]
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
    
    let currentRevenue = contentRow.revenue || 0;
    const ageDays = (Date.now() - new Date(vid.publishedAt).getTime()) / 86400000;
    if (accessToken && ageDays <= 14) {
      const retentionData = await fetchRetentionData(vid.post_id, accessToken);
      const rev = await fetchRevenueData(vid.post_id, accessToken);
      if (rev !== null) currentRevenue = rev;

      if (retentionData) {
        await db.query(
          `UPDATE content SET duration_secs = $1, retention_data = $2, editor_id = $3, status_identifikasi = $4, revenue = $5 WHERE id = $6`,
          [vid.durationSecs, JSON.stringify(retentionData), finalEditorId, finalStatus, currentRevenue, contentId]
        );
      } else {
        await db.query(
          `UPDATE content SET duration_secs = $1, editor_id = $2, status_identifikasi = $3, revenue = $4 WHERE id = $5`, 
          [vid.durationSecs, finalEditorId, finalStatus, currentRevenue, contentId]
        );
      }
    } else {
      await db.query(
        `UPDATE content SET duration_secs = $1, editor_id = $2, status_identifikasi = $3 WHERE id = $4`, 
        [vid.durationSecs, finalEditorId, finalStatus, contentId]
      );
    }
    
    if (vid.channelId) {
      await db.query('UPDATE content SET channel_id = $1, channel_nama = $2 WHERE id = $3', [vid.channelId, vid.channelTitle || null, contentId]);
    }
    await db.query(
      `INSERT INTO metrics_snapshot (content_id, views, likes, comments, revenue) VALUES ($1, $2, $3, $4, $5)`,
      [contentId, vid.views || 0, vid.likes || 0, vid.comments || 0, currentRevenue]
    );
    // If it was unmatched but now matched, we can return false for unmatched
    return { isNew: false, unmatched: finalStatus === 'unmatched' };
  }
}

// Stop before the serverless function limit; the next run picks up the rest.
const TIME_BUDGET_MS = 45000;

async function runFullScan() {
  const startedAt = Date.now();
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
    const ids = channelIds();
    console.log(`Fetching YouTube videos (last 30 days) from ${ids.length} channel(s)...`);
    const ytVideos = [];
    for (const id of ids) ytVideos.push(...(await fetchNewVideos(id)));
    console.log(`Got ${ytVideos.length} YouTube videos.`);

    // Process videos in chunks of 10 concurrently to avoid Vercel 10s timeout
    const chunkSize = 10;
    for (let i = 0; i < ytVideos.length; i += chunkSize) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        errors.push(`Waktu habis: ${ytVideos.length - i} video akan diproses di sinkronisasi berikutnya`);
        break;
      }
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

  // RE-EVALUATE UNMATCHED VIDEOS
  try {
    console.log('Re-evaluating existing unmatched YouTube videos...');
    const unmatchedRes = await db.query("SELECT post_id FROM content WHERE status_identifikasi = 'unmatched' AND platform = 'youtube'");
    const unmatchedIds = unmatchedRes.rows.map(r => r.post_id);
    
    if (unmatchedIds.length > 0 && Date.now() - startedAt < TIME_BUDGET_MS) {
      console.log(`Found ${unmatchedIds.length} unmatched videos in DB. Fetching full details to re-match...`);
      const unmatchedVideosDetails = await fetchVideosByIds(unmatchedIds);
      
      const chunkSize = 10;
      for (let i = 0; i < unmatchedVideosDetails.length; i += chunkSize) {
        const chunk = unmatchedVideosDetails.slice(i, i + chunkSize);
        const promises = chunk.map(async (vid) => {
          try {
            const result = await processVideo(vid, editors, accessToken);
            if (result.isNew) newPosts++;
            else updatedPosts++;
            // We don't increment unmatched counter here to avoid double counting 
            // since they were already counted or are just being re-evaluated
          } catch(e) {
            console.error(`Error processing unmatched video ${vid.post_id}:`, e.message);
          }
        });
        await Promise.all(promises);
      }
      console.log('Re-evaluation of unmatched videos complete.');
    }
  } catch (e) {
    console.error('Error re-evaluating unmatched videos:', e.message);
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
