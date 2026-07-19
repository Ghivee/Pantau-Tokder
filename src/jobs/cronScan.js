const cron = require('node-cron');
const scanService = require('../services/scanService');

function initCron() {
  const hours = process.env.SCAN_INTERVAL_HOURS || 6;
  cron.schedule(`0 */${hours} * * *`, async () => {
    console.log(`Menjalankan scan terjadwal (setiap ${hours} jam)...`);
    await scanService.runFullScan();
  });
  console.log(`Cron job scheduled every ${hours} hours.`);
}

module.exports = { initCron };
