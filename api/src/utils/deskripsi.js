// Menyusun deskripsi video siap pakai: judul, daftar produk dengan tautan pelacak, pernyataan afiliasi, dan tagar.
// Kode karyawan tidak ditulis di sini: server menambahkannya sendiri saat video diunggah (routes/posting.js).

const KALIMAT_AFILIASI = 'Tautan di atas adalah tautan afiliasi: kami bisa mendapat komisi bila Anda membeli lewat tautan itu, tanpa biaya tambahan untuk Anda.';
const TAGAR_DASAR = ['cabairawit', 'petanicabai'];
const ABAIKAN = new Set(['untuk', 'cabe', 'cabai', 'rawit', 'dengan', 'yang', 'paling', 'terbaik', 'murah']);

// Kata pertama yang bermakna dari nama produk jadi tagar, mis. "fungisida cabai antraknosa" → #fungisida.
function tagarProduk(label) {
  const k = String(label).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).find((w) => w.length >= 4 && !ABAIKAN.has(w));
  return k || null;
}

// tautan: [{label, url}]
function susunDeskripsi({ judul, tautan = [] }) {
  const baris = [String(judul || '').trim()];
  const daftar = tautan.slice(0, 10);
  if (daftar.length) {
    baris.push('', 'Produk di video ini:');
    for (const t of daftar) baris.push(`• ${t.label}: ${t.url}`);
    baris.push('', KALIMAT_AFILIASI);
  }
  const tagar = [...new Set([...TAGAR_DASAR, ...daftar.map((t) => tagarProduk(t.label)).filter(Boolean).slice(0, 2)])];
  baris.push('', tagar.map((t) => '#' + t).join(' '));
  return baris.join('\n').trim().slice(0, 4000);
}

module.exports = { susunDeskripsi, tagarProduk, KALIMAT_AFILIASI };
