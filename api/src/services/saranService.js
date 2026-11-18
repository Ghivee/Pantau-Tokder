const axios = require('axios');
const db = require('../config/db');
const { getChannelIds, getChannelNames } = require('./channelService');
const { MASALAH, harga, SEPANJANG_MASA, gabung } = require('./saranData');

// Saran konten: masalah kebun yang relevan dari cuaca terkini, lalu judul dan kata kunci per channel.
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

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const tanggalWib = () => { const d = new Date(Date.now() + 7 * 3600 * 1000); return { h: d.getUTCDate(), b: BULAN[d.getUTCMonth()], t: d.getUTCFullYear() }; };

const kondisiOf = (c) => (c.hariHujanDepan >= 4 || c.hujanDepan >= 60 ? 'hujan' : c.hujanDepan < 15 ? 'kering' : 'campuran');

// Masalah kebun yang relevan saat ini, paling mendesak dulu (maksimal 4), dengan dasar cuacanya.
function aturan(c) {
  const out = [];
  const tambah = (id, prioritas, dasar) => out.push({ id, prioritas, dasar });
  if (c.hariHujanDepan >= 4 || c.lembap >= 85) tambah('patek', 90 + c.hariHujanDepan, `Hujan ${c.hariHujanDepan} dari 7 hari ke depan, lembap ${c.lembap}%`);
  if (c.hujanLalu >= 80 || c.hujanDepan >= 80) tambah('akar', 80 + Math.min(15, Math.round((c.hujanLalu + c.hujanDepan) / 20)), `Hujan ${c.hujanLalu} mm minggu lalu, ${c.hujanDepan} mm prakiraan`);
  if (c.hujanLalu >= 50) tambah('pupuk', 70 + Math.min(10, Math.round(c.hujanLalu / 20)), `Hujan ${c.hujanLalu} mm dalam 7 hari terakhir`);
  if (c.hujanLalu < 15 && c.hujanDepan >= 40) tambah('awal', 85, `Minggu lalu kering (${c.hujanLalu} mm), 7 hari ke depan ${c.hujanDepan} mm`);
  if (c.hujanDepan < 15) tambah('hama', 85 + (c.suhuMaks >= 31 ? 5 : 0), `Hujan hanya ${c.hujanDepan} mm dalam 7 hari ke depan, suhu maks ±${c.suhuMaks}°C`);
  if (!out.length) tambah('rutin', 50, `Hujan ${c.hujanDepan} mm dalam 7 hari ke depan, lembap ${c.lembap}%`);
  return out.sort((a, b) => b.prioritas - a.prioritas).slice(0, 4);
}

// Tema channel dari namanya: harga (update harga), budidaya (masalah-solusi kebun), selain itu produk dan alat.
const temaOf = (nama) => (/harga/i.test(nama) ? 'harga' : /budidaya/i.test(nama) ? 'budidaya' : 'tokder');

async function saran() {
  const [l, ids, names] = await Promise.all([lokasi(), getChannelIds(), getChannelNames()]);
  const d = await ambilCuaca(l);
  const cuaca = ringkasCuaca(d);
  const kondisi = kondisiOf(cuaca);
  const w = tanggalWib();
  const hg = harga(kondisi, `${w.h} ${w.b} ${w.t}`, `${w.h} ${w.b}`, `${w.b} ${w.t}`);
  const channels = ids.map((id) => ({ id, nama: names[id] || id, tema: temaOf(names[id] || '') }));
  const masalah = aturan(cuaca).map((x) => {
    const m = MASALAH[x.id];
    const per = {};
    for (const ch of channels) per[ch.id] = ch.tema === 'harga' ? hg : ch.tema === 'budidaya' ? gabung(m.budidaya, SEPANJANG_MASA.budidaya) : gabung(m.tokder, SEPANJANG_MASA.tokder);
    return { id: x.id, label: m.label, masalah: m.masalah, solusi: m.solusi, produk: m.produk, dasar: x.dasar, per };
  });
  const ringkas = kondisi === 'hujan' ? `Hujan ${cuaca.hariHujanDepan} dari 7 hari` : kondisi === 'kering' ? `Kering, hujan ${cuaca.hujanDepan} mm/7 hari` : `Cuaca campuran, hujan ${cuaca.hujanDepan} mm/7 hari`;
  return { lokasi: l.nama, ringkas: `${ringkas} · lembap ${cuaca.lembap}%`, kondisi, cuaca, channels, masalah, dihitung: new Date().toISOString() };
}

module.exports = { saran, ringkasCuaca, aturan, kondisiOf, temaOf };
