const db = require('../config/db');
const { getAccessToken, fetchOwnChannel, fetchChannelDaily } = require('../integrations/analytics');
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

module.exports = { saveConnection, removeConnection, listConnections, accessTokens, accessTokenFor, takeTokenErrors, syncChannelDaily, migrateLegacyToken };
