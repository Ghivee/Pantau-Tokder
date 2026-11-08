export const TOL = 15; // menit setelah jadwal yang masih dihitung tepat

// Target harian tugas lain. `video` = target video hari itu; `frac` = bagian hari yang sudah lewat.
export const TUGAS = [
  { nama: 'Riset harga cabai', short: 'Riset harga', target: (video, frac) => (frac > 0 ? 1 : 0) },
  { nama: 'Buat thumbnail', short: 'Thumbnail', target: (video) => video },
  { nama: 'Cek SEO & tag', short: 'Cek SEO', target: (video) => video },
  { nama: 'Balas komentar', short: 'Komentar', target: (video, frac) => Math.round(30 * frac) },
];

export const TUGAS_LAIN = ['Edit video', 'Lainnya'];

const TOPIK = [
  ['Harga cabai', /harga|pasar|naik|turun|update|prediksi/i],
  ['Pestisida & semprot', /pestisida|insektisida|fungisida|semprot|oplos/i],
  ['Hama & penyakit', /hama|penyakit|thrips|kutu|layu|patek|antraknosa|keriting|virus|ulat|lalat|busuk|fusarium/i],
  ['Pupuk & nutrisi', /pupuk|npk|kocor|kalsium|boron|nutrisi|kompos|organik/i],
  ['Semai & bibit', /semai|bibit|benih|pindah tanam|persemaian/i],
  ['Panen & hasil', /panen|hasil|untung|omzet/i],
  ['Lahan & perawatan', /lahan|mulsa|bedeng|ajir|siram|perawatan|pangkas|wiwil/i],
];

export const topikOf = (t) => (TOPIK.find(([, re]) => re.test(t)) || ['Lainnya'])[0];

export const targetOf = (e) => +e.target_harian || 3;

export const slotsOf = (e) => String(e.jadwal || '').split(',').map((s) => s.trim()).filter((s) => /^\d{2}:\d{2}$/.test(s)).sort();

export const gradeOf = (s) => (s == null ? null : s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : 'D');

export const PALETTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
