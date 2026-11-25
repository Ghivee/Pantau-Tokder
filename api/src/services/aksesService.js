// Pengaturan akses per orang (RBA berdasarkan nama). Sumber kebenarannya di Pantau (editors.izin);
// izin di dalam Master diselaraskan ke Master setiap kali berubah.
const db = require('../config/db');
const { KUNCI, KATALOG, resolve } = require('../utils/izin');
const am = require('./aksesMasterService');
const aksesWeb = require('./aksesWebService');

const AMBIL = `SELECT id, nama, peran, lihat_penghasilan, izin FROM editors WHERE status = 'aktif' ORDER BY nama`;

async function galatSebagai(fn) { try { return { ok: true, nilai: await fn() }; } catch (e) { return { ok: false, galat: e.message }; } }

// Daftar izin lengkap satu orang. Yang belum pernah diatur memakai keadaan nyata: web dari pengaturan lama,
// izin Master dari tabel akses di Master (bila terbaca), bukan tebakan.
function lengkapi(row, { petaWeb, aktual }) {
  const r = resolve(row);
  if (!r.tersimpan) {
    const web = aksesWeb.izinDari(petaWeb, row.id);
    r.izin.web_master = web.includes('master');
    r.izin.web_telprom = web.includes('telprom');
    const k = am.kunciStaff(row.nama);
    if (k && aktual) Object.assign(r.izin, am.dariDaftarMaster(aktual[k] || []));
  }
  return r;
}

async function konteks() {
  const [petaWeb, aktual] = await Promise.all([aksesWeb.bacaPeta(), galatSebagai(am.bacaAktual)]);
  return { petaWeb, aktual: aktual.ok ? aktual.nilai : null, galatMaster: aktual.ok ? null : aktual.galat };
}

async function daftar() {
  const [rows, ctx] = await Promise.all([db.query(AMBIL).then((r) => r.rows), konteks()]);
  return {
    katalog: KATALOG,
    master: { terbaca: !!ctx.aktual, galat: ctx.galatMaster },
    karyawan: rows.map((row) => {
      const r = lengkapi(row, ctx);
      const staff = am.kunciStaff(row.nama);
      return { id: row.id, nama: row.nama, izin: r.izin, tersimpan: r.tersimpan, akunMaster: !!staff };
    }),
  };
}

// Mengubah satu izin satu orang. Daftar lengkap orang itu disimpan (supaya keadaan awalnya ikut tercatat),
// lalu bagian Master diselaraskan. Penyimpanan di Pantau tetap berhasil walau Master gagal; hasilnya dilaporkan.
async function ubah(editorId, kunci, nilai) {
  if (!KUNCI.includes(kunci)) throw Object.assign(new Error('Izin tidak dikenal'), { status: 400 });
  if (typeof nilai !== 'boolean') throw Object.assign(new Error('Nilai harus benar atau salah'), { status: 400 });
  const rows = (await db.query(AMBIL)).rows;
  const row = rows.find((r) => r.id === editorId);
  if (!row) throw Object.assign(new Error('Karyawan tidak ditemukan'), { status: 404 });
  const staff = am.kunciStaff(row.nama);
  if (kunci.startsWith('master_') && !staff) throw Object.assign(new Error('Karyawan ini belum punya akun Master'), { status: 400 });
  const ctx = await konteks();
  // Orang ini belum pernah diatur dan izin Master-nya tidak terbaca: jangan menulis tebakan ke Master.
  if (staff && !resolve(row).tersimpan && !ctx.aktual) {
    throw Object.assign(new Error('Izin di Master belum terbaca (' + ctx.galatMaster + '). Coba lagi sebentar lagi.'), { status: 503 });
  }
  const r = lengkapi(row, ctx);
  r.izin[kunci] = nilai;
  await db.query('UPDATE editors SET izin = $1 WHERE id = $2', [JSON.stringify(r.izin), editorId]);
  let sinkron = { ok: true };
  if (staff && (kunci.startsWith('master_') || !r.tersimpan)) {
    const h = await galatSebagai(() => am.tulis(staff, am.keDaftarMaster(r.izin)));
    sinkron = h.ok ? { ok: true } : { ok: false, galat: h.galat };
  }
  return { izin: r.izin, sinkron };
}

// Mengirim ulang izin Master semua orang (bila sebelumnya Master tidak terjangkau).
async function sinkronSemua() {
  const rows = (await db.query(AMBIL)).rows;
  const hasil = [];
  for (const row of rows) {
    const staff = am.kunciStaff(row.nama);
    if (!staff) continue;
    const r = resolve(row);
    if (!r.tersimpan) { hasil.push({ nama: row.nama, ok: true, dilewati: true }); continue; }
    const h = await galatSebagai(() => am.tulis(staff, am.keDaftarMaster(r.izin)));
    hasil.push({ nama: row.nama, ok: h.ok, galat: h.galat });
  }
  return hasil;
}

module.exports = { daftar, ubah, sinkronSemua, lengkapi };
