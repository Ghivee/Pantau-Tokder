// Ciri khas judul sebuah channel, dihitung dari video yang pernah diunggahnya: apa yang sering dipakai pada sepertiga
// video terlaris dibanding semua video. Fungsi murni (tanpa database) supaya mudah diuji.

const STOP = new Set(('yang dan di ke dari untuk dengan ini itu atau pada akan bisa agar jadi lebih saat para serta oleh dalam juga ada apa kenapa kapan ' +
  'bagaimana begini begitu ya pun sudah masih tidak bukan cuma hanya sampai tanpa sama lagi paling banyak semua cara tips video hari harga cabe cabai rawit').split(' '));

const kata = (j) => String(j).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const FITUR = {
  tanya: { nama: 'Judul berupa pertanyaan', uji: (j) => /\?/.test(j) },
  angka: { nama: 'Memakai angka', uji: (j) => /\d/.test(j) },
  cara: { nama: 'Diawali "Cara"', uji: (j) => /^\s*cara\b/i.test(j) },
  kapital: { nama: 'Kata kapital untuk penekanan', uji: (j) => /\b[A-Z]{3,}\b/.test(j.replace(/\b(YT|NPK|ZPT|PH|UV|SMS)\b/g, '')) },
  seru: { nama: 'Tanda seru', uji: (j) => /!/.test(j) },
  emoji: { nama: 'Emoji', uji: (j) => /\p{Extended_Pictographic}/u.test(j) },
  pemisah: { nama: 'Pemisah | atau -', uji: (j) => /\s[|\-–—]\s/.test(j) },
};

// rows: [{judul, views, tipe_video, umur_hari}] → ringkasan gaya. cukup=false bila video terlalu sedikit untuk disimpulkan.
function analisisGaya(rows) {
  const ok = rows.filter((r) => r.judul && Number.isFinite(+r.views) && (r.umur_hari == null || r.umur_hari >= 3));
  const n = ok.length;
  const hasil = { n, cukup: n >= 8, median: median(ok.map((r) => +r.views)), panjang: median(ok.map((r) => r.judul.length)), ciri: [], preferensi: {}, ampuh: [], terlaris: [], short: null };
  if (!n) return hasil;
  const urut = [...ok].sort((a, b) => b.views - a.views);
  hasil.terlaris = urut.slice(0, 5).map((r) => ({ judul: r.judul, views: +r.views }));
  if (!hasil.cukup) return hasil;
  const atas = urut.slice(0, Math.max(3, Math.round(n / 3)));
  const share = (list, f) => list.filter((r) => f(r.judul)).length / list.length;
  for (const [id, f] of Object.entries(FITUR)) {
    const a = share(atas, f.uji), s = share(ok, f.uji);
    hasil.preferensi[id] = { atas: a, semua: s };
    // Ciri khas: sering di video terlaris (>= 30%) dan lebih sering daripada rata-rata channel.
    if (a >= 0.3 && a >= s * 1.15) hasil.ciri.push(f.nama);
  }
  hasil.panjang = Math.round(median(atas.map((r) => r.judul.length)));
  const shorts = atas.filter((r) => r.tipe_video === 'short').length / atas.length;
  hasil.short = Math.round(shorts * 100);
  // Kata yang menyertai views tinggi: minimal 3 video, median di atas median channel.
  const per = {};
  for (const r of ok) for (const w of new Set(kata(r.judul))) (per[w] ||= []).push(+r.views);
  hasil.ampuh = Object.entries(per).filter(([, v]) => v.length >= 3).map(([w, v]) => ({ kata: w, median: median(v), n: v.length }))
    .filter((x) => x.median > hasil.median).sort((a, b) => b.median - a.median).slice(0, 6);
  return hasil;
}

module.exports = { analisisGaya, kata, FITUR };
