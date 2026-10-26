const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const scanService = require('../services/scanService');
const db = require('../config/db');
const dataService = require('../services/dataService');
const { getChannelIds } = require('../services/channelService');
const { requireAdmin } = require('../middlewares/sessionAuth');
const { pengingatAbsen } = require('../services/pengingatService');

// GET: which data sources are configured, and how the last sync went
router.get('/status', async (req, res) => {
  try {
    res.json(await dataService.scanStatus());
  } catch (err) {
    fail(res, err);
  }
});

// Only one sync at a time: a run claims the lock for up to 3 minutes.
async function claimLock() {
  const r = await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('scan_lock', 'berjalan', NOW())
     ON CONFLICT (key) DO UPDATE SET value = 'berjalan', updated_at = NOW()
     WHERE settings.updated_at < NOW() - INTERVAL '3 minutes'
     RETURNING key`
  );
  return r.rows.length > 0;
}
const releaseLock = () => db.query(`UPDATE settings SET updated_at = NOW() - INTERVAL '1 hour' WHERE key = 'scan_lock'`).catch(() => {});

async function minutesSinceLastScan() {
  try {
    const r = await db.query(`SELECT EXTRACT(EPOCH FROM (NOW() - MAX(COALESCE(waktu_scan, NOW() - INTERVAL '1 year')))) / 60 AS m FROM scan_log`);
    return r.rows[0].m == null ? Infinity : Number(r.rows[0].m);
  } catch (e) {
    const r = await db.query(`SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 60 AS m FROM scan_log`).catch(() => ({ rows: [{}] }));
    return r.rows[0].m == null ? Infinity : Number(r.rows[0].m);
  }
}

async function runLocked(res, label) {
  if (!(await claimLock())) return res.json({ skipped: true, reason: 'Sinkronisasi lain sedang berjalan' });
  try {
    console.log(label);
    const result = await scanService.runFullScan();
    res.json({ message: 'Scan completed', ...result });
  } finally {
    await releaseLock();
  }
}

// How often anyone opening the dashboard may trigger a sync.
const AUTO_EVERY_MIN = 15;

// POST: Run full sync now (owner only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    await runLocked(res, 'Manual scan started');
  } catch (err) {
    console.error('Scan route error:', err);
    fail(res, err, 'Sinkronisasi gagal. Lihat log Vercel untuk detailnya.');
  }
});

// GET: sync when the last one is older than AUTO_EVERY_MIN minutes. Called by the app while it is open.
router.get('/auto', async (req, res) => {
  try {
    const since = await minutesSinceLastScan();
    if (since < AUTO_EVERY_MIN) return res.json({ skipped: true, reason: 'Data masih baru', menit_lalu: Math.floor(since) });
    await runLocked(res, 'Auto scan started');
  } catch (err) {
    console.error('Auto scan error:', err);
    fail(res, err, 'Sinkronisasi otomatis gagal.');
  }
});

// GET: Cron endpoint (Vercel Cron daily, GitHub Actions hourly; open without login but throttled)
router.get('/cron', async (req, res) => {
  try {
    // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Anyone else is held to the normal pace.
    const secret = process.env.CRON_SECRET;
    const fromCron = !!secret && req.headers['authorization'] === `Bearer ${secret}`;
    // Check-in reminders ride on the same schedule; each goes out at most once per person per day.
    const pengingat = await pengingatAbsen().catch((e) => { console.error('Pengingat absen gagal:', e.message); return 0; });
    if (!fromCron && (await minutesSinceLastScan()) < AUTO_EVERY_MIN) return res.json({ skipped: true, reason: 'Data masih baru', pengingat });
    await runLocked(res, 'Cron triggered scan started');
  } catch (err) {
    console.error('Cron scan route error:', err);
    fail(res, err);
  }
});

module.exports = router;