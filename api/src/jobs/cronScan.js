const cron = require('node-cron');
const scanService = require('../services/scanService');

function initCron() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("host:5432")) {
    console.log("Cron disabled: Menggunakan data dummy lokal (DATABASE_URL belum diatur).");
    return;
  }
  const hours = process.env.SCAN_INTERVAL_HOURS || 6;
  cron.schedule(`0 */${hours} * * *`, async () => {
    console.log(`Menjalankan scan terjadwal (setiap ${hours} jam)...`);
    await scanService.runFullScan();
  });
  console.log(`Cron job scheduled every ${hours} hours.`);
}

module.exports = { initCron };
