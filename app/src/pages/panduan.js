import { kalender } from '../core/calendar.js';
import { AFTER, PAGES } from '../core/registry.js';
import { ROUTES, pathOf } from '../core/router.js';
import { TOL } from '../core/rules.js';
import { S, isAdmin, me } from '../core/state.js';
import { $, $$, esc } from '../lib/dom.js';
import { tglPendek, today } from '../lib/format.js';
import { hariPresensi, liburBerikutnya, ringkasJadwal } from './presensi.js';
import { persiapanItems } from './shared.js';
import { icon } from '../ui/icons.js';

// Short and task-based: first steps, routines, what each menu is for, and short answers.
// "Cara kerja" buttons on other pages open the matching answer (/panduan#p-gaji).
const MENU_INFO = {
  'hari-ini': 'Halaman utama karyawan: absen, jadwal video, tugas, izin dan gaji hari ini.',
  rekap: 'Views, CTR, retensi, real-time dan klik afiliasi tiga channel dalam satu tabel dan satu diagram pembanding. CTR dan klik afiliasi diisi lewat Impor CSV.',
  saran: 'Ide video affiliate masalah-solusi-produk sesuai cuaca terkini.',
  sosmed: 'Upload satu video ke YouTube, TikTok, Instagram dan Facebook sekaligus (sebagai draf), plus hubungkan akun.',
  ringkasan: 'Gambaran tim: video tayang, views, tepat jadwal, siapa paling bagus.',
  harian: 'Kerja per hari: video, jam tayang, tugas lain, skor. Karyawan hanya melihat miliknya sendiri.',
  performa: 'Video mana yang berhasil dibanding video lain di channel, plus saran perbaikan.',
  tren: 'Apa yang sedang naik di channel: video, topik, kata di judul.',
  konten: 'Semua video channel: cari, saring, lihat retensi, unduh CSV.',
  analytics: 'Angka resmi YouTube per channel: views, jam tonton, subscriber.',
  presensi: 'Absen masuk dan pulang dari Wi-Fi kantor. Pemilik mengatur jam kerja dan libur di sini.',
  pengajuan: 'Ajukan izin, sakit, cuti atau ganti uang (klaim).',
  gaji: 'Slip gaji yang dihitung otomatis dari presensi dan video.',
  identifikasi: 'Video tanpa kode karyawan, untuk ditetapkan pembuatnya.',
  karyawan: 'Data karyawan: kode, jadwal, target, PIN.',
  monetisasi: 'Pendapatan iklan YouTube (rupiah) dan omzet afiliasi.',
  pengaturan: 'Sambungan YouTube, sinkronisasi, notifikasi, password.',
};

