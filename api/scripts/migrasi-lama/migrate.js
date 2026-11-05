require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('../../src/config/db');

async function migrate() {
  try {
    await db.query(`ALTER TABLE content ADD COLUMN tipe_video VARCHAR(20) DEFAULT 'long' CHECK (tipe_video IN ('short','long'))`);
    console.log("Added tipe_video");
  } catch(e) {
    console.log("tipe_video maybe exists:", e.message);
  }

  try {
    await db.query(`ALTER TABLE content ADD COLUMN revenue NUMERIC DEFAULT 0`);
    console.log("Added revenue to content");
  } catch(e) {
    console.log("revenue (content) maybe exists:", e.message);
  }

  try {
    await db.query(`ALTER TABLE metrics_snapshot ADD COLUMN revenue NUMERIC DEFAULT 0`);
    console.log("Added revenue to metrics_snapshot");
  } catch(e) {
    console.log("revenue (snapshot) maybe exists:", e.message);
  }
  
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS affiliate_goals (
      id SERIAL PRIMARY KEY, 
      bulan VARCHAR(7) UNIQUE NOT NULL, 
      target_omset NUMERIC DEFAULT 0, 
      tercapai NUMERIC DEFAULT 0, 
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    console.log("Goals table ready");
  } catch(e) {
    console.log("Goals table err:", e.message);
  }
  process.exit(0);
}
migrate();
