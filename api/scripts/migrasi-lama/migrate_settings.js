require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('../../src/config/db');

async function migrate() {
  try {
    // Create settings table to store OAuth tokens
    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created settings table.');
    console.log('Migration complete!');
  } catch(err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