const FAQ = [
  { id: 'harian', q: 'Bagaimana skor harian dihitung?', a: `<p>Skor 0–100 dari empat hal:</p><ul><li><b>Jumlah video</b> dibanding target: 35 poin</li><li><b>Tepat jadwal</b> (telat lebih dari ${TOL} menit = telat): 25 poin</li><li><b>Views</b> dibanding video lain di channel: 20 poin</li><li><b>Tugas lain</b> yang dicatat: 20 poin</li></ul><p>Nilai A ≥ 85, B ≥ 70, C ≥ 55, sisanya D.</p>` },
  { id: 'performa', q: 'Apa arti angka 1,3× atau 0,8×?', a: '<p>Views video dibanding video biasa di channel yang sama (Shorts dibanding Shorts). <b>1×</b> = biasa, <b>1,3×</b> = 30% lebih ramai, <b>0,8×</b> = 20% lebih sepi.</p><p>Video yang belum 2 hari belum dinilai karena views-nya masih naik.</p>' },
  { id: 'tren', q: 'Dari mana “Sedang naik sekarang” dihitung?', a: '<p>Dari selisih views antara dua kali sinkronisasi (data diambil tiap jam), lalu disetarakan per 24 jam. Topik dan kata judul dibandingkan dengan video lain di periode yang sama.</p>' },
  { id: 'jam-kerja', q: 'Jam kerja dan hari libur', get a() { return `<ul>${ringkasJadwal(kalender().jadwal).split(' · ').map((x) => `<li>${esc(x)}</li>`).join('')}<li><b>Tanggal merah</b> libur${kalender().cuti_bersama ? ', termasuk cuti bersama' : ''}</li></ul><p>Telat dihitung dari jam masuk hari itu. Di hari libur tidak ada target video dan tidak dihitung tidak hadir; bila tetap masuk, jam kerjanya dihitung lembur. Pemilik bisa mengubah jam kerja, ikut cuti bersama, atau menambah libur kantor di Presensi → Aturan presensi.</p>${liburBerikutnya().length ? `<p>Libur berikutnya: ${liburBerikutnya().map(([d, n]) => `${tglPendek(d)} (${esc(n)})`).join(', ')}.</p>` : ''}`; } },
  { id: 'privasi', q: 'Siapa yang bisa melihat data saya?', a: '<p>Karyawan hanya melihat <b>datanya sendiri</b> (absen, aktivitas, skor, gaji, izin) dan angka <b>channel secara umum</b>. Data karyawan lain tidak ditampilkan; video buatan rekan tertulis “Tim”. Pemilik melihat semuanya.</p>' },
  { id: 'presensi', q: 'Kenapa absen saya ditolak?', a: '<p>Absen hanya diterima bila <b>tersambung ke Wi-Fi kantor</b>, <b>GPS menyala dan akurat</b>, dan <b>berada di area kantor</b>. Alasannya tertulis di tabel “Percobaan yang ditolak”.</p><p>Coba: matikan data seluler dan VPN, sambung ke Wi-Fi kantor, nyalakan GPS, tunggu beberapa detik, lalu absen lagi.</p>' },
  { id: 'video', q: 'Video saya tidak muncul atau tidak terhitung', a: '<p>Pastikan <b>kode Anda</b> (misal #AL) ada di deskripsi video. Video baru muncul paling lama 1 jam setelah tayang. Video tanpa kode bisa ditetapkan pembuatnya di menu Belum dikenali.</p>' },
  { id: 'retensi', q: 'Kenapa retensi video kosong?', a: '<p>YouTube baru memberi data retensi 2–3 hari setelah video tayang, dan tidak memberikannya untuk video yang penontonnya sangat sedikit. Channel juga harus tersambung ke YouTube Analytics.</p>' },
  { id: 'pengajuan', q: 'Apa pengaruh izin, cuti dan klaim ke gaji?', a: '<ul><li><b>Sakit</b> dan <b>cuti</b> yang disetujui tidak dipotong.</li><li><b>Izin</b> dipotong hanya bila pemilik mengaturnya.</li><li><b>Klaim</b> yang disetujui ditambahkan ke gaji bulan itu.</li><li>Tidak absen tanpa izin = tidak hadir.</li></ul>' },
  { id: 'gaji', q: 'Bagaimana gaji dihitung?', a: '<p><b>Ditambah:</b> gaji pokok, tunjangan, lembur (pulang ≥ 30 menit setelah jam pulang hari itu, atau seluruh jam kerja di hari libur), bonus video di atas target, bonus views, klaim, bonus dari pemilik.</p><p><b>Dikurangi:</b> hari tidak hadir, izin (bila diatur), telat, potongan tetap seperti BPJS.</p><p>Nominal tiap komponen diatur pemilik di Gaji → Atur gaji.</p>' },
  { id: 'status-gaji', q: 'Apa beda Perkiraan, Final dan Dibayar?', a: '<ul><li><b>Perkiraan</b>: bulan masih berjalan, angka masih bisa berubah.</li><li><b>Final</b>: dikunci pemilik, angka tidak berubah lagi.</li><li><b>Dibayar</b>: pemilik sudah mentransfer.</li></ul>' },
  { id: 'notifikasi', q: 'Cara menyalakan notifikasi di HP', a: '<p><b>Android / laptop:</b> buka menu Pengaturan (pemilik) atau Izin & klaim (karyawan), lalu tekan <b>Aktifkan notifikasi</b>.</p><p><b>iPhone:</b> buka di Safari → <b>Bagikan</b> → <b>Tambah ke Layar Utama</b>. Buka Pantau Tokder dari ikon itu, lalu tekan Aktifkan notifikasi.</p>' },
  { id: 'pendapatan', q: 'Apakah angka pendapatan asli?', a: '<p>Ya. Pendapatan iklan diambil dari YouTube Analytics dalam <b>rupiah</b> (YouTube mengonversinya dengan kurs harian), sama dengan di YouTube Studio bila mata uangnya rupiah. Pembayaran AdSense bisa sedikit beda karena kurs saat transfer. Channel yang belum tersambung tampil “—”. Omzet afiliasi dari file CSV yang diimpor atau diisi manual.</p>', owner: true },
  { id: 'afiliasi', q: 'Cara memasukkan omzet afiliasi', a: '<p>Unduh laporan komisi (CSV) dari dashboard afiliasi, lalu di menu Pendapatan tekan <b>Impor CSV</b>, pilih file, cek total per bulan, dan Simpan.</p>', owner: true },
  { id: 'data', q: 'Dari mana semua angka berasal?', a: '<ul><li>Video, views, like: YouTube, diperbarui tiap jam.</li><li>Retensi, jam tonton, pendapatan: YouTube Analytics, terlambat 2–3 hari.</li><li>Absen, aktivitas, izin: dicatat di aplikasi ini.</li></ul><p>Tidak ada angka contoh. Data yang belum ada ditulis “—”.</p>' },
  { id: 'ip-kantor', q: 'Semua karyawan ditolak “bukan Wi-Fi kantor”', a: '<p>Biasanya IP internet kantor berganti setelah modem dinyalakan ulang. Bila dua karyawan yang GPS-nya di dalam kantor ditolak dari jaringan baru yang sama, pemilik mendapat notifikasi dan kartu <b>IP Wi-Fi kantor tampaknya berubah</b> di Presensi. Tekan <b>Ganti IP lama dengan ini</b>; karyawan diberi kabar untuk absen lagi.</p>', owner: true },
  { id: 'offline', q: 'Sinyal hilang, apakah data hilang?', a: '<p>Tidak. Aplikasi menampilkan data terakhir yang tersimpan di HP dengan keterangan jamnya, lalu memperbarui sendiri saat sinyal kembali. Absen tetap butuh koneksi karena diperiksa server.</p>' },
  { id: 'hapus', q: 'Salah hapus catatan', a: '<p>Setelah menghapus aktivitas atau membatalkan pengajuan, tekan <b>Batalkan</b> di pesan bawah layar dalam 5 detik.</p>' },
  { id: 'excel', q: 'Cara mengunduh rekap ke Excel', a: '<p>Tekan tombol <b>Excel</b> di Gaji (rekap gaji per bulan), Presensi (rekap 30 hari), atau Konten (daftar video). File bisa dibuka di Excel dan Google Sheets.</p>', owner: true },
  { id: 'pin', q: 'Lupa PIN', a: '<p>Minta pemilik mengganti PIN di menu Karyawan → Ubah.</p>' },
];

