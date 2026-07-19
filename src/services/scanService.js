const db = require('../config/db');
const { fetchNewVideos, fetchVideoStats } = require('../integrations/youtube');
const { fetchInstagramPosts, fetchInstagramStats } = require('../integrations/instagram');
const { fetchFacebookPosts, fetchFacebookStats } = require('../integrations/facebook');

function matchEditorCode(captionText, editors) {
  if (!captionText) return null;
  const found = editors.find(e =>
    captionText.toUpperCase().includes(e.kode_identifikasi.toUpperCase())
  );
  return found ? found.id : null;
}

async function runFullScan() {
  console.log('Starting full scan...');
  try {
    const editorsRes = await db.query('SELECT * FROM editors WHERE status = $1', ['aktif']);
    const editors = editorsRes.rows;

    // A stub logic for the scan
    let newPosts = 0;
    let unmatched = 0;
    
    // In a real implementation:
    // 1. Fetch from YT, IG, FB
    // 2. Insert into content table if not exists (check by platform and post_id)
    // 3. Match caption with editors
    // 4. Update metrics_snapshot
    
    // Log the scan result
    await db.query(
      'INSERT INTO scan_log (platform, jumlah_post_baru, jumlah_unmatched) VALUES ($1, $2, $3)',
      ['ALL', newPosts, unmatched]
    );

    console.log('Scan completed.');
  } catch (err) {
    console.error('Scan failed:', err);
  }
}

module.exports = { runFullScan, matchEditorCode };
