import { requireAnyAuth, requireAdmin } from '../../src/middlewares/sessionAuth.js';
import scanService from '../../src/services/scanService.js';
import db from '../../src/config/db.js';
import { getChannelIds } from '../../src/services/channelService.js';

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

const AUTO_EVERY_MIN = 15;

async function handler(req, res) {
  if (req.method === 'GET' && req.url.includes('/status')) {
    await new Promise((resolve, reject) => {
      requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

    const ids = await getChannelIds();
    let lastScan = null;
    try {
      const r = await db.query('SELECT * FROM scan_log ORDER BY id DESC LIMIT 1');
      lastScan = r.rows[0] || null;
    } catch (e) {}
    return res.json({
      youtube_api_key: !!process.env.YOUTUBE_API_KEY,
      youtube_channels: ids.length,
      database_url: !!process.env.DATABASE_URL,
      google_oauth_client: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      last_scan: lastScan,
    });
  }

  if (req.method === 'POST') {
    await new Promise((resolve, reject) => {
      requireAdmin(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });
    return runLocked(res, 'Manual scan started');
  }

  if (req.method === 'GET' && (req.url.includes('/auto') || req.url === '/api/scan/auto')) {
    await new Promise((resolve, reject) => {
      requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

    try {
      const since = await minutesSinceLastScan();
      if (since < AUTO_EVERY_MIN) return res.json({ skipped: true, reason: 'Data masih baru', menit_lalu: Math.floor(since) });
      return runLocked(res, 'Auto scan started');
    } catch (err) {
      return res.status(500).json({ error: 'Sinkronisasi otomatis gagal.' });
    }
  }

  if (req.method === 'GET' && (req.url.includes('/cron') || req.url === '/api/scan/cron')) {
    try {
      const fromCron = req.headers['user-agent'] === 'vercel-cron/1.0' || req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
      if (!fromCron && (await minutesSinceLastScan()) < AUTO_EVERY_MIN) return res.json({ skipped: true, reason: 'Data masih baru' });
      return runLocked(res, 'Cron triggered scan started');
    } catch (err) {
      return res.status(500).json({ error: 'Cron scan gagal' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;