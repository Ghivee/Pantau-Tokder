const webpush = require('web-push');
const db = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');
const { bad } = require('../utils/httpError');

// Web Push notifications (Android, desktop, and iPhone when the site is added to the home screen).
// The VAPID key pair is made once and kept in settings; the private half is stored encrypted.

const KEY = 'push_vapid';
const SUBJECT = 'mailto:tokodeeres@gmail.com';
let vapid = null;

async function kunci() {
  if (vapid) return vapid;
  const r = await db.query('SELECT value FROM settings WHERE key = $1', [KEY]);
  if (r.rows[0]) {
    const v = JSON.parse(r.rows[0].value);
    vapid = { publicKey: v.publicKey, privateKey: decrypt(v.privateKey) };
    return vapid;
  }
  const k = webpush.generateVAPIDKeys();
  // Two cold starts at once: whoever writes first wins and both use that pair.
  await db.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO NOTHING`,
    [KEY, JSON.stringify({ publicKey: k.publicKey, privateKey: encrypt(k.privateKey) })]);
  vapid = null;
  return kunci();
}

function validasi(sub) {
  const s = sub || {};
  const endpoint = String(s.endpoint || '');
  const keys = s.keys || {};
  if (!/^https:\/\/[^\s]{10,2000}$/.test(endpoint)) throw bad(400, 'Langganan notifikasi tidak valid');
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(String(keys.p256dh || '')) || !/^[A-Za-z0-9_-]{10,100}$/.test(String(keys.auth || ''))) throw bad(400, 'Kunci langganan notifikasi tidak valid');
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

async function simpan({ isAdmin, editor }, sub, perangkat) {
  const s = validasi(sub);
  await db.query(
    `INSERT INTO push_langganan (tipe, editor_id, endpoint, p256dh, auth, perangkat) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE SET tipe = $1, editor_id = $2, p256dh = $4, auth = $5, perangkat = $6, created_at = NOW()`,
    [isAdmin ? 'admin' : 'karyawan', isAdmin ? null : editor.id, s.endpoint, s.p256dh, s.auth, String(perangkat || '').slice(0, 120)]
  );
}

async function hapus(endpoint) {
  await db.query('DELETE FROM push_langganan WHERE endpoint = $1', [String(endpoint || '')]);
}

// Sends to the owner ({ admin: true }) or to one employee ({ editorId }). Never throws:
// a notification that cannot be delivered must not break the action that triggered it.
async function kirim(target, pesan) {
  try {
    const r = target.admin
      ? await db.query(`SELECT endpoint, p256dh, auth FROM push_langganan WHERE tipe = 'admin'`)
      : await db.query(`SELECT endpoint, p256dh, auth FROM push_langganan WHERE tipe = 'karyawan' AND editor_id = $1`, [target.editorId]);
    if (!r.rows.length) return 0;
    const k = await kunci();
    const body = JSON.stringify({ title: pesan.title, body: pesan.body || '', url: pesan.url || '/', tag: pesan.tag || undefined });
    const hasil = await Promise.allSettled(r.rows.map((s) => webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body,
      { vapidDetails: { subject: SUBJECT, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 12 * 3600, timeout: 5000 }
    )));
    // Subscriptions the browser has dropped are removed.
    const mati = r.rows.filter((s, i) => hasil[i].status === 'rejected' && [404, 410].includes(hasil[i].reason && hasil[i].reason.statusCode));
    if (mati.length) await db.query('DELETE FROM push_langganan WHERE endpoint = ANY($1)', [mati.map((s) => s.endpoint)]);
    hasil.forEach((h) => { if (h.status === 'rejected' && !mati.length) console.error('Push gagal:', h.reason && (h.reason.statusCode || h.reason.message)); });
    return hasil.filter((h) => h.status === 'fulfilled').length;
  } catch (e) {
    console.error('Push gagal:', e.message);
    return 0;
  }
}

// Once per key (e.g. one reminder per person per day), however often it is asked.
async function sekali(kunciKirim, fn) {
  const r = await db.query('INSERT INTO push_terkirim (kunci) VALUES ($1) ON CONFLICT DO NOTHING RETURNING kunci', [kunciKirim]);
  if (!r.rows.length) return false;
  await fn();
  return true;
}

async function status({ isAdmin, editor }) {
  const r = isAdmin
    ? await db.query(`SELECT COUNT(*)::int AS n FROM push_langganan WHERE tipe = 'admin'`)
    : await db.query(`SELECT COUNT(*)::int AS n FROM push_langganan WHERE tipe = 'karyawan' AND editor_id = $1`, [editor.id]);
  return { perangkat: r.rows[0].n };
}

module.exports = { kunci, simpan, hapus, kirim, sekali, status, validasi };
