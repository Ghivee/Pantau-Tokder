const axios = require('axios');
const db = require('../config/db');
const { channelIds: envChannelIds } = require('../integrations/youtube');
const DEFAULT_CHANNELS = require('../config/channels');

async function readSetting(key) {
  try {
    const r = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
    return r.rows[0] ? r.rows[0].value : null;
  } catch (e) {
    return null;
  }
}

async function writeSetting(key, value) {
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
}

// Channels saved from the Pengaturan page win over the Vercel variables.
async function getChannelIds() {
  const saved = await readSetting('youtube_channel_ids');
  const ids = saved ? saved.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return ids.length ? ids : envChannelIds();
}

async function getChannelNames() {
  const names = Object.fromEntries(DEFAULT_CHANNELS.map((c) => [c.id, c.nama]));
  try {
    return { ...names, ...JSON.parse((await readSetting('youtube_channel_names')) || '{}') };
  } catch (e) {
    return names;
  }
}

// Accepts a channel ID (UC…), a channel link, or a handle (@nama / youtube.com/@nama).
async function resolveChannel(input) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const raw = String(input || '').trim();
  if (!raw) return null;
  const idMatch = raw.match(/(UC[\w-]{22})/);
  const handleMatch = raw.match(/@([\w.-]+)/);
  if (!apiKey) {
    if (idMatch) return { id: idMatch[1], nama: idMatch[1] };
    throw new Error('YOUTUBE_API_KEY belum diatur, jadi hanya ID channel (UC…) yang bisa dipakai');
  }
  const params = { key: apiKey, part: 'snippet' };
  if (idMatch) params.id = idMatch[1];
  else if (handleMatch) params.forHandle = '@' + handleMatch[1];
  else throw new Error(`"${raw}" bukan ID channel, link channel, atau @handle`);
  const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', { params });
  const item = (res.data.items || [])[0];
  if (!item) throw new Error(`Channel "${raw}" tidak ditemukan di YouTube`);
  return { id: item.id, nama: item.snippet.title };
}

async function saveChannels(inputs) {
  const list = [];
  for (const input of inputs) {
    const ch = await resolveChannel(input);
    if (ch && !list.some((c) => c.id === ch.id)) list.push(ch);
  }
  if (!list.length) throw new Error('Isi minimal satu channel');
  if (list.length > 10) throw new Error('Maksimal 10 channel');
  await writeSetting('youtube_channel_ids', list.map((c) => c.id).join(','));
  const names = await getChannelNames();
  list.forEach((c) => { names[c.id] = c.nama; });
  await writeSetting('youtube_channel_names', JSON.stringify(names));
  return list;
}

module.exports = { getChannelIds, getChannelNames, saveChannels };
