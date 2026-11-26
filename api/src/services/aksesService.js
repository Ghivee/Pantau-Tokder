// Pengaturan akses per orang (RBA berdasarkan nama). Sumber kebenarannya di Pantau (editors.izin);
// izin di dalam Master diselaraskan ke Master setiap kali berubah.
const db = require('../config/db');
const { KUNCI, KATALOG, resolve } = require('../utils/izin');
const am = require('./aksesMasterService');
const aksesWeb = require('./aksesWebService');
const { revokeEditorSessions } = require('../middlewares/sessionAuth');

const AMBIL = `SELECT id, nama, peran, lihat_penghasilan, izin, akun_master FROM editors WHERE status = 'aktif' ORDER BY nama`;

async function galatSebagai(fn) { try { return { ok: true, nilai: await fn() }; } catch (e) { return { ok: false, galat: e.message }; } }

// Daftar izin lengkap satu orang. Yang belum pernah diatur memakai keadaan nyata: web dari pengaturan lama,
// izin Master dari tabel akses di Master (bila terbaca), bukan tebakan.
function lengkapi(row, { petaWeb, aktual }) {
  const r = resolve(row);
  if (!r.tersimpan) {
    const web = aksesWeb.izinDari(petaWeb, row.id);
    r.izin.web_master = web.includes('master');
    r.izin.web_telprom = web.includes('telprom');
    const k = am.kunciStaff(row);
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
      const staff = am.kunciStaff(row);
      return { id: row.id, nama: row.nama, izin: r.izin, tersimpan: r.tersimpan, akunMaster: !!staff, akun: staff, akunPilihan: row.akun_master || null };
    }),
  };
}

// Perubahan satu izin selalu satu pernyataan SQL atomik, supaya dua perubahan bersamaan (dua admin, atau klik cepat)
// tidak saling menimpa. Pertama kali (belum pernah diatur) seluruh daftar ditulis, dan hanya bila masih kosong.
const MERGE = 'UPDATE editors SET izin = izin || jsonb_build_object($1::text, $2::boolean) WHERE id = $3 AND izin IS NOT NULL RETURNING izin';
const AWAL = 'UPDATE editors SET izin = $1 WHERE id = $2 AND izin IS NULL RETURNING izin';

// Penulisan ke Master diantre satu per satu (dalam proses ini) dan selalu memakai keadaan terbaru dari database.
let antrean = Promise.resolve();
const berurutan = (fn) => { const hasil = antrean.then(fn); antrean = hasil.catch(() => {}); return hasil; };

// Mengubah satu izin satu orang, lalu menyelaraskan bagian Master. Penyimpanan di Pantau tetap berhasil walau Master gagal;
// hasilnya dilaporkan.
async function ubah(editorId, kunci, nilai) {
  if (!KUNCI.includes(kunci)) throw Object.assign(new Error('Izin tidak dikenal'), { status: 400 });
  if (typeof nilai !== 'boolean') throw Object.assign(new Error('Nilai harus benar atau salah'), { status: 400 });
  const rows = (await db.query(AMBIL)).rows;
  const row = rows.find((r) => r.id === editorId);
  if (!row) throw Object.assign(new Error('Karyawan tidak ditemukan'), { status: 404 });
  const staff = am.kunciStaff(row);
  if (kunci.startsWith('master_') && !staff) throw Object.assign(new Error('Karyawan ini belum punya akun Office'), { status: 400 });
  const ctx = await konteks();
  const lama = resolve(row);
  // Orang ini belum pernah diatur dan izin Master-nya tidak terbaca: jangan menulis tebakan ke Master.
  if (staff && !lama.tersimpan && !ctx.aktual) {
    throw Object.assign(new Error('Izin di Office belum terbaca (' + ctx.galatMaster + '). Coba lagi sebentar lagi.'), { status: 503 });
  }
  const gabung = async () => {
    const m = await db.query(MERGE, [kunci, nilai, editorId]);
    return m.rows[0] ? resolve({ ...row, izin: m.rows[0].izin }).izin : null;
  };
  let izin = lama.tersimpan ? await gabung() : null;
  if (!izin) {
    const penuh = lengkapi(row, ctx);
    penuh.izin[kunci] = nilai;
    const w = await db.query(AWAL, [JSON.stringify(penuh.izin), editorId]);
    izin = w.rows[0] ? penuh.izin : await gabung(); // bila orang lain menyimpan lebih dulu, gabungkan ke datanya
  }
  if (!izin) throw Object.assign(new Error('Karyawan tidak ditemukan'), { status: 404 });
  // Akses ke Pantau dicabut: keluarkan dari semua perangkat sekarang juga.
  if (kunci === 'web_pantau' && nilai === false) await revokeEditorSessions(editorId);
  let sinkron = { ok: true };
  if (staff && (kunci.startsWith('master_') || !lama.tersimpan)) {
    const h = await berurutan(async () => {
      const terbaru = (await db.query(AMBIL)).rows.find((x) => x.id === editorId);
      return galatSebagai(() => am.tulis(staff, am.keDaftarMaster(terbaru ? resolve(terbaru).izin : izin)));
    });
    sinkron = h.ok ? { ok: true } : { ok: false, galat: h.galat };
  }
  return { izin, sinkron };
}

// Memetakan satu karyawan Pantau ke akun Master-nya ('via' | 'deni' | null). Satu akun Master hanya untuk satu orang.
async function pilihAkunMaster(editorId, akun) {
  const nilai = akun === '' || akun == null ? null : String(akun).toLowerCase();
  if (nilai !== null && !am.STAFF.includes(nilai)) throw Object.assign(new Error('Akun Office tidak dikenal'), { status: 400 });
  const rows = (await db.query(AMBIL)).rows;
  if (!rows.find((r) => r.id === editorId)) throw Object.assign(new Error('Karyawan tidak ditemukan'), { status: 404 });
  const dipakai = nilai && rows.find((r) => r.id !== editorId && am.kunciStaff(r) === nilai);
  if (dipakai) throw Object.assign(new Error(`Akun Office "${nilai}" sudah dipakai ${dipakai.nama}. Lepas dulu dari orang itu.`), { status: 409 });
  await db.query('UPDATE editors SET akun_master = $1 WHERE id = $2', [nilai, editorId]);
  // Orang ini sudah pernah diatur izinnya: kirim ke akun Master yang baru dipilih supaya keduanya sama.
  const row = rows.find((r) => r.id === editorId);
  let sinkron = { ok: true };
  if (nilai && resolve(row).tersimpan) {
    const h = await berurutan(() => galatSebagai(() => am.tulis(nilai, am.keDaftarMaster(resolve(row).izin))));
    sinkron = h.ok ? { ok: true } : { ok: false, galat: h.galat };
  }
  return { akun: nilai, sinkron };
}

// Mengirim ulang izin Master semua orang (bila sebelumnya Master tidak terjangkau).
async function sinkronSemua() {
  const rows = (await db.query(AMBIL)).rows;
  const hasil = [];
  for (const row of rows) {
    const staff = am.kunciStaff(row);
    if (!staff) continue;
    const r = resolve(row);
    if (!r.tersimpan) { hasil.push({ nama: row.nama, ok: true, dilewati: true }); continue; }
    const h = await berurutan(() => galatSebagai(() => am.tulis(staff, am.keDaftarMaster(r.izin))));
    hasil.push({ nama: row.nama, ok: h.ok, galat: h.galat });
  }
  return hasil;
}

module.exports = { daftar, ubah, sinkronSemua, lengkapi, pilihAkunMaster };
