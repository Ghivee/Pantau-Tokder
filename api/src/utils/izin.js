// Hak akses seperti YouTube Studio. Pemilik boleh semuanya. Karyawan menurut perannya:
//   manajer  : unggah, tayangkan, hapus, buat tautan
//   editor   : unggah, tayangkan, buat tautan
//   terbatas : unggah sebagai draf dan buat tautan (tidak menayangkan)
//   penonton : hanya melihat
// Penghasilan dipisah dari peran: pemilik, atau karyawan yang diberi tanda "lihat penghasilan" oleh pemilik.
const IZIN = {
  manajer: ['upload', 'tayang', 'hapus', 'tautan'],
  editor: ['upload', 'tayang', 'tautan'],
  terbatas: ['upload', 'tautan'],
  penonton: [],
};
const PERAN = Object.keys(IZIN);

const peranValid = (p) => (PERAN.includes(p) ? p : 'editor');

const bisa = (req, aksi) => !!req.isAdmin || (!!req.editor && (IZIN[req.editor.peran] || IZIN.editor).includes(aksi));

const bisaLihatUang = (req) => !!req.isAdmin || !!(req.editor && req.editor.uang);

function requireIzin(aksi) {
  return (req, res, next) => {
    if (bisa(req, aksi)) return next();
    return res.status(req.editor ? 403 : 401).json({ error: req.editor ? 'Peran Anda tidak punya izin untuk ini' : 'Silakan masuk terlebih dahulu' });
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

module.exports = { IZIN, PERAN, peranValid, bisa, bisaLihatUang, requireIzin, hapusUang };
