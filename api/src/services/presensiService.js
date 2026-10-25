const net = require('net');
const db = require('../config/db');
const { bad } = require('../utils/httpError');

const CONFIG_KEY = 'presensi_config';
const DEFAULTS = { lat: null, lng: null, radius: 100, akurasi_maks: 50, ips: [], jam_masuk: '08:00', toleransi: 10, jam_pulang: '17:00' };
const MAX_UMUR_LOKASI_MS = 2 * 60 * 1000;
const MAX_SELISIH_JAM_MS = 5 * 60 * 1000;
const KECEPATAN_MAKS_KMJ = 150;

function todayWib(now = Date.now()) {
  return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function menitWib(now = Date.now()) {
  const d = new Date(now + 7 * 3600 * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

const keMenit = (jam) => { const [h, m] = String(jam).split(':').map(Number); return h * 60 + m; };

// Distance in metres between two coordinates (haversine).
function jarakMeter(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Accepts single addresses and ranges: 203.0.113.7, 203.0.113.0/24, 2001:db8:1:2::/64.
function parseIp(entry) {
  const [addr, bits, extra] = String(entry).trim().split('/');
  const version = net.isIP(addr);
  if (!version || extra !== undefined) return null;
  const max = version === 4 ? 32 : 128;
  const prefix = bits === undefined ? max : Number(bits);
  if (!Number.isInteger(prefix) || prefix < (version === 4 ? 8 : 32) || prefix > max || (bits !== undefined && !/^\d+$/.test(bits))) return null;
  return { addr, prefix, type: version === 4 ? 'ipv4' : 'ipv6' };
}

// What the owner should register for this address: itself for IPv4; for IPv6 the network's
// /64 prefix, because each phone on the office Wi-Fi gets its own IPv6 address within it.
function ipSaran(ip) {
  if (net.isIP(ip) !== 6) return ip;
  const [head, tail = ''] = ip.split('::');
  const a = head ? head.split(':') : [];
  const b = tail ? tail.split(':') : [];
  const full = ip.includes('::') ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
  return full.slice(0, 4).map((x) => (parseInt(x, 16) || 0).toString(16)).join(':') + '::/64';
}

function ipTerdaftar(ip, entries) {
  const version = net.isIP(ip);
  if (!version) return false;
  const list = new net.BlockList();
  for (const e of entries) {
    const p = parseIp(e);
    if (p) list.addSubnet(p.addr, p.prefix, p.type);
  }
  return list.check(ip, version === 4 ? 'ipv4' : 'ipv6');
}

// Checks what the owner typed; returns a clean config or throws a readable error.
function validasiConfig(body) {
  const b = body || {};
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (b.lat === '' || b.lat == null || !Number.isFinite(lat) || lat < -90 || lat > 90) throw bad(400, 'Garis lintang (lat) kantor harus angka -90 sampai 90');
  if (b.lng === '' || b.lng == null || !Number.isFinite(lng) || lng < -180 || lng > 180) throw bad(400, 'Garis bujur (lng) kantor harus angka -180 sampai 180');
  const radius = Number(b.radius);
  if (!Number.isInteger(radius) || radius < 20 || radius > 2000) throw bad(400, 'Radius kantor harus 20–2000 meter');
  const akurasi = Number(b.akurasi_maks);
  if (!Number.isInteger(akurasi) || akurasi < 5 || akurasi > 500) throw bad(400, 'Akurasi GPS maksimal harus 5–500 meter');
  const ips = (Array.isArray(b.ips) ? b.ips : String(b.ips || '').split(/[\s,;]+/)).map((x) => String(x).trim()).filter(Boolean);
  if (!ips.length) throw bad(400, 'Isi minimal satu IP publik Wi-Fi kantor');
  if (ips.length > 20) throw bad(400, 'Maksimal 20 IP kantor');
  const salah = ips.find((x) => !parseIp(x));
  if (salah) throw bad(400, `IP "${salah}" tidak valid. Contoh: 203.0.113.7 atau 203.0.113.0/24`);
  const jam = (v, nama) => {
    const s = String(v || '').replace('.', ':');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw bad(400, `${nama} harus format JJ:MM, misal 08:00`);
    return s;
  };
  const jam_masuk = jam(b.jam_masuk, 'Jam masuk');
  const jam_pulang = jam(b.jam_pulang, 'Jam pulang');
  if (keMenit(jam_pulang) <= keMenit(jam_masuk)) throw bad(400, 'Jam pulang harus setelah jam masuk');
  const toleransi = Number(b.toleransi);
  if (!Number.isInteger(toleransi) || toleransi < 0 || toleransi > 120) throw bad(400, 'Toleransi telat harus 0–120 menit');
  return { lat, lng, radius, akurasi_maks: akurasi, ips: [...new Set(ips)], jam_masuk, toleransi, jam_pulang };
}

async function getConfig() {
  const r = await db.query('SELECT value FROM settings WHERE key = $1', [CONFIG_KEY]);
  let saved = {};
  try { saved = r.rows[0] ? JSON.parse(r.rows[0].value) : {}; } catch (e) { saved = {}; }
  const cfg = { ...DEFAULTS, ...saved };
  cfg.siap = Number.isFinite(cfg.lat) && Number.isFinite(cfg.lng) && cfg.ips.length > 0;
  return cfg;
}

async function saveConfig(body) {
  const cfg = validasiConfig(body);
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [CONFIG_KEY, JSON.stringify(cfg)]
  );
  return { ...cfg, siap: true };
}

// The anti-cheat rules. Pure: everything it needs is passed in, so it can be tested.
// `terakhir` is this employee's latest recorded position (accepted or refused) for the jump check.
function periksa({ cfg, jenis, lat, lng, akurasi, diambil, ip, now = Date.now(), terakhir = null }) {
  if (!cfg.siap) return { ok: false, alasan: 'Presensi belum diatur oleh pemilik (lokasi kantor dan IP Wi-Fi kantor).' };
  if (!['masuk', 'pulang'].includes(jenis)) return { ok: false, alasan: 'Jenis presensi tidak dikenal' };

  // Layer 1: network. Only the office Wi-Fi's public IP counts, whatever the GPS says.
  if (!ipTerdaftar(ip, cfg.ips)) {
    return { ok: false, alasan: `Anda tidak terhubung ke Wi-Fi kantor (IP Anda ${ip}). Sambungkan ke Wi-Fi kantor dan matikan VPN/data seluler, lalu coba lagi.` };
  }

  // Layer 2: GPS reading quality.
  if (![lat, lng, akurasi].every(Number.isFinite) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, alasan: 'Data lokasi tidak lengkap atau tidak valid.' };
  }
  if (akurasi < 1) return { ok: false, alasan: `Akurasi GPS tidak wajar (± ${akurasi} m). Matikan aplikasi lokasi palsu, lalu coba lagi.` };
  if (akurasi > cfg.akurasi_maks) {
    return { ok: false, alasan: `Akurasi GPS terlalu besar (± ${Math.round(akurasi)} m, maksimal ${cfg.akurasi_maks} m). Nyalakan GPS / lokasi akurat, tunggu sebentar, lalu coba lagi.` };
  }
  if (!Number.isFinite(diambil) || Math.abs(now - diambil) > MAX_SELISIH_JAM_MS) {
    return { ok: false, alasan: 'Waktu pengambilan lokasi tidak cocok dengan jam server. Pastikan jam HP otomatis, lalu coba lagi.' };
  }
  if (now - diambil > MAX_UMUR_LOKASI_MS) return { ok: false, alasan: 'Lokasi yang dikirim sudah lama (tersimpan di cache). Coba lagi.' };

  // Layer 3: geofence.
  const jarak = jarakMeter(lat, lng, cfg.lat, cfg.lng);
  if (jarak > cfg.radius) {
    return { ok: false, jarak, alasan: `Anda berada ${Math.round(jarak)} m dari kantor (batas ${cfg.radius} m).` };
  }

  // Layer 4: a position that jumped faster than a vehicle can travel points to a location changer.
  if (terakhir && Number.isFinite(terakhir.lat) && Number.isFinite(terakhir.lng)) {
    const detik = (now - new Date(terakhir.waktu).getTime()) / 1000;
    const km = jarakMeter(lat, lng, terakhir.lat, terakhir.lng) / 1000;
    if (detik > 0 && detik < 3600 && km > 1 && (km / detik) * 3600 > KECEPATAN_MAKS_KMJ) {
      return { ok: false, jarak, alasan: `Lokasi berpindah ${km.toFixed(1)} km dalam ${Math.max(1, Math.round(detik / 60))} menit, tidak wajar. Matikan aplikasi lokasi palsu.` };
    }
  }
  return { ok: true, jarak };
}

// Latest trustworthy position: accepted check-ins, plus refused ones whose GPS reading was precise.
async function posisiTerakhir(editorId, akurasiMaks) {
  const r = await db.query(
    `SELECT lat, lng, waktu FROM (
       SELECT lat, lng, waktu FROM presensi WHERE editor_id = $1
       UNION ALL SELECT lat, lng, waktu FROM presensi_ditolak
         WHERE editor_id = $1 AND lat IS NOT NULL AND akurasi BETWEEN 1 AND $2
     ) x ORDER BY waktu DESC LIMIT 1`,
    [editorId, akurasiMaks]
  );
  return r.rows[0] || null;
}

async function catatDitolak(editorId, { jenis, lat, lng, akurasi, jarak, ip, ua, alasan }) {
  const num = (v) => (Number.isFinite(v) ? v : null);
  await db.query(
    `INSERT INTO presensi_ditolak (editor_id, jenis, waktu, alasan, lat, lng, akurasi, jarak, ip, user_agent)
     VALUES ($1, $2, NOW() AT TIME ZONE 'UTC', $3, $4, $5, $6, $7, $8, $9)`,
    [editorId, String(jenis || '').slice(0, 10), alasan, num(lat), num(lng), num(akurasi), num(jarak), String(ip).slice(0, 64), String(ua || '').slice(0, 300)]
  );
}

async function absen(editor, body, ip, ua, now = Date.now()) {
  const b = body || {};
  const input = { jenis: b.jenis, lat: Number(b.lat), lng: Number(b.lng), akurasi: Number(b.akurasi), diambil: Number(b.diambil) };
  const cfg = await getConfig();
  const tanggal = todayWib(now);

  const ditolak = async (alasan, jarak) => {
    await catatDitolak(editor.id, { ...input, jarak, ip, ua, alasan });
    throw bad(422, alasan);
  };

  const sudah = await db.query(`SELECT jenis FROM presensi WHERE editor_id = $1 AND tanggal = $2`, [editor.id, tanggal]);
  const jenisAda = sudah.rows.map((r) => r.jenis);
  if (input.jenis === 'masuk' && jenisAda.includes('masuk')) throw bad(409, 'Anda sudah absen masuk hari ini.');
  if (input.jenis === 'pulang' && jenisAda.includes('pulang')) throw bad(409, 'Anda sudah absen pulang hari ini.');
  if (input.jenis === 'pulang' && !jenisAda.includes('masuk')) throw bad(409, 'Absen masuk dulu sebelum absen pulang.');

  const hasil = periksa({ cfg, ...input, ip, now, terakhir: await posisiTerakhir(editor.id, cfg.akurasi_maks) });
  if (!hasil.ok) return ditolak(hasil.alasan, hasil.jarak);

  const telat = input.jenis === 'masuk' ? Math.max(0, menitWib(now) - keMenit(cfg.jam_masuk) - cfg.toleransi) : null;
  const r = await db.query(
    `INSERT INTO presensi (editor_id, tanggal, jenis, waktu, lat, lng, akurasi, jarak, ip, telat_menit)
     VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC', $4, $5, $6, $7, $8, $9)
     ON CONFLICT (editor_id, tanggal, jenis) DO NOTHING
     RETURNING id, editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jenis, waktu, akurasi, jarak, ip, telat_menit`,
    [editor.id, tanggal, input.jenis, input.lat, input.lng, input.akurasi, Math.round(hasil.jarak), ip, telat]
  );
  if (!r.rows.length) throw bad(409, `Anda sudah absen ${input.jenis} hari ini.`);
  return r.rows[0];
}

async function daftar({ dari, sampai, editorId }) {
  const params = [dari, sampai];
  let sql = `SELECT id, editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jenis, waktu, akurasi, jarak, ip, telat_menit
             FROM presensi WHERE tanggal BETWEEN $1 AND $2`;
  if (editorId) { params.push(editorId); sql += ` AND editor_id = $3`; }
  return (await db.query(sql + ' ORDER BY tanggal DESC, waktu', params)).rows;
}

async function daftarDitolak({ dari, sampai, editorId }) {
  const params = [dari, sampai];
  let sql = `SELECT id, editor_id, jenis, waktu, alasan, akurasi, jarak, ip, user_agent FROM presensi_ditolak
             WHERE (waktu + INTERVAL '7 hours')::date BETWEEN $1 AND $2`;
  if (editorId) { params.push(editorId); sql += ` AND editor_id = $3`; }
  return (await db.query(sql + ' ORDER BY waktu DESC LIMIT 200', params)).rows;
}

module.exports = {
  getConfig, saveConfig, validasiConfig, periksa, absen, daftar, daftarDitolak,
  jarakMeter, parseIp, ipTerdaftar, ipSaran, todayWib, menitWib,
};
