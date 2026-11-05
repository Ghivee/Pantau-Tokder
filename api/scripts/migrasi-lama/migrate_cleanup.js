require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('../../src/config/db');

async function migrate() {
  try {
    // 1. Delete all non-YouTube dummy data
    const del = await db.query(`DELETE FROM content WHERE platform IN ('instagram', 'facebook', 'tiktok')`);
    console.log(`Deleted ${del.rowCount} dummy rows (IG/FB/TikTok).`);

    // 2. Also clean up orphaned metrics_snapshot entries
    await db.query(`DELETE FROM metrics_snapshot WHERE content_id NOT IN (SELECT id FROM content)`);
    console.log('Cleaned up orphaned metrics_snapshot rows.');

    // 3. Add duration_secs column
    try {
      await db.query(`ALTER TABLE content ADD COLUMN duration_secs INTEGER DEFAULT 0`);
      console.log('Added duration_secs column.');
    } catch(e) {
      console.log('duration_secs column may already exist:', e.message);
    }

    console.log('Migration complete!');
  } catch(err) {
    console.error('Migration error:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
