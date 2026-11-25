// Hak akses per ORANG (bukan per jabatan). Pemilik boleh semuanya. Tiap karyawan punya daftar izin sendiri yang diatur
// pemilik satu per satu di Pengaturan > Akses karyawan. Disimpan di editors.izin (JSON: kunci -> true/false).
// Karyawan yang belum pernah diatur memakai nilai awal dari aturan lama (kolom peran dan lihat_penghasilan) supaya
// tidak ada yang kehilangan akses mendadak; begitu pemilik mengubah satu izin, seluruh daftarnya disimpan.
const KATALOG = [
  { grup: 'Tokder', butir: [
    { k: 'upload', nama: 'Mengunggah draf sosmed' },
    { k: 'tayang', nama: 'Menayangkan posting' },
    { k: 'hapus', nama: 'Menghapus posting dan tautan' },
    { k: 'tautan', nama: 'Membuat tautan affiliate' },
    { k: 'tetapkan', nama: 'Menetapkan pembuat video' },
    { k: 'uang', nama: 'Melihat penghasilan' },
  ] },
  { grup: 'Web yang boleh dibuka', butir: [
    { k: 'web_pantau', nama: 'Tokder' },
    { k: 'web_master', nama: 'Master' },
    { k: 'web_telprom', nama: 'Telprom' },
  ] },
  { grup: 'Di dalam Master', butir: [
    { k: 'master_order_lihat', nama: 'Melihat order' },
    { k: 'master_order_unggah', nama: 'Mengunggah dan mencatat order' },
    { k: 'master_konten_lihat', nama: 'Melihat konten' },
    { k: 'master_konten_kelola', nama: 'Mengelola konten' },
    { k: 'master_kas_catat', nama: 'Mencatat kas harian' },
  ] },
];
const KUNCI = KATALOG.flatMap((g) => g.butir.map((b) => b.k));

// Izin di Master dan nama izinnya di tabel akses Supabase.
const MASTER = {
  master_order_lihat: 'order_lihat',
  master_order_unggah: 'order_unggah',
  master_konten_lihat: 'konten_lihat',
  master_konten_kelola: 'konten_kelola',
  master_kas_catat: 'kas_catat',
};

// Aturan lama (jabatan) yang hanya dipakai sebagai nilai awal.
const LAMA = {
  manajer: ['upload', 'tayang', 'hapus', 'tautan'],
  editor: ['upload', 'tayang', 'tautan'],
  terbatas: ['upload', 'tautan'],
  penonton: [],
};
const PERAN = Object.keys(LAMA);
const peranValid = (p) => (PERAN.includes(p) ? p : 'editor');

// Nilai awal untuk karyawan yang belum pernah diatur.
function awal(peran, lihatUang) {
  const lama = LAMA[peran] || LAMA.editor;
  const o = {};
  for (const k of KUNCI) o[k] = false;
  for (const k of lama) o[k] = true;
  o.tetapkan = (peran || 'editor') === 'editor';
  o.uang = lihatUang === true;
  o.web_pantau = true;
  o.web_master = true;
  o.web_telprom = true;
  for (const k of Object.keys(MASTER)) o[k] = k !== 'master_kas_catat';
  return o;
}

// Daftar izin lengkap satu karyawan. row: { peran, lihat_penghasilan, izin }. tersimpan = pemilik sudah pernah mengaturnya.
function resolve(row) {
  const o = awal(row && row.peran, row && row.lihat_penghasilan);
  const s = row && row.izin && typeof row.izin === 'object' && !Array.isArray(row.izin) ? row.izin : null;
  if (s) for (const k of KUNCI) if (typeof s[k] === 'boolean') o[k] = s[k];
  return { izin: o, tersimpan: !!s };
}

const bisa = (req, aksi) => !!req.isAdmin || (!!req.editor && !!req.editor.izin && req.editor.izin[aksi] === true);

const bisaLihatUang = (req) => !!req.isAdmin || !!(req.editor && req.editor.izin && req.editor.izin.uang === true);

function requireIzin(aksi) {
  return (req, res, next) => {
    if (bisa(req, aksi)) return next();
    return res.status(req.editor ? 403 : 401).json({ error: req.editor ? 'Anda tidak punya izin untuk ini' : 'Silakan masuk terlebih dahulu' });
  };
}

// Membuang semua kolom penghasilan dari data yang akan dikirim.
function hapusUang(data) {
  if (Array.isArray(data)) return data.map(hapusUang);
  if (data && typeof data === 'object' && !(data instanceof Date)) {
    const o = {};
    for (const [k, v] of Object.entries(data)) if (k !== 'revenue') o[k] = hapusUang(v);
    return o;
  }
  return data;
}

module.exports = { KATALOG, KUNCI, MASTER, PERAN, peranValid, awal, resolve, bisa, bisaLihatUang, requireIzin, hapusUang };
