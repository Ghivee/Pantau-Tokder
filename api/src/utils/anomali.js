// Deteksi keanehan berbasis aturan yang bisa dijelaskan (bukan kotak hitam). Murni: menerima keterangan kejadian dan
// ringkasan riwayat orang itu, mengembalikan tanda beserta alasannya. Skor 0-100: >=60 tinggi, >=30 sedang, >=10 rendah.
const { jarakKm } = require('./perangkat');

// Kode -> judul singkat dan bobot dasar, dipakai juga oleh tampilan.
const ATURAN = {
  perangkat_baru: { judul: 'Perangkat baru', bobot: 30 },
  jaringan_baru: { judul: 'Jaringan baru', bobot: 15 },
  negara_baru: { judul: 'Negara baru', bobot: 45 },
  lompatan_lokasi: { judul: 'Lompatan lokasi tidak masuk akal', bobot: 60 },
  jam_tak_lazim: { judul: 'Jam tidak biasa', bobot: 10 },
  gagal_berulang_ip: { judul: 'Banyak gagal masuk dari satu IP', bobot: 40 },
  gagal_berulang_akun: { judul: 'Banyak gagal masuk pada satu akun', bobot: 40 },
  berhasil_setelah_gagal: { judul: 'Berhasil masuk setelah banyak gagal', bobot: 35 },
  perangkat_otomatis: { judul: 'Alat otomatis/skrip', bobot: 30 },
  pemilik_luar_kantor: { judul: 'Pemilik masuk dari luar jaringan kantor', bobot: 15 },
  banyak_ditolak: { judul: 'Banyak permintaan ditolak', bobot: 30 },
  lonjakan_aksi: { judul: 'Lonjakan aksi dalam semenit', bobot: 25 },
  ip_dipakai_banyak_akun: { judul: 'Satu IP dipakai banyak akun', bobot: 20 },
  baca_sensitif_luar_kantor: { judul: 'Data sensitif dibuka dari luar kantor', bobot: 10 },
};

const AMBANG = { gagalIp: 5, gagalAkun: 5, setelahGagal: 3, ditolak: 10, aksiPerMenit: 60, akunSatuIp: 3, jarakLompat: 250, kecepatanLompat: 900, jamTerakhirLompat: 12, minimumJam: 15, bagianMalamMaks: 0.1 };

const jamWIB = (d) => (new Date(d.getTime() + 7 * 3600 * 1000)).getUTCHours();
const adalahMalam = (h) => h >= 23 || h < 5;

