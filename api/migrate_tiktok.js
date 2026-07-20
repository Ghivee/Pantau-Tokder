require('dotenv').config();
const db = require('./src/config/db');

async function migrate() {
  try {
    // 1. Drop old constraint and add new one
    await db.query(`ALTER TABLE content DROP CONSTRAINT IF EXISTS content_platform_check`);
    await db.query(`ALTER TABLE content ADD CONSTRAINT content_platform_check CHECK (platform IN ('youtube','instagram','facebook','tiktok'))`);
    console.log("Updated platform check constraint to include tiktok.");

  } catch (err) {
    console.error("Migration error:", err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
