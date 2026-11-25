// Jejak audit: mencatat setiap masuk, gagal masuk, keluar, halaman dibuka, aksi, dan pembacaan data sensitif,
// lengkap dengan IP, jaringan, perangkat, lokasi perkiraan, lalu menilai keanehannya (lihat utils/anomali.js).
// Kegagalan mencatat TIDAK boleh mengganggu pekerjaan utama: catat() tidak pernah melempar galat.
// Tidak pernah disimpan: kata sandi, PIN, token, isi permintaan, atau isi query.
const db = require('../config/db');
const { clientIp } = require('../utils/clientIp');
const { infoPermintaan, normalisasiRute, uraiUA } = require('../utils/perangkat');
const { nilai, tingkat, ATURAN } = require('../utils/anomali');

const JENIS = ['masuk', 'gagal', 'keluar', 'halaman', 'interaksi', 'sensitif', 'sistem', 'perubahan'];

// ---- IP kantor (dari konfigurasi presensi), disimpan sebentar di memori agar tidak membebani database
let cacheKantor = { at: 0, ips: [] };
async function ipKantor(ip) {
  try {
    const presensi = require('./presensiService');
    if (Date.now() - cacheKantor.at > 60000) {
      const cfg = await presensi.getConfig();
      cacheKantor = { at: Date.now(), ips: cfg.ips || [] };
    }
    return !!presensi.ipTerdaftar(ip, cacheKantor.ips);
  } catch (e) { return false; }
}
const resetCache = () => { cacheKantor = { at: 0, ips: [] }; limitHalaman.clear(); limitTamu.clear(); };

// ---- identitas pelaku
function penggunaDari(req, o = {}) {
  if (o.pengguna) return o.pengguna;
  if (req.isAdmin) return { tipe: 'admin', id: null, nama: req.namaAkun || 'Pemilik', akun: req.akun || null, kunci: 'a:' + (req.akun || 'pemilik'), metode: req.metodeMasuk || null, sesi: req.sesiId || null };
  if (req.editor) return { tipe: 'karyawan', id: req.editor.id, nama: req.editor.nama, akun: req.akun || null, kunci: 'k:' + req.editor.id, metode: req.metodeMasuk || null, sesi: req.sesiId || null };
  return { tipe: 'tamu', id: null, nama: o.nama || null, akun: null, kunci: 'x:' + String(o.tuju || 'anonim').toLowerCase().slice(0, 100), metode: null, sesi: req.sesiId || null };
}

