const db = require('../config/db');
const axios = require('axios');
const { getAccessToken, fetchOwnChannel, fetchChannelDaily, pakaiMataUang } = require('../integrations/analytics');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

const PREFIX = 'google_refresh_token:';

async function saveConnection(channel, refreshToken) {
  const encrypted = encrypt(refreshToken);
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [PREFIX + channel.id, encrypted]
  );
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    ['analytics_nama:' + channel.id, channel.nama]
  );
}

async function removeConnection(channelId) {
  await db.query('DELETE FROM settings WHERE key = $1 OR key = $2', [PREFIX + channelId, 'analytics_nama:' + channelId]);
}

// The single token saved by the older version: find out which channel it is for and store it per channel.
async function migrateLegacyToken() {
  const r = await db.query(`SELECT value FROM settings WHERE key = 'google_refresh_token'`);
  if (!r.rows.length || !r.rows[0].value) return;
  try {
    const access = await getAccessToken(r.rows[0].value);
    const ch = await fetchOwnChannel(access);
    if (ch) {
      await saveConnection(ch, r.rows[0].value); // saveConnection will encrypt
      await db.query(`DELETE FROM settings WHERE key = 'google_refresh_token'`);
    }
  } catch (e) {
    console.warn('Legacy analytics token could not be migrated:', e.message);
  }
}

async function listConnections() {
  const r = await db.query(
    `SELECT t.key, t.updated_at, n.value AS nama FROM settings t
     LEFT JOIN settings n ON n.key = 'analytics_nama:' || substring(t.key from ${PREFIX.length + 1})
     WHERE t.key LIKE $1`,
    [PREFIX + '%']
  );
  return r.rows.map((row) => ({ channel_id: row.key.slice(PREFIX.length), nama: row.nama, updated_at: row.updated_at }));
}

// Google access tokens last an hour; reuse one for 50 minutes instead of asking Google on every request.
const tokenCache = new Map();
async function cachedAccessToken(key, refreshToken) {
  const hit = tokenCache.get(key);
  if (hit && hit.refresh === refreshToken && hit.until > Date.now()) return hit.token;
  const token = await getAccessToken(refreshToken);
  tokenCache.set(key, { token, refresh: refreshToken, until: Date.now() + 50 * 60 * 1000 });
  return token;
}

// Access token for one channel, or null when it is not connected. Throws when the saved token is unusable.
async function accessTokenFor(channelId) {
  const r = await db.query('SELECT key, value FROM settings WHERE key = $1', [PREFIX + channelId]);
  if (!r.rows.length) return null;
  return cachedAccessToken(r.rows[0].key, decrypt(r.rows[0].value));
}

// channel id → fresh access token, for every connected channel
async function accessTokens() {
  await migrateLegacyToken();
  failures.length = 0;
  const names = Object.fromEntries((await listConnections()).map((c) => [c.channel_id, c.nama]));
  const r = await db.query('SELECT key, value FROM settings WHERE key LIKE $1', [PREFIX + '%']);
  const out = {};
  for (const row of r.rows) {
    const id = row.key.slice(PREFIX.length);
    try {
      const token = decrypt(row.value);
      out[id] = await cachedAccessToken(row.key, token);
      // Tokens saved before encryption existed are encrypted on first use.
      if (!isEncrypted(row.value) && isEncrypted(encrypt(token))) {
        await db.query('UPDATE settings SET value = $1 WHERE key = $2', [encrypt(token), row.key]);
      }
    } catch (e) {
      const msg = e.response?.data?.error_description || e.response?.data?.error || e.message;
      console.warn(`Analytics token for ${row.key} failed:`, msg);
      failures.push(`Analytics ${names[id] || id}: ${msg}`);
    }
  }
  return out;
}

// Problems from the last accessTokens() call, for the sync notes in Pengaturan.
const failures = [];
const takeTokenErrors = () => failures.splice(0, failures.length);

function wibDate(offsetDays) {
  return new Date(Date.now() + 7 * 3600 * 1000 - offsetDays * 86400000).toISOString().slice(0, 10);
}