function langkahPanduan(lihat) {
  if (lihat === 'pemilik') {
    return persiapanItems().map((x) => ({ ok: x.ok, t: x.t, d: x.cara, btn: x.act ? `<button class="btn sm" data-act="${x.act}" data-id="${x.id || 'umum'}">${x.act === 'notif-aktif' ? 'Aktifkan' : x.ok ? 'Ubah' : 'Atur'}</button>` : `<a class="btn sm" href="${x.href}">${x.ok ? 'Lihat' : 'Buka'}</a>` }));
  }
  const kode = (me() || {}).kode_identifikasi;
  const P = S.presensi && S.presensi.rows ? hariPresensi(S.presensi.rows, (me() || {}).id, today()) : {};
  return [
    { ok: null, t: `Tulis kode ${kode ? '#' + esc(kode) : 'Anda'} di deskripsi setiap video`, d: 'Tanpa kode, video tidak terhitung untuk Anda.', btn: '' },
    { ok: me() ? !!P.masuk : null, t: 'Absen masuk dan pulang', d: 'Dari Wi-Fi kantor dengan GPS menyala, langsung di halaman Hari ini.', btn: '<a class="btn sm" href="/">Hari ini</a>' },
    { ok: null, t: 'Catat tugas selain upload', d: 'Riset harga, thumbnail, cek SEO, balas komentar.', btn: '<a class="btn sm" href="/">Hari ini</a>' },
    { ok: !!(S.notif && S.notif.aktif), t: 'Nyalakan notifikasi', d: 'Supaya tahu izin disetujui, gaji dibayar, dan diingatkan absen.', btn: S.notif && S.notif.aktif ? '' : '<button class="btn sm" data-act="notif-aktif">Aktifkan</button>' },
    { ok: null, t: 'Lihat Performa tiap minggu', d: 'Baca bagian “Yang bisa ditingkatkan”: videomu dibanding video lain di channel.', btn: '<a class="btn sm" href="/performa">Performa</a>' },
  ];
}

