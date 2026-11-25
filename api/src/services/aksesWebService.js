// Web mana yang boleh dibuka tiap karyawan dari halaman Aplikasi. Disimpan di tabel settings (kunci 'akses_web'),
// bentuknya { "<id karyawan>": ["master", "telprom"] }. Karyawan yang belum pernah diatur boleh membuka semuanya.
// Ini mengatur apa yang TAMPIL di Pantau. Penegakan sungguhan di tiap web tetap lewat login dan aturan web itu sendiri
// (Master: tabel akses dan RLS di Supabase).
const db = require('../config/db');

const WEB = ['master', 'telprom']; // Pantau selalu terbuka untuk yang sudah masuk
const KUNCI = 'akses_web';

async function bacaPeta() {
  try {
    const r = await db.query('SELECT value FROM settings WHERE key = $1', [KUNCI]);
    const v = r.rows[0] && JSON.parse(r.rows[0].value);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (e) { return {}; }
}

// Murni: web yang diizinkan untuk satu karyawan (array id web).
function izinDari(peta, editorId) {
  const x = peta[String(editorId)];
  return Array.isArray(x) ? WEB.filter((w) => x.includes(w)) : [...WEB];
}

// Murni: hasil peta setelah satu perubahan. Mulai dari bawaan (semua) bila karyawan belum pernah diatur.
function terapkan(peta, editorId, web, nilai) {
  if (!WEB.includes(web)) throw Object.assign(new Error('Web tidak dikenal'), { status: 400 });
  const kini = new Set(izinDari(peta, editorId));
  if (nilai) kini.add(web); else kini.delete(web);
  return { ...peta, [String(editorId)]: WEB.filter((w) => kini.has(w)) };
}

async function izinKaryawan(editorId) { return izinDari(await bacaPeta(), editorId); }

async function atur(editorId, web, nilai) {
  const baru = terapkan(await bacaPeta(), editorId, web, nilai === true);
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [KUNCI, JSON.stringify(baru)]);
  return izinDari(baru, editorId);
}

module.exports = { WEB, bacaPeta, izinDari, terapkan, izinKaryawan, atur };
