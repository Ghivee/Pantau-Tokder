require('dotenv').config();
const db = require('./src/config/db');

async function generateRetentionMock(durationSecs) {
  // Generates a mock retention curve.
  // E.g. starts at 100%, drops quickly in first 10s, then slowly declines.
  const data = [];
  let currentVal = 100.0;
  
  // We'll generate 100 points representing percentages of the video length (0% to 100%)
  for (let i = 0; i <= 100; i++) {
    data.push({
      percent_duration: i,
      retention: currentVal
    });
    
    // Simulate drop
    if (i < 10) {
      currentVal -= (Math.random() * 2 + 1); // Steeper drop at start
    } else {
      currentVal -= (Math.random() * 0.8); 
    }
    
    if (currentVal < 0) currentVal = 0;
  }
  
  return data;
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function migrate() {
  try {
    await db.query(`ALTER TABLE content ADD COLUMN avg_view_duration VARCHAR(10)`);
    console.log("Added avg_view_duration");
  } catch(e) {
    console.log("avg_view_duration maybe exists:", e.message);
  }
  
  try {
    await db.query(`ALTER TABLE content ADD COLUMN retention_data JSONB`);
    console.log("Added retention_data");
  } catch(e) {
    console.log("retention_data maybe exists:", e.message);
  }
  
  try {
    // Fetch all content to mock data
    const result = await db.query('SELECT id, tipe_video FROM content');
    for (const row of result.rows) {
      const isShort = row.tipe_video === 'short';
      const durationSecs = isShort ? (Math.random() * 45 + 15) : (Math.random() * 600 + 120);
      const retentionData = await generateRetentionMock(durationSecs);
      
      // avg view duration: maybe 40-70% of the duration
      const avgDurationSecs = durationSecs * (Math.random() * 0.3 + 0.4);
      
      await db.query(
        'UPDATE content SET avg_view_duration = $1, retention_data = $2 WHERE id = $3',
        [formatDuration(avgDurationSecs), JSON.stringify(retentionData), row.id]
      );
    }
    console.log("Mock retention data seeded for", result.rows.length, "rows.");
  } catch (e) {
    console.error("Error seeding:", e.message);
  }
  
  process.exit(0);
}

migrate();
