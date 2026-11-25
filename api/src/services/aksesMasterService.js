// Menyelaraskan izin di dalam Master (tabel akses di Supabase) dengan pilihan pemilik di Pantau.
// Pantau memanggil dua fungsi database khusus (supabase/pantau-atur.sql) lewat akun pantau:
//   baca_akses()            membaca izin yang sekarang berlaku
//   set_akses(staff, izin)  menetapkan daftar izin satu orang (yang tidak ada di daftar dicabut)
// Penegakan sungguhan tetap di Master (RLS). Pantau hanya tempat pemilik memilih.
const master = require('./kontenMasterService');
const { MASTER } = require('../utils/izin');

const STAFF = ['via', 'deni']; // karyawan yang punya akun di Master
const norm = (s) => String(s || '').trim().toLowerCase();

// Akun Master milik satu karyawan Pantau: pilihan pemilik (editors.akun_master) lebih dulu, bila belum dipilih baru
// dicocokkan dari namanya (Via -> 'via'). Mengembalikan 'via' | 'deni' | null (tidak punya akun Master).
// row: { nama, akun_master }. Nama lain (mis. "Alivia" untuk akun 'via') dipilih pemilik di menu Akses.
function kunciStaff(row) {
  const pilih = norm(row && row.akun_master);
  if (STAFF.includes(pilih)) return pilih;
  const nama = norm(row && row.nama);
  return STAFF.includes(nama) ? nama : null;
}

// Murni: izin Pantau (kunci master_*) -> daftar nama izin di Master.
const keDaftarMaster = (izin) => Object.entries(MASTER).filter(([k]) => izin[k] === true).map(([, v]) => v);

// Murni: daftar izin Master -> kunci master_* di Pantau.
const dariDaftarMaster = (daftar) => Object.fromEntries(Object.entries(MASTER).map(([k, v]) => [k, daftar.includes(v)]));

// Izin yang sekarang berlaku di Master: { via: ['order_lihat', ...], deni: [...] }.
async function bacaAktual() {
  if (!master.siap()) throw new Error('Sambungan Master belum diatur');
  const r = await master.rest('POST', 'rpc/baca_akses', {}, null);
  if (r.status === 404) throw new Error('Fungsi baca_akses belum ada di Master (jalankan supabase/pantau-atur.sql)');
  if (r.status >= 300 || !Array.isArray(r.json)) throw new Error('Master menolak membaca akses (' + r.status + ')');
  const out = Object.fromEntries(STAFF.map((s) => [s, []]));
  for (const x of r.json) if (out[x.staff]) out[x.staff].push(x.izin);
  return out;
}

async function tulis(staff, daftar) {
  if (!master.siap()) throw new Error('Sambungan Master belum diatur');
  if (!STAFF.includes(staff)) throw new Error('Karyawan ini belum punya akun Master');
  const r = await master.rest('POST', 'rpc/set_akses', { p_staff: staff, p_izin: daftar }, null);
  if (r.status === 404) throw new Error('Fungsi set_akses belum ada di Master (jalankan supabase/pantau-atur.sql)');
  if (r.status >= 300) throw new Error('Master menolak perubahan akses' + (r.json && r.json.message ? ': ' + r.json.message : ' (' + r.status + ')'));
}

module.exports = { STAFF, kunciStaff, keDaftarMaster, dariDaftarMaster, bacaAktual, tulis };