PAGES.panduan = function () {
  const owner = isAdmin();
  const lihat = owner ? S.panduanUntuk || 'pemilik' : 'karyawan';
  const untukPemilik = lihat === 'pemilik';
  const langkah = langkahPanduan(lihat);
  const selesai = langkah.filter((x) => x.ok).length, dinilai = langkah.filter((x) => x.ok != null).length;
  const rutin = untukPemilik
    ? [['Setiap hari', ['Lihat Ringkasan dan Harian', 'Setujui atau tolak Izin & klaim']], ['Setiap minggu', ['Baca ringkasan Senin pagi di notifikasi', 'Buka Tren channel dan Performa', 'Tetapkan video di Belum dikenali']], ['Akhir bulan', ['Gaji → cek Rincian → Finalkan', 'Transfer, lalu Tandai dibayar', 'Unduh Excel untuk arsip', 'Impor omzet afiliasi']]]
    : [['Setiap hari kerja', ['Buka Hari ini, absen masuk', 'Upload sesuai jadwal, pakai kode', 'Centang tugas lain dengan Catat', 'Absen pulang. Jam kerja: ' + ringkasJadwal(kalender().jadwal)]], ['Setiap minggu', ['Buka Performa saya', 'Lihat Tren channel untuk ide']], ['Akhir bulan', ['Cek slip di Gaji', 'Ajukan klaim sebelum gaji final']]];
  const menu = ROUTES.filter((r) => r.id !== 'panduan' && MENU_INFO[r.id] && (!r.admin || untukPemilik) && (!r.karyawan || !untukPemilik));
  const faq = FAQ.filter((f) => !f.owner || untukPemilik);
  return `
      <header class="head"><div><h1>Panduan</h1><p>Semua yang perlu diketahui untuk memakai Pantau Tokder, singkat.</p></div>
        <div class="tools">${owner ? `<div class="seg" role="group" aria-label="Panduan untuk"><button data-act="panduan-untuk" data-v="pemilik" aria-pressed="${untukPemilik}">Untuk pemilik</button><button data-act="panduan-untuk" data-v="karyawan" aria-pressed="${!untukPemilik}">Untuk karyawan</button></div>` : ''}</div></header>
      <label class="search guide-search">${icon('search')}<input class="input" type="search" id="pd-cari" placeholder="Cari: gaji, absen ditolak, PIN, notifikasi…" aria-label="Cari di panduan"></label>
      <p class="muted m-0" id="pd-kosong" hidden>Tidak ada yang cocok. Coba kata lain, misalnya “gaji” atau “absen”.</p>
      <section class="card guide-sec" data-cari="mulai langkah awal persiapan ${esc(langkah.map((x) => x.t).join(' '))}">
        <div class="card-h"><h2>${untukPemilik ? 'Mulai di sini' : 'Yang perlu Anda lakukan'}</h2>${dinilai && owner && untukPemilik ? `<span class="pill ${selesai === dinilai ? 'ok' : 'warn'}">${selesai} dari ${dinilai} selesai</span>` : ''}</div>
        <ol class="steps">${langkah.map((x, i) => `<li class="${x.ok ? 'done' : ''}"><span class="no" aria-hidden="true">${x.ok ? '✓' : i + 1}</span><div class="tx"><b>${x.t}</b><span>${x.d}</span></div>${x.btn}</li>`).join('')}</ol>
      </section>
      <section class="guide-sec" data-cari="rutinitas setiap hari minggu akhir bulan ${esc(rutin.flat(2).join(' '))}">
        <h2 class="guide-h">Rutinitas</h2>
        <div class="routine">${rutin.map(([w, l]) => `<div class="card"><h3>${w}</h3><ul>${l.map((t) => `<li>${t}</li>`).join('')}</ul></div>`).join('')}</div>
      </section>
      <section class="guide-sec" data-cari="menu">
        <h2 class="guide-h">Isi tiap menu</h2>
        <div class="menu-grid">${menu.map((r) => `<a class="card menu-card" href="${pathOf(r.id)}" data-cari="${esc(r.label + ' ' + MENU_INFO[r.id])}">${icon(r.icon)}<div><b>${r.label}</b><span>${MENU_INFO[r.id]}</span></div></a>`).join('')}</div>
      </section>
      <section class="guide-sec" data-cari="pertanyaan">
        <h2 class="guide-h">Pertanyaan umum</h2>
        <div class="card faq-list">${faq.map((f) => `<details id="p-${f.id}" data-cari="${esc(f.q + ' ' + f.a.replace(/<[^>]+>/g, ' '))}"><summary>${f.q}</summary><div class="ans">${f.a}</div></details>`).join('')}</div>
      </section>`;
};

AFTER.panduan = () => {
  // Opened from a "Cara kerja" button: unfold that answer and point to it.
  const id = location.hash.slice(1);
  const el = id && document.getElementById(id);
  if (el && el.tagName === 'DETAILS') {
    el.open = true;
    el.classList.add('flash');
    requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
    setTimeout(() => el.classList.remove('flash'), 2000);
  }
  const inp = $('#pd-cari');
  if (!inp) return;
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    let ada = 0;
    $$('.guide-sec').forEach((sec) => {
      const items = $$('[data-cari]', sec).filter((x) => x !== sec);
      if (!items.length) { const hit = !q || sec.dataset.cari.toLowerCase().includes(q); sec.hidden = !hit; ada += hit; return; }
      let n = 0;
      items.forEach((x) => { const hit = !q || x.dataset.cari.toLowerCase().includes(q); x.hidden = !hit; if (hit) n++; if (x.tagName === 'DETAILS') x.open = !!q && hit; });
      sec.hidden = !n; ada += n;
    });
    $('#pd-kosong').hidden = !!ada;
  });
};
