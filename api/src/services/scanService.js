const db = require('../config/db');
const { fetchNewVideos, fetchVideosByIds } = require('../integrations/youtube');
const { getChannelIds } = require('./channelService');
const analyticsService = require('./analyticsService');
const { fetchRetentionData, fetchRevenueData, takeErrors } = require('../integrations/analytics');

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

// Retention and revenue come only from YouTube Analytics. Without a connected channel they stay
// empty (NULL); nothing is estimated or filled in.
async function fetchAnalytics(videoId, accessToken) {
  if (!accessToken) return { retention: null, revenue: null };
  const [retention, revenue] = await Promise.all([
    fetchRetentionData(videoId, accessToken),
    fetchRevenueData(videoId, accessToken),
  ]);
  return { retention, revenue };
}

// Keep at most one stats snapshot per video per hour, so frequent syncs don't bloat the table.
async function snapshot(contentId, vid, revenue) {
  await db.query(
    `INSERT INTO metrics_snapshot (content_id, views, likes, comments, revenue)
     SELECT $1, $2, $3, $4, $5
     WHERE NOT EXISTS (SELECT 1 FROM metrics_snapshot WHERE content_id = $1 AND timestamp > NOW() - INTERVAL '1 hour')`,
    [contentId, vid.views || 0, vid.likes || 0, vid.comments || 0, revenue || 0]
  );
}

async function processVideo(vid, editors, accessToken, budget) {
  const existing = await db.query(
    'SELECT id, editor_id, status_identifikasi, revenue, retention_data IS NULL AS no_retention FROM content WHERE post_id = $1 AND platform = $2',
    [vid.post_id, vid.platform]
  );
  const matchedEditorId = matchEditorCode(vid.description, editors);
  const ageDays = (Date.now() - new Date(vid.publishedAt).getTime()) / 86400000;

  if (existing.rows.length === 0) {
    const { retention, revenue } = await fetchAnalytics(vid.post_id, accessToken);
    const insertRes = await db.query(
      `INSERT INTO content
       (post_id, platform, url, judul, tanggal_upload, editor_id, status_identifikasi, tipe_video, duration_secs,
        retention_data, retention_source, revenue, channel_id, channel_nama, views, likes, comments, stats_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()) RETURNING id`,
      [
        vid.post_id, vid.platform, vid.url, vid.title, vid.publishedAt,
        matchedEditorId, matchedEditorId ? 'matched' : 'unmatched', vid.tipe_video, vid.durationSecs,
        retention ? JSON.stringify(retention) : null, retention ? 'youtube' : null, revenue,
        vid.channelId || null, vid.channelTitle || null, vid.views || 0, vid.likes || 0, vid.comments || 0,
      ]
    );
    await snapshot(insertRes.rows[0].id, vid, revenue);
    return { isNew: true, unmatched: !matchedEditorId };
  }

  const row = existing.rows[0];
  // A video found unmatched earlier gets its editor once a code appears in the description.
  let editorId = row.editor_id;
  let status = row.status_identifikasi;
  if (status === 'unmatched' && matchedEditorId) {
    editorId = matchedEditorId;
    status = 'matched';
  }

  // Refresh analytics for recent videos, and fill in older ones that still have none (a few per sync).
  let retention = null;
  let revenue = row.revenue;
  const backfill = row.no_retention && budget.backfill > 0;
  if (accessToken && (ageDays <= 14 || backfill)) {
    if (ageDays > 14) budget.backfill--;
    const a = await fetchAnalytics(vid.post_id, accessToken);
    retention = a.retention;
    if (a.revenue !== null) revenue = a.revenue;
  }

  await db.query(
    `UPDATE content SET judul = $1, duration_secs = $2, editor_id = $3, status_identifikasi = $4, revenue = $5,
       channel_id = COALESCE($6, channel_id), channel_nama = COALESCE($7, channel_nama),
       views = $8, likes = $9, comments = $10, stats_at = NOW(),
       retention_data = COALESCE($11, retention_data),
       retention_source = CASE WHEN $11::jsonb IS NULL THEN retention_source ELSE 'youtube' END
     WHERE id = $12`,
    [
      vid.title, vid.durationSecs, editorId, status, revenue, vid.channelId || null, vid.channelTitle || null,
      vid.views || 0, vid.likes || 0, vid.comments || 0, retention ? JSON.stringify(retention) : null, row.id,
    ]
  );
  await snapshot(row.id, vid, revenue);
  return { isNew: false, unmatched: status === 'unmatched' };
}

// Stop before the serverless function limit; the next run picks up the rest.
const TIME_BUDGET_MS = 45000;

async function runFullScan() {
  const startedAt = Date.now();
  takeErrors();
  console.log('=== Starting full scan (YouTube only) ===');

  const editorsRes = await db.query('SELECT * FROM editors WHERE status = $1', ['aktif']);
  const editors = editorsRes.rows;
  console.log(`Found ${editors.length} active editors.`);

  // One YouTube Analytics token per connected channel.
  let tokens = {};
  try {
    tokens = await analyticsService.accessTokens();
    console.log(`Analytics connected for ${Object.keys(tokens).length} channel(s).`);
  } catch (e) {
    console.warn('Could not load analytics tokens:', e.message);
  }
  const tokenFor = (vid) => tokens[vid.channelId] || null;
  // Revenue in rupiah from now on (converts the stored US$ figures once).
  let rupiah = { rupiah: false };
  try { rupiah = await analyticsService.pastikanRupiah(); } catch (e) { console.warn('Konversi rupiah gagal:', e.message); }
  const budget = { backfill: 25 };

  let newPosts = 0;
  let updatedPosts = 0;
  let unmatched = 0;
  const errors = [];

  // YouTube only — no TikTok/IG/FB mock
  try {
    const ids = await getChannelIds();
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
          const result = await processVideo(vid, editors, tokenFor(vid), budget);
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
            const result = await processVideo(vid, editors, tokenFor(vid), budget);
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

  // Daily channel numbers from YouTube Analytics
  let analyticsDays = 0;
  for (const [channelId, token] of Object.entries(tokens)) {
    if (Date.now() - startedAt > TIME_BUDGET_MS + 8000) break;
    try {
      // Right after the switch to rupiah, the whole stored history is fetched again in rupiah.
      analyticsDays += await analyticsService.syncChannelDaily(channelId, token, rupiah.baru ? 400 : 95);
    } catch (e) {
      errors.push(`Analytics ${channelId} gagal: ${e.response?.data?.error?.message || e.message}`);
    }
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

  errors.push(...analyticsService.takeTokenErrors(), ...takeErrors());
  const summary = { newPosts, updatedPosts, unmatched, analyticsChannels: Object.keys(tokens).length, analyticsDays, errors: errors.length > 0 ? errors : undefined };
  // Kept for the Pengaturan page, so problems are visible without opening server logs.
  try {
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('last_scan_summary', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify({ ...summary, selesai: new Date().toISOString(), detik: Math.round((Date.now() - startedAt) / 1000) })]
    );
  } catch (e) {
    console.error('last_scan_summary write error:', e.message);
  }
  console.log('=== Scan complete ===', summary);
  return summary;
}

module.exports = { runFullScan, matchEditorCode };
