// Menarik jejak dari database Master (login/logout Supabase dan perubahan data) ke jejak Tokder, supaya pemilik melihat
// semuanya di satu tempat. Master adalah sumber kebenarannya (dicatat oleh pemicu SQL di database, supabase/jejak.sql);
// di sini hanya disalin bertahap dan dinilai keanehannya. Akun otomatis milik Tokder sendiri diberi label "layanan" dan tidak dinilai.
const db = require('../config/db');
const master = require('./kontenMasterService');
const jejak = require('./jejakService');

const AKUN_LAYANAN = 'pantau@master.app';
const KUNCI = 'jejak_master_terakhir';
const JEDA_MS = 60000;
const PER_PANGGILAN = 500;

let terakhir = 0;
let berjalan = null;

async function titik() {
  const r = await db.query(`SELECT value FROM settings WHERE key = $1`, [KUNCI]);
  const n = parseInt(r.rows[0] && r.rows[0].value, 10);
  return Number.isFinite(n) ? n : 0;
}
const simpanTitik = (id) => db.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, [KUNCI, String(id)]);

const kosong = (ip) => ({ ip: ip || null, jaringan: null, ua: null, browser: null, os: null, perangkat: null, model: null, bahasa: null, sidik: null, negara: null, wilayah: null, kota: null, zona: null, lintang: null, bujur: null, otomatis: false });

// Satu baris dari Master menjadi satu kejadian jejak.
async function tulis(row) {
  const { infoPermintaan } = require('../utils/perangkat');
  const email = String(row.aktor_email || '').toLowerCase();
  const layanan = email === AKUN_LAYANAN;
  const masuk = row.jenis === 'masuk' || row.jenis === 'keluar';
  const info = masuk && row.ua ? { ...infoPermintaan({ headers: { 'user-agent': row.ua } }, row.ip || 'unknown'), ip: row.ip || null } : kosong(row.ip);
  if (layanan) info.perangkat = 'layanan';
  const p = {
    tipe: layanan ? 'layanan' : 'akun', id: null, nama: row.aktor_nama || (email ? email.split('@')[0] : 'sistem/SQL'),
    akun: email || null, kunci: 'm:' + (email || 'sistem'), metode: 'master', sesi: null,
  };
  const aksi = row.jenis === 'masuk' ? 'login_master' : row.jenis === 'keluar' ? 'logout_master' : `${row.aksi} ${row.tabel}`;
  const e = { jenis: row.jenis, aksi, hasil: 'ok', detail: { master_id: String(row.id), tabel: row.tabel || undefined, baris_id: row.baris_id || undefined, ringkas: row.ringkas || undefined, layanan: layanan || undefined } };
  const kantor = masuk && row.ip ? await jejak.ipKantor(row.ip) : false;
  return jejak.simpan({ sumber: 'master', waktu: row.waktu, e, info, p, kantor, skor: row.jenis === 'masuk' && !layanan, abaikanGanda: true });
}

async function tarik() {
  let setelah = await titik();
  let baru = 0;
  for (let putaran = 0; putaran < 6; putaran++) { // paling banyak 3.000 baris per sinkron
    const r = await master.rest('POST', 'rpc/jejak_master_baca', { p_setelah: setelah, p_batas: PER_PANGGILAN }, null);
    if (r.status === 404) throw new Error('Fungsi jejak_master_baca belum ada di Office (jalankan supabase/jejak.sql)');
    if (r.status >= 300 || !Array.isArray(r.json)) throw new Error('Office menolak membaca jejak (' + r.status + ')');
    if (!r.json.length) break;
    for (const row of r.json) {
      const h = await tulis(row);
      if (h && !h.ganda) baru++;
      setelah = Math.max(setelah, Number(row.id));
    }
    await simpanTitik(setelah);
    if (r.json.length < PER_PANGGILAN) break;
  }
  return baru;
}

// Aman dipanggil sering: paling cepat sekali per menit, dan tidak pernah berjalan dua kali bersamaan.
async function sinkron({ paksa = false } = {}) {
  if (!master.siap()) return { terhubung: false, baru: 0 };
  if (berjalan) return berjalan;
  if (!paksa && Date.now() - terakhir < JEDA_MS) return { terhubung: true, baru: 0, dilewati: true };
  terakhir = Date.now();
  berjalan = (async () => {
    try { return { terhubung: true, baru: await tarik() }; } catch (err) { terakhir = 0; return { terhubung: true, baru: 0, galat: err.message }; } finally { berjalan = null; }
  })();
  return berjalan;
}

// Sesi Supabase yang sedang aktif (semua web yang memakai Akun Tokder).
async function sesiMaster() {
  if (!master.siap()) return { terhubung: false, sesi: [] };
  const r = await master.rest('POST', 'rpc/jejak_sesi_aktif', {}, null);
  if (r.status === 404) return { terhubung: true, sesi: [], galat: 'Fungsi jejak_sesi_aktif belum ada di Office (jalankan supabase/jejak.sql)' };
  if (r.status >= 300 || !Array.isArray(r.json)) return { terhubung: true, sesi: [], galat: 'Office menolak membaca sesi (' + r.status + ')' };
  const { uraiUA } = require('../utils/perangkat');
  return { terhubung: true, sesi: r.json.map((x) => { const u = uraiUA(x.ua); return { ...x, ua: undefined, browser: u.browser + (u.versi ? ' ' + u.versi : ''), os: u.os, perangkat: u.perangkat, model: u.model, layanan: String(x.email || '').toLowerCase() === AKUN_LAYANAN }; }) };
}

async function pangkas() {
  if (!master.siap()) return 0;
  const r = await master.rest('POST', 'rpc/jejak_master_pangkas', { p_hari: 365 }, null);
  return r.status < 300 && typeof r.json === 'number' ? r.json : 0;
}

const reset = () => { terakhir = 0; berjalan = null; };
module.exports = { sinkron, sesiMaster, pangkas, tulis, reset, AKUN_LAYANAN };
