require('dotenv').config();
const db = require('./src/config/db');

async function seed() {
  await db.query("UPDATE content SET tipe_video = 'short' WHERE id IN (2, 3, 5, 6)");
  await db.query("INSERT INTO affiliate_goals (bulan, target_omset, tercapai) VALUES ('2026-07', 10000000, 4500000) ON CONFLICT DO NOTHING");
  console.log("Seeded");
  process.exit(0);
}
seed();