async function syncChannelDaily(channelId, accessToken, days = 95) {
  const rows = await fetchChannelDaily(accessToken, wibDate(days), wibDate(0));
  if (!rows.length) return 0;
  const params = [];
  const values = rows.map((r) => {
    params.push(channelId, r.tanggal, r.views, r.menit_tonton, r.sub_naik, r.sub_turun, r.revenue);
    const b = params.length - 7;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, NOW())`;
  });
  await db.query(
    `INSERT INTO channel_daily (channel_id, tanggal, views, menit_tonton, sub_naik, sub_turun, revenue, updated_at)
     VALUES ${values.join(', ')}
     ON CONFLICT (channel_id, tanggal) DO UPDATE SET views = EXCLUDED.views, menit_tonton = EXCLUDED.menit_tonton,
       sub_naik = EXCLUDED.sub_naik, sub_turun = EXCLUDED.sub_turun, revenue = EXCLUDED.revenue, updated_at = NOW()`,
    params
  );
  return rows.length;
}

// One-time switch of stored revenue from US$ to rupiah. Stored figures are multiplied by
// today's rate in one transaction; the next syncs then overwrite recent days and videos with
// YouTube's own rupiah figures. Until a rate can be fetched, everything stays in US$.
const KUNCI_RUPIAH = 'pendapatan_rupiah';

async function kursUsdIdr() {
  const sumber = [
    ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR', (d) => d.rates && d.rates.IDR],
    ['https://open.er-api.com/v6/latest/USD', (d) => d.rates && d.rates.IDR],
  ];
  for (const [url, ambil] of sumber) {
    try {
      const k = Number(ambil((await axios.get(url, { timeout: 8000 })).data));
      if (k > 1000 && k < 100000) return { kurs: k, sumber: new URL(url).host };
    } catch (e) { console.warn('Kurs', url, e.message); }
  }
  return null;
}

async function pastikanRupiah() {
  const ada = await db.query('SELECT value FROM settings WHERE key = $1', [KUNCI_RUPIAH]);
  if (ada.rows[0]) { pakaiMataUang('IDR'); return { rupiah: true, baru: false }; }
  const k = await kursUsdIdr();
  if (!k || !db.pool) { pakaiMataUang('USD'); return { rupiah: false }; }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Inserted first: a second scan running at the same time stops here instead of converting twice.
    const r = await client.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO NOTHING RETURNING key`,
      [KUNCI_RUPIAH, JSON.stringify({ kurs: k.kurs, sumber: k.sumber, waktu: new Date().toISOString() })]);
    if (r.rows.length) {
      await client.query('UPDATE content SET revenue = revenue * $1 WHERE revenue IS NOT NULL AND revenue <> 0', [k.kurs]);
      await client.query('UPDATE channel_daily SET revenue = revenue * $1 WHERE revenue IS NOT NULL AND revenue <> 0', [k.kurs]);
      await client.query('UPDATE metrics_snapshot SET revenue = revenue * $1 WHERE revenue IS NOT NULL AND revenue <> 0', [k.kurs]);
    }
    await client.query('COMMIT');
    pakaiMataUang('IDR');
    return { rupiah: true, baru: r.rows.length > 0, kurs: k.kurs };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    pakaiMataUang('USD');
    throw e;
  } finally {
    client.release();
  }
}

// Periode 365 hari butuh riwayat setahun. Setiap channel mengambil 400 hari sekali (ditandai di settings), sesudah itu cukup
// 95 hari terakhir tiap sinkronisasi. Tanda hanya dipasang setelah pengambilan berhasil, jadi yang gagal diulang berikutnya.
const KUNCI_RIWAYAT = 'riwayat_harian_v1:';

async function hariSinkron(channelId, rupiahBaru) {
  if (rupiahBaru) return 400;
  const r = await db.query('SELECT 1 FROM settings WHERE key = $1', [KUNCI_RIWAYAT + channelId]);
  return r.rows.length ? 95 : 400;
}

async function tandaiRiwayat(channelId, hari) {
  if (hari < 400) return;
  await db.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, [KUNCI_RIWAYAT + channelId, new Date().toISOString()]);
}

module.exports = { hariSinkron, tandaiRiwayat, pastikanRupiah, saveConnection, removeConnection, listConnections, accessTokens, accessTokenFor, takeTokenErrors, syncChannelDaily, migrateLegacyToken };
