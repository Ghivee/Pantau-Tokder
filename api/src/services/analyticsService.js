const db = require('../config/db');
const { getAccessToken, fetchOwnChannel, fetchChannelDaily } = require('../integrations/analytics');
const { encrypt, decrypt } = require('../utils/encryption');

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

// channel id → fresh access token, for every connected channel
async function accessTokens() {
  await migrateLegacyToken();
  const r = await db.query('SELECT key, value FROM settings WHERE key LIKE $1', [PREFIX + '%']);
  const out = {};
  for (const row of r.rows) {
    try {
      const decrypted = decrypt(row.value);
      out[row.key.slice(PREFIX.length)] = await getAccessToken(decrypted);
    } catch (e) {
      console.warn(`Analytics token for ${row.key} failed:`, e.response?.data?.error || e.message);
    }
  }
  return out;
}

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

module.exports = { saveConnection, removeConnection, listConnections, accessTokens, syncChannelDaily, migrateLegacyToken };