// ---- ringkasan riwayat orang ini untuk penilaian
async function riwayatUntuk(p, info, e) {
  const r = {};
  const ringan = !['masuk', 'gagal', 'sensitif'].includes(e.jenis);
  if (!ringan && p.kunci) {
    const a = await db.query(
      `SELECT COUNT(*)::int AS masuk,
              COALESCE(array_agg(DISTINCT sidik) FILTER (WHERE sidik IS NOT NULL), '{}') AS sidik,
              COALESCE(array_agg(DISTINCT jaringan) FILTER (WHERE jaringan IS NOT NULL), '{}') AS jaringan,
              COALESCE(array_agg(DISTINCT negara) FILTER (WHERE negara IS NOT NULL), '{}') AS negara
       FROM jejak WHERE kunci = $1 AND jenis = 'masuk' AND hasil = 'ok' AND waktu > NOW() - INTERVAL '90 days'`, [p.kunci]);
    Object.assign(r, a.rows[0]);
    const t = await db.query(`SELECT waktu, negara, kota, lintang, bujur FROM jejak WHERE kunci = $1 AND jenis = 'masuk' AND hasil = 'ok' ORDER BY waktu DESC, id DESC LIMIT 1`, [p.kunci]);
    r.terakhir = t.rows[0] || null;
    const j = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE h >= 23 OR h < 5)::int AS malam
       FROM (SELECT EXTRACT(HOUR FROM waktu AT TIME ZONE 'Asia/Jakarta')::int AS h FROM jejak
             WHERE kunci = $1 AND jenis IN ('masuk', 'halaman', 'interaksi') AND waktu > NOW() - INTERVAL '60 days') x`, [p.kunci]);
    r.jam = j.rows[0];
  }
  if (e.jenis === 'gagal' || e.jenis === 'masuk') {
    const g = await db.query(
      `SELECT COUNT(*) FILTER (WHERE ip = $1)::int AS gagal_ip, COUNT(*) FILTER (WHERE kunci = $2)::int AS gagal_akun
       FROM jejak WHERE jenis = 'gagal' AND waktu > NOW() - INTERVAL '15 minutes'`, [info.ip, p.kunci]);
    r.gagalIp = g.rows[0].gagal_ip; r.gagalAkun = g.rows[0].gagal_akun;
    // Percobaan yang sedang dicatat ikut dihitung (belum tersimpan saat query ini berjalan).
    if (e.jenis === 'gagal') { r.gagalIp += 1; r.gagalAkun += 1; }
  }
  if (['masuk', 'interaksi', 'halaman', 'sensitif'].includes(e.jenis) && e.hasil === 'ok' && p.kunci) {
    const s = await db.query(`SELECT COUNT(DISTINCT kunci)::int AS n FROM jejak WHERE ip = $1 AND kunci <> $2 AND jenis IN ('masuk', 'interaksi', 'halaman') AND waktu > NOW() - INTERVAL '60 minutes' AND pengguna_tipe <> 'tamu'`, [info.ip, p.kunci]);
    r.akunSamaIp = s.rows[0].n;
  }
  if (e.status === 401 || e.status === 403) {
    const d = await db.query(`SELECT COUNT(*)::int AS n FROM jejak WHERE (kunci = $1 OR ip = $2) AND status IN (401, 403) AND waktu > NOW() - INTERVAL '5 minutes'`, [p.kunci, info.ip]);
    r.ditolak5m = d.rows[0].n;
  }
  if (['interaksi', 'sensitif'].includes(e.jenis) && p.kunci) {
    const m = await db.query(`SELECT COUNT(*)::int AS n FROM jejak WHERE kunci = $1 AND jenis IN ('interaksi', 'sensitif') AND waktu > NOW() - INTERVAL '1 minute'`, [p.kunci]);
    r.aksiPerMenit = m.rows[0].n;
  }
  return r;
}

// Mengirim notifikasi ke pemilik untuk kejadian berisiko tinggi, paling banyak sekali per orang per jam.
async function peringatkan(p, hasil, e) {
  try {
    const push = require('./pushService');
    const jam = new Date().toISOString().slice(0, 13);
    await push.sekali(`jejak:${p.kunci}:${jam}`, () => push.kirim({ admin: true }, {
      title: `Aktivitas mencurigakan: ${p.nama || 'tidak dikenal'}`,
      body: (hasil.tanda[0] && hasil.tanda[0].ket) || 'Ada kejadian berisiko tinggi.', url: '/jejak', tag: 'jejak',
    }));
  } catch (err) { /* notifikasi gagal tidak boleh mengganggu */ }
}

// Menyimpan satu kejadian yang keterangannya sudah lengkap. Dipakai oleh catat() (dari permintaan) dan oleh penyelaras Master.
// skor=false: tidak dinilai (mis. akun otomatis milik sistem sendiri).
async function simpan({ sumber = 'tokder', waktu = null, e, info, p, kantor, skor = true, abaikanGanda = false }) {
  const riwayat = skor ? await riwayatUntuk(p, info, e).catch((err) => { console.error('jejak riwayat:', err.message); return {}; }) : {};
  const h = skor ? nilai({ e: { jenis: e.jenis, hasil: e.hasil || 'ok', tipe: p.tipe, status: e.status }, info, kantor, riwayat, sekarang: waktu ? new Date(waktu) : new Date() }) : { tanda: [], risiko: 0 };
  const detail = { ...(e.detail || {}) };
  if (h.tanda.length) detail.alasan = h.tanda.map((t) => t.ket);
  const r = await db.query(
    `INSERT INTO jejak (waktu, sumber, jenis, aksi, hasil, kunci, pengguna_tipe, pengguna_id, pengguna_nama, akun, metode, sesi, ip, jaringan, kantor,
       negara, wilayah, kota, zona, lintang, bujur, ua, browser, os, perangkat, model, bahasa, sidik, metode_http, rute, status, durasi_ms, detail, risiko, tanda)
     VALUES (COALESCE($1, NOW()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
     ${abaikanGanda ? "ON CONFLICT ((detail->>'master_id')) WHERE sumber = 'master' DO NOTHING" : ''} RETURNING id`,
    [waktu, sumber, e.jenis, String(e.aksi).slice(0, 80), e.hasil || 'ok', p.kunci, p.tipe, p.id, p.nama, p.akun, e.metode || p.metode, p.sesi, info.ip, info.jaringan, kantor,
      info.negara, info.wilayah, info.kota, info.zona, info.lintang, info.bujur, info.ua, info.browser, info.os, info.perangkat, info.model, info.bahasa, info.sidik,
      e.metodeHttp || null, e.rute || null, e.status || null, e.durasi || null, Object.keys(detail).length ? JSON.stringify(detail) : null, h.risiko, h.tanda.map((t) => t.kode)]);
  if (!r.rows[0]) return { id: null, risiko: 0, tanda: [], ganda: true };
  if (h.risiko >= 60) await peringatkan(p, h, e);
  return { id: r.rows[0] && r.rows[0].id, risiko: h.risiko, tanda: h.tanda.map((t) => t.kode) };
}

// Titik masuk utama dari sebuah permintaan. e: { jenis, aksi, hasil, status, metodeHttp, rute, durasi, detail, pengguna, nama, tuju }
async function catat(req, e) {
  try {
    if (!JENIS.includes(e.jenis)) return null;
    if (e.jenis === 'gagal' || e.jenis === 'masuk' || e.jenis === 'keluar') req.jejakDicatat = true;
    const ip = clientIp(req);
    const info = infoPermintaan(req, ip);
    const p = penggunaDari(req, e);
    const kantor = await ipKantor(ip);
    return await simpan({ e, info, p, kantor });
  } catch (err) {
    console.error('jejak gagal dicatat:', err.message);
    return null;
  }
}

// ---- keputusan apa yang dicatat dari permintaan API biasa
const SENSITIF = ['/api/akses', '/api/jejak/ekspor', '/api/draf-pendapatan', '/api/afiliasi', '/api/gaji', '/api/analytics', '/api/editors', '/api/auth/google', '/api/auth/password', '/api/pengajuan', '/api/aktivitas/ekspor'];
const LEWATI = [/^\/api\/jejak\/halaman/, /^\/api\/csp-report/, /^\/api\/scan\/cron/, /^\/api\/rekap\/realtime/, /^\/api\/posting\/(yt|media)\//, /^\/api\/auth\/(me|karyawan|sso-info|logout|keluar-sso)\b/, /^\/api\/push\//];
// Rute login dicatat eksplisit oleh rutenya sendiri (berhasil, gagal, terkunci). Yang tersisa: diblokir pembatas laju (429) sebelum sampai ke rute.
const RUTE_LOGIN = /^\/api\/auth\/(login|editor-login|sso)$/;
const limitTamu = new Map();

function rencanakan(req, res) {
  const url = req.originalUrl || req.url || '';
  if (!url.startsWith('/api/')) return null;
  const rute = normalisasiRute(url);
  if (LEWATI.some((re) => re.test(rute)) || req.jejakDicatat) return null;
  const metode = req.method === 'HEAD' ? 'GET' : req.method;
  if (metode === 'OPTIONS') return null;
  const status = res.statusCode;
  if (RUTE_LOGIN.test(rute)) {
    if (status !== 429) return null;
    const k = 'login:' + clientIp(req); const t = limitTamu.get(k) || 0;
    if (Date.now() - t < 60000) return null; // satu catatan per menit per IP: banjir percobaan tidak membanjiri log
    limitTamu.set(k, Date.now());
    return { jenis: 'gagal', aksi: 'dibatasi_laju', hasil: 'gagal', metodeHttp: metode, rute, status, tuju: 'dibatasi', detail: { alasan_singkat: 'Terlalu banyak percobaan masuk dari satu IP; diblokir pembatas laju' } };
  }
  const masuk = !!(req.isAdmin || req.editor);
  const ditolak = status === 401 || status === 403 || status === 429;
  if (!masuk) {
    // Permintaan tanpa login yang ditolak dicatat paling banyak sekali per menit per IP (anti-banjir).
    if (!ditolak) return null;
    const k = clientIp(req); const t = limitTamu.get(k) || 0;
    if (Date.now() - t < 60000) return null;
    limitTamu.set(k, Date.now()); if (limitTamu.size > 5000) limitTamu.clear();
    return { jenis: 'interaksi', aksi: `${metode} ${rute}`, hasil: 'gagal', metodeHttp: metode, rute, status, tuju: 'tanpa-login' };
  }
  const sensitif = SENSITIF.some((s) => rute === s || rute.startsWith(s + '/') || rute.startsWith(s + '?'));
  if (metode === 'GET' && !sensitif && !ditolak) return null;
  return { jenis: sensitif ? 'sensitif' : 'interaksi', aksi: `${metode} ${rute}`, hasil: status < 400 ? 'ok' : 'gagal', metodeHttp: metode, rute, status };
}

// Middleware: mencatat SEBELUM respons diselesaikan (di Vercel fungsi dibekukan setelah respons, jadi tulisan tertunda bisa hilang).
function middleware(req, res, next) {
  const t0 = Date.now();
  const asli = res.end;
  let selesai = false;
  res.end = function (...args) {
    if (selesai) return asli.apply(this, args);
    selesai = true;
    let rencana = null;
    try { rencana = rencanakan(req, res); } catch (e) { rencana = null; }
    if (!rencana) return asli.apply(this, args);
    const kirim = () => asli.apply(this, args);
    Promise.race([catat(req, { ...rencana, durasi: Date.now() - t0 }), new Promise((r) => setTimeout(r, 1500))]).then(kirim, kirim);
    return this;
  };
  next();
}

// ---- halaman dibuka (dikirim browser tiap pindah halaman)
const limitHalaman = new Map();
const RUTE_HALAMAN = /^\/[a-z0-9-]*(?:\/\d+)?$/;
async function catatHalaman(req, rute) {
  const r = String(rute || '').split('?')[0].split('#')[0];
  if (r.length > 40 || !RUTE_HALAMAN.test(r)) return { dicatat: false }; // terlalu panjang = bukan halaman kita; ditolak, bukan dipotong
  const p = penggunaDari(req);
  const k = p.kunci + '|' + r; const t = limitHalaman.get(k) || 0;
  if (Date.now() - t < 20000) return { dicatat: false };
  limitHalaman.set(k, Date.now()); if (limitHalaman.size > 5000) limitHalaman.clear();
  const h = await catat(req, { jenis: 'halaman', aksi: 'buka_halaman', rute: r, detail: { halaman: r } });
  return { dicatat: !!h };
}

// ---- pembacaan untuk halaman admin
const BATAS = 200;
const KOLOM = `id, waktu, sumber, jenis, aksi, hasil, pengguna_tipe, pengguna_id, pengguna_nama, akun, metode, sesi, ip, jaringan, kantor,
  negara, wilayah, kota, zona, lintang, bujur, ua, browser, os, perangkat, model, bahasa, sidik, metode_http, rute, status, durasi_ms, detail, risiko, tanda, ditinjau_oleh, ditinjau_pada`;

async function daftar(f = {}) {
  const { w, p } = saring(f);
  const batas = Math.min(BATAS, Math.max(1, parseInt(f.batas, 10) || 50));
  if (f.sebelum && /^\d+$/.test(String(f.sebelum))) { p.push(String(f.sebelum)); w.push(`id < $${p.length}`); }
  p.push(batas + 1);
  const r = await db.query(`SELECT ${KOLOM} FROM jejak ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT $${p.length}`, p);
  const ada = r.rows.length > batas;
  const baris = r.rows.slice(0, batas).map(bentuk);
  return { baris, berikutnya: ada ? String(baris[baris.length - 1].id) : null };
}

// Menyusun WHERE dari filter; setiap nilai lewat parameter ($n), tidak pernah disambung ke SQL.
function saring(f = {}) {
  const w = [], p = [];
  const add = (sql, v) => { p.push(v); w.push(sql.split('?').join('$' + p.length)); };
  if (f.nama) add('pengguna_nama = ?', String(f.nama).slice(0, 120));
  if (f.jenis && JENIS.includes(f.jenis)) add('jenis = ?', f.jenis);
  if (f.sumber && ['tokder', 'master'].includes(f.sumber)) add('sumber = ?', f.sumber);
  if (f.hasil && ['ok', 'gagal'].includes(f.hasil)) add('hasil = ?', f.hasil);
  if (f.risikoMin) add('risiko >= ?', Math.max(0, Math.min(100, parseInt(f.risikoMin, 10) || 0)));
  if (f.ip) add('ip = ?', String(f.ip).slice(0, 64));
  if (f.hari) add(`waktu > NOW() - (?::text || ' days')::interval`, String(Math.max(1, Math.min(365, parseInt(f.hari, 10) || 7))));
  if (f.dari && !Number.isNaN(Date.parse(f.dari))) add('waktu >= ?', new Date(f.dari));
  if (f.sampai && !Number.isNaN(Date.parse(f.sampai))) add('waktu <= ?', new Date(f.sampai));
  if (f.q) add(`(aksi ILIKE ? OR rute ILIKE ? OR kota ILIKE ? OR browser ILIKE ? OR ip ILIKE ?)`, '%' + String(f.q).replace(/[%_\\]/g, '\\$&').slice(0, 60) + '%');
  if (f.belumDitinjau) w.push('risiko >= 30 AND ditinjau_pada IS NULL');
  return { w, p };
}

function bentuk(r) {
  const d = r.detail || {};
  return { ...r, id: String(r.id), tingkat: tingkat(r.risiko), alasan: Array.isArray(d.alasan) ? d.alasan : [], judulTanda: (r.tanda || []).map((k) => (ATURAN[k] ? ATURAN[k].judul : k)) };
}

async function ringkasan() {
  const u = await db.query(
    `SELECT pengguna_nama AS nama, MAX(pengguna_tipe) AS tipe, MAX(akun) AS akun,
            MAX(waktu) FILTER (WHERE jenis = 'masuk' AND hasil = 'ok') AS masuk_terakhir,
            COUNT(*) FILTER (WHERE jenis = 'masuk' AND hasil = 'ok')::int AS masuk_30h,
            COUNT(*) FILTER (WHERE jenis = 'gagal')::int AS gagal_30h,
            COUNT(DISTINCT sidik) FILTER (WHERE sidik IS NOT NULL)::int AS perangkat,
            COUNT(DISTINCT ip)::int AS ip_unik,
            COUNT(*) FILTER (WHERE risiko >= 30 AND ditinjau_pada IS NULL)::int AS peringatan,
            COUNT(*) FILTER (WHERE jenis IN ('interaksi', 'sensitif'))::int AS aksi_30h,
            MAX(waktu) AS aktif_terakhir
     FROM jejak WHERE pengguna_nama IS NOT NULL AND pengguna_tipe IN ('admin', 'karyawan', 'akun') AND waktu > NOW() - INTERVAL '30 days'
     GROUP BY pengguna_nama ORDER BY MAX(waktu) DESC, pengguna_nama`);
  const t = await db.query(
    `SELECT DISTINCT ON (pengguna_nama) pengguna_nama AS nama, waktu, ip, kota, negara, browser, os, perangkat, model, kantor, sumber
     FROM jejak WHERE jenis = 'masuk' AND hasil = 'ok' AND pengguna_nama IS NOT NULL ORDER BY pengguna_nama, waktu DESC, id DESC`);
  const per = Object.fromEntries(t.rows.map((x) => [x.nama, x]));
  const kini = Date.now();
  const total = await db.query(`SELECT COUNT(*) FILTER (WHERE risiko >= 30 AND ditinjau_pada IS NULL)::int AS peringatan, COUNT(*) FILTER (WHERE risiko >= 60 AND ditinjau_pada IS NULL)::int AS tinggi, COUNT(*)::int AS total FROM jejak WHERE waktu > NOW() - INTERVAL '30 days'`);
  return {
    pengguna: u.rows.map((x) => ({ ...x, terakhirMasuk: per[x.nama] || null, aktifSekarang: x.aktif_terakhir && kini - new Date(x.aktif_terakhir).getTime() < 10 * 60000 })),
    peringatan: total.rows[0].peringatan, tinggi: total.rows[0].tinggi, total: total.rows[0].total,
  };
}

async function detailPengguna(nama) {
  const pf = await db.query(
    `SELECT sidik, MAX(browser) AS browser, MAX(os) AS os, MAX(model) AS model, MAX(perangkat) AS perangkat, COUNT(*)::int AS kali, MIN(waktu) AS pertama, MAX(waktu) AS terakhir
     FROM jejak WHERE pengguna_nama = $1 AND sidik IS NOT NULL AND jenis = 'masuk' AND hasil = 'ok' GROUP BY sidik ORDER BY MAX(waktu) DESC, MAX(id) DESC LIMIT 20`, [nama]);
  const jr = await db.query(
    `SELECT jaringan, MAX(ip) AS ip, MAX(kota) AS kota, MAX(negara) AS negara, BOOL_OR(kantor) AS kantor, COUNT(*)::int AS kali, MIN(waktu) AS pertama, MAX(waktu) AS terakhir
     FROM jejak WHERE pengguna_nama = $1 AND jenis = 'masuk' AND hasil = 'ok' GROUP BY jaringan ORDER BY MAX(waktu) DESC, MAX(id) DESC LIMIT 20`, [nama]);
  const jam = await db.query(
    `SELECT EXTRACT(HOUR FROM waktu AT TIME ZONE 'Asia/Jakarta')::int AS jam, COUNT(*)::int AS n FROM jejak
     WHERE pengguna_nama = $1 AND jenis IN ('masuk', 'halaman', 'interaksi') AND waktu > NOW() - INTERVAL '60 days' GROUP BY 1 ORDER BY 1`, [nama]);
  const hal = await db.query(
    `SELECT rute, COUNT(*)::int AS kali, MAX(waktu) AS terakhir FROM jejak WHERE pengguna_nama = $1 AND jenis = 'halaman' AND waktu > NOW() - INTERVAL '30 days' GROUP BY rute ORDER BY COUNT(*) DESC LIMIT 15`, [nama]);
  return { perangkat: pf.rows, jaringan: jr.rows, jam: jam.rows, halaman: hal.rows };
}

async function tinjau(id, oleh) {
  if (!/^\d+$/.test(String(id))) return false;
  const r = await db.query(`UPDATE jejak SET ditinjau_oleh = $2, ditinjau_pada = NOW() WHERE id = $1 AND risiko >= 30 AND ditinjau_pada IS NULL`, [id, String(oleh || 'Pemilik').slice(0, 120)]);
  return r.rowCount > 0;
}
async function tinjauSemua(oleh, nama) {
  const r = await db.query(`UPDATE jejak SET ditinjau_oleh = $1, ditinjau_pada = NOW() WHERE risiko >= 30 AND ditinjau_pada IS NULL AND ($2::text IS NULL OR pengguna_nama = $2)`, [String(oleh || 'Pemilik').slice(0, 120), nama || null]);
  return r.rowCount;
}

async function sesiAktif() {
  const r = await db.query(
    `SELECT left(s.token_hash, 12) AS id, s.tipe, s.nama, s.akun, s.metode, s.ip, s.ua, s.created_at, s.expires_at, e.nama AS nama_karyawan,
            (SELECT MAX(waktu) FROM jejak j WHERE j.sesi = left(s.token_hash, 12)) AS aktif_terakhir
     FROM sesi s LEFT JOIN editors e ON e.id = s.editor_id WHERE s.expires_at > NOW() ORDER BY s.created_at DESC LIMIT 100`);
  return r.rows.map((x) => { const u = uraiUA(x.ua); return { ...x, ua: undefined, nama: x.nama || x.nama_karyawan || (x.tipe === 'admin' ? 'Pemilik' : '?'), browser: u.browser + (u.versi ? ' ' + u.versi : ''), os: u.os, perangkat: u.perangkat, model: u.model }; });
}
async function cabutSesi(id) {
  if (!/^[0-9a-f]{12}$/i.test(String(id))) return 0;
  const r = await db.query(`DELETE FROM sesi WHERE left(token_hash, 12) = $1`, [String(id).toLowerCase()]);
  return r.rowCount;
}

// ---- ekspor CSV (sel yang berawalan = + - @ diberi tanda kutip agar tidak jadi rumus di spreadsheet)
const aman = (v) => { let s = v == null ? '' : v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(' ') : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
async function ekspor(f = {}) {
  const hasil = [];
  let sebelum = null;
  for (let i = 0; i < 25; i++) { // paling banyak 5.000 baris per ekspor
    const d = await daftar({ ...f, batas: BATAS, sebelum });
    hasil.push(...d.baris);
    if (!d.berikutnya) break;
    sebelum = d.berikutnya;
  }
  const kepala = ['Waktu (WIB)', 'Sumber', 'Jenis', 'Aksi', 'Hasil', 'Pengguna', 'Akun', 'Cara masuk', 'IP', 'Jaringan', 'Jaringan kantor', 'Negara', 'Kota', 'Browser', 'OS', 'Perangkat', 'Model', 'Rute', 'Status', 'Risiko', 'Tanda', 'Alasan'];
  const wib = (d) => new Date(new Date(d).getTime() + 7 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
  const baris = hasil.map((x) => [wib(x.waktu), x.sumber, x.jenis, x.aksi, x.hasil, x.pengguna_nama, x.akun, x.metode, x.ip, x.jaringan, x.kantor ? 'ya' : 'tidak', x.negara, x.kota, x.browser, x.os, x.perangkat, x.model, x.rute, x.status, x.risiko, (x.judulTanda || []).join('; '), (x.alasan || []).join(' | ')].map(aman).join(','));
  return '﻿' + [kepala.map(aman).join(','), ...baris].join('\r\n');
}

async function pangkas() {
  const a = await db.query(`DELETE FROM jejak WHERE ctid IN (SELECT ctid FROM jejak WHERE waktu < NOW() - INTERVAL '180 days' AND risiko < 30 LIMIT 5000)`);
  const b = await db.query(`DELETE FROM jejak WHERE ctid IN (SELECT ctid FROM jejak WHERE waktu < NOW() - INTERVAL '400 days' LIMIT 5000)`);
  return (a.rowCount || 0) + (b.rowCount || 0);
}

module.exports = { simpan, ipKantor, catat, catatHalaman, middleware, rencanakan, daftar, ringkasan, detailPengguna, tinjau, tinjauSemua, sesiAktif, cabutSesi, ekspor, pangkas, penggunaDari, resetCache, SENSITIF };