// e: { jenis, hasil, tipe, status, metodeHttp }   info: hasil infoPermintaan   kantor: boolean
// riwayat: { masuk, sidik[], jaringan[], negara[], terakhir:{waktu,negara,kota,lintang,bujur}|null, jam:{total,malam},
//            gagalIp, gagalAkun, akunSamaIp, ditolak5m, aksiPerMenit }
function nilai({ e, info, kantor, riwayat = {}, sekarang = new Date() }) {
  const tanda = [];
  const tambah = (kode, ket, bobot) => tanda.push({ kode, ket, bobot: bobot ?? ATURAN[kode].bobot });
  const bawaan = { masuk: 0, sidik: [], jaringan: [], negara: [], terakhir: null, jam: { total: 0, malam: 0 }, gagalIp: 0, gagalAkun: 0, akunSamaIp: 0, ditolak5m: 0, aksiPerMenit: 0 };
  const r = { ...bawaan, ...Object.fromEntries(Object.entries(riwayat || {}).filter(([, v]) => v !== undefined && v !== null)) }; // nilai kosong tidak menimpa bawaan
  if (riwayat && riwayat.terakhir) r.terakhir = riwayat.terakhir;
  const pernah = r.masuk >= 1;
  const login = e.jenis === 'masuk' && e.hasil === 'ok';

  if (info.otomatis) tambah('perangkat_otomatis', info.perangkat === 'kosong' ? 'Permintaan tanpa identitas perangkat (user agent kosong).' : `Permintaan berasal dari alat otomatis (${info.browser}), bukan browser biasa.`);

  if (login) {
    if (pernah && info.sidik && !r.sidik.includes(info.sidik)) tambah('perangkat_baru', `Perangkat belum pernah dipakai akun ini (${info.browser} di ${info.os}${info.model ? ', ' + info.model : ''}).`);
    if (pernah && !kantor && info.jaringan !== 'tidak diketahui' && !r.jaringan.includes(info.jaringan)) tambah('jaringan_baru', `Jaringan ${info.jaringan} belum pernah dipakai akun ini.`);
    if (pernah && info.negara && r.negara.length && !r.negara.includes(info.negara)) tambah('negara_baru', `Masuk dari negara ${info.negara}; biasanya dari ${r.negara.join(', ')}.`);
    const t = r.terakhir;
    if (t && info.lintang != null && t.lintang != null) {
      const km = jarakKm(t.lintang, t.bujur, info.lintang, info.bujur);
      const jam = (sekarang.getTime() - new Date(t.waktu).getTime()) / 3600000;
      if (km != null && km > AMBANG.jarakLompat && jam > 0 && jam < AMBANG.jamTerakhirLompat && km / jam > AMBANG.kecepatanLompat) {
        tambah('lompatan_lokasi', `Masuk dari ${info.kota || info.negara || 'lokasi lain'}, ${Math.round(km)} km dari login sebelumnya (${t.kota || t.negara || '?'}) hanya ${jam < 1 ? Math.max(1, Math.round(jam * 60)) + ' menit' : jam.toFixed(1) + ' jam'} sebelumnya.`);
      }
    }
    if (r.gagalAkun >= AMBANG.setelahGagal || r.gagalIp >= AMBANG.setelahGagal) tambah('berhasil_setelah_gagal', `Berhasil masuk setelah ${Math.max(r.gagalAkun, r.gagalIp)} kali gagal dalam 15 menit terakhir.`);
    if (e.tipe === 'admin' && !kantor && (pernah ? (info.sidik && !r.sidik.includes(info.sidik)) || !r.jaringan.includes(info.jaringan) : false)) tambah('pemilik_luar_kantor', 'Akun pemilik masuk dari luar jaringan kantor pada perangkat atau jaringan yang belum dikenal.');
  }

  if (e.jenis === 'gagal') {
    if (r.gagalIp >= AMBANG.gagalIp) tambah('gagal_berulang_ip', `${r.gagalIp} kali gagal masuk dari IP ${info.ip} dalam 15 menit.`);
    if (r.gagalAkun >= AMBANG.gagalAkun) tambah('gagal_berulang_akun', `${r.gagalAkun} kali gagal masuk pada akun yang sama dalam 15 menit.`);
  }

  if (['masuk', 'interaksi', 'halaman', 'sensitif'].includes(e.jenis) && e.hasil === 'ok' && r.akunSamaIp >= AMBANG.akunSatuIp && !kantor) tambah('ip_dipakai_banyak_akun', `IP ini dipakai ${r.akunSamaIp + 1} akun berbeda dalam satu jam, di luar jaringan kantor.`);

  if (e.status === 401 || e.status === 403) {
    if (r.ditolak5m >= AMBANG.ditolak) tambah('banyak_ditolak', `${r.ditolak5m} permintaan ditolak (tanpa izin) dalam 5 menit, mirip orang yang mencoba-coba.`);
  }
  if (['interaksi', 'sensitif'].includes(e.jenis) && r.aksiPerMenit >= AMBANG.aksiPerMenit) tambah('lonjakan_aksi', `${r.aksiPerMenit} aksi dalam satu menit; jauh di atas kebiasaan normal.`);

  if (e.jenis === 'sensitif' && !kantor && e.tipe !== 'admin') tambah('baca_sensitif_luar_kantor', 'Karyawan membuka data sensitif (penghasilan, gaji, atau akses) dari luar jaringan kantor.');

  if (login && r.jam.total >= AMBANG.minimumJam && adalahMalam(jamWIB(sekarang)) && r.jam.malam / r.jam.total < AMBANG.bagianMalamMaks) {
    tambah('jam_tak_lazim', `Masuk pukul ${String(jamWIB(sekarang)).padStart(2, '0')}.xx WIB; akun ini hampir tidak pernah aktif tengah malam.`);
  }

  const risiko = Math.min(100, tanda.reduce((a, t) => a + t.bobot, 0));
  return { tanda, risiko, tingkat: tingkat(risiko) };
}

const tingkat = (risiko) => (risiko >= 60 ? 'tinggi' : risiko >= 30 ? 'sedang' : risiko >= 10 ? 'rendah' : 'normal');

module.exports = { nilai, tingkat, ATURAN, AMBANG, jamWIB };
