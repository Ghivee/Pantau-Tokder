const axios = require('axios');
const db = require('../config/db');

// Saran konten affiliate masalah → solusi → produk, dari cuaca terkini di sentra cabai dan aturan musim.
// Cuaca dari Open-Meteo (gratis, tanpa kunci). Lokasi bisa diganti lewat settings 'saran_lokasi' ({nama, lat, lon}).
const LOKASI_BAWAAN = { nama: 'Garut, Jawa Barat', lat: -7.21, lon: 107.9 };
const TTL = 3 * 3600 * 1000;
let cache = null;

async function lokasi() {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key = 'saran_lokasi'`);
    const v = r.rows[0] && JSON.parse(r.rows[0].value);
    if (v && Number.isFinite(+v.lat) && Number.isFinite(+v.lon) && v.nama) return { nama: String(v.nama).slice(0, 60), lat: +v.lat, lon: +v.lon };
  } catch (e) { /* pakai bawaan */ }
  return LOKASI_BAWAAN;
}

async function ambilCuaca(l) {
  if (cache && cache.kunci === `${l.lat},${l.lon}` && Date.now() - cache.waktu < TTL) return cache.data;
  const r = await axios.get('https://api.open-meteo.com/v1/forecast', {
    timeout: 15000,
    params: { latitude: l.lat, longitude: l.lon, daily: 'precipitation_sum,temperature_2m_max,relative_humidity_2m_mean', past_days: 7, forecast_days: 7, timezone: 'Asia/Bangkok' },
  });
  cache = { kunci: `${l.lat},${l.lon}`, waktu: Date.now(), data: r.data.daily };
  return r.data.daily;
}

const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
const avg = (a) => (a.length ? sum(a) / a.length : 0);
const bulat = (v) => Math.round(v);

// 7 hari lalu (indeks 0-6) dan 7 hari ke depan termasuk hari ini (indeks 7-13).
function ringkasCuaca(d) {
  const lalu = d.precipitation_sum.slice(0, 7), depan = d.precipitation_sum.slice(7, 14);
  return {
    hujanLalu: bulat(sum(lalu)), hujanDepan: bulat(sum(depan)),
    hariHujanDepan: depan.filter((x) => x >= 1).length, hariHujanLalu: lalu.filter((x) => x >= 1).length,
    suhuMaks: bulat(avg(d.temperature_2m_max.slice(7, 14))), lembap: bulat(avg(d.relative_humidity_2m_mean.slice(7, 14))),
  };
}

const cari = (q) => ({ kata: q, url: 'https://shopee.co.id/search?keyword=' + encodeURIComponent(q) });

// Tiap saran: masalah, penyebab singkat, langkah solusi, produk (kategori + kata kunci cari), usulan judul, dasar data.
// Produk disebut menurut jenis/bahan aktif umum, bukan merek; dosis dan izin edar mengikuti label produk.
function aturan(c) {
  const out = [];
  const lembapHujan = c.hariHujanDepan >= 4 || c.lembap >= 85;
  if (lembapHujan) out.push({
    id: 'patek-hujan', prioritas: 90 + c.hariHujanDepan,
    masalah: 'Buah cabai bercak hitam cekung lalu busuk (patek/antraknosa)',
    sebab: 'Spora jamur menyebar lewat percikan air hujan dan menyerang saat lembap.',
    solusi: ['Buang buah dan daun yang sudah terserang', 'Semprot fungisida sebelum hujan, bukan sesudahnya', 'Campur perekat perata supaya tidak tercuci hujan', 'Pasang mulsa agar tanah tidak memercik ke buah'],
    produk: [cari('fungisida cabai antraknosa'), cari('perekat perata pestisida'), cari('mulsa plastik hitam perak')],
    judul: ['Cabai Busuk Terus Saat Hujan? Cara Semprot Biar Tidak Tercuci', 'Patek Cabai Musim Hujan: Penyebab dan Cara Mengatasinya'],
    dasar: `Hujan ${c.hariHujanDepan} dari 7 hari ke depan, kelembapan ${c.lembap}%`,
  });
  if (c.hujanLalu >= 80 || c.hujanDepan >= 80) out.push({
    id: 'akar-busuk', prioritas: 80 + Math.min(15, Math.round((c.hujanLalu + c.hujanDepan) / 20)),
    masalah: 'Tanaman cabai layu mendadak, pangkal batang busuk (akar busuk dan layu)',
    sebab: 'Tanah tergenang membuat akar kekurangan udara dan jamur tanah menyerang.',
    solusi: ['Buat parit pembuangan di antara bedengan', 'Cabut dan jauhkan tanaman yang sudah layu', 'Beri kapur pertanian untuk menstabilkan pH tanah', 'Kocor agens hayati pada tanaman yang sehat'],
    produk: [cari('trichoderma agens hayati'), cari('dolomit kapur pertanian'), cari('fungisida tanah cabai layu')],
    judul: ['Cabai Layu Tiba-tiba Setelah Hujan Deras? Ini Penyelamatnya', 'Drainase Kebun Cabai Musim Hujan: Biar Akar Tidak Busuk'],
    dasar: `Hujan ${c.hujanLalu} mm minggu lalu dan ${c.hujanDepan} mm prakiraan 7 hari`,
  });
  if (c.hujanLalu >= 50) out.push({
    id: 'pupuk-tercuci', prioritas: 70 + Math.min(10, Math.round(c.hujanLalu / 20)),
    masalah: 'Bunga rontok dan ujung buah menghitam setelah hujan',
    sebab: 'Hujan mencuci pupuk dan kalsium dari tanah, tanaman kekurangan hara.',
    solusi: ['Kurangi pupuk nitrogen, tambah kalium untuk pembuahan', 'Beri kalsium lewat kocor atau semprot daun', 'Pupuk sedikit tapi lebih sering saat hujan'],
    produk: [cari('pupuk kalium cabai'), cari('pupuk kalsium cabai ujung buah busuk'), cari('pupuk daun cabai berbunga')],
    judul: ['Bunga Cabai Rontok Setelah Hujan: Pupuk Apa yang Dibutuhkan?', 'Ujung Buah Cabai Hitam? Ternyata Kekurangan Ini'],
    dasar: `Hujan ${c.hujanLalu} mm dalam 7 hari terakhir`,
  });
  if (c.hujanLalu < 15 && c.hujanDepan >= 40) out.push({
    id: 'awal-hujan', prioritas: 85,
    masalah: 'Awal musim hujan: jamur dan hama meledak saat tanaman belum siap',
    sebab: 'Peralihan dari kering ke hujan membuat kelembapan naik cepat.',
    solusi: ['Rapikan parit dan bedengan sebelum hujan deras', 'Semprot fungisida pencegahan sebelum gejala muncul', 'Siapkan perekat dan terpal penutup'],
    produk: [cari('fungisida pencegahan cabai'), cari('perekat perata pestisida')],
    judul: ['Persiapan Kebun Cabai Sebelum Musim Hujan: 3 Hal Wajib'],
    dasar: `Minggu lalu kering (${c.hujanLalu} mm), 7 hari ke depan ${c.hujanDepan} mm`,
  });
  if (c.hujanDepan < 15) out.push({
    id: 'hama-kering', prioritas: 85 + (c.suhuMaks >= 31 ? 5 : 0),
    masalah: 'Daun cabai keriting dan menguning (thrips, tungau, kutu kebul)',
    sebab: 'Cuaca kering dan panas membuat hama penghisap berkembang cepat.',
    solusi: ['Pasang perangkap lengket kuning di sela tanaman', 'Gunakan mulsa perak untuk mengusir kutu kebul', 'Semprot insektisida sore hari, bagian bawah daun', 'Jaga penyiraman agar tanaman tidak stres'],
    produk: [cari('perangkap lengket kuning'), cari('mulsa perak hitam'), cari('insektisida thrips cabai'), cari('selang irigasi tetes')],
    judul: ['Daun Cabai Keriting Saat Kemarau? Ini Hama Penyebabnya', 'Mulsa Perak dan Perangkap Kuning: Lawan Thrips Tanpa Boros'],
    dasar: `Hujan hanya ${c.hujanDepan} mm dalam 7 hari ke depan, suhu maks ±${c.suhuMaks}°C`,
  });
  if (!out.length) out.push({
    id: 'rutin', prioritas: 50,
    masalah: 'Cuaca campuran: serangan jamur dan hama bisa datang bergantian',
    sebab: 'Kelembapan naik turun membuat tanaman mudah stres.',
    solusi: ['Pangkas tunas air dan daun bawah agar sirkulasi udara baik', 'Pantau tanaman tiap pagi, tindak di gejala pertama', 'Rotasi bahan aktif pestisida agar tidak kebal'],
    produk: [cari('gunting pangkas tanaman'), cari('fungisida cabai'), cari('insektisida cabai')],
    judul: ['Cek Rutin Kebun Cabai: 3 Gejala yang Jangan Dibiarkan'],
    dasar: `Hujan ${c.hujanDepan} mm dalam 7 hari ke depan, kelembapan ${c.lembap}%`,
  });
  return out.sort((a, b) => b.prioritas - a.prioritas).slice(0, 4);
}

async function saran() {
  const l = await lokasi();
  const d = await ambilCuaca(l);
  const cuaca = ringkasCuaca(d);
  return { lokasi: l.nama, cuaca, saran: aturan(cuaca), dihitung: new Date().toISOString() };
}

module.exports = { saran, ringkasCuaca, aturan };
