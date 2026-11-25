// Draf pendapatan bulanan (AdSense dan komisi afiliasi) dari Pantau ke antrean persetujuan kas di Master.
// Aturan: satu draf per sumber per bulan, dibuat sekali. Draf yang sudah ada tidak pernah ditimpa, karena pemilik
// bisa menyesuaikan jumlahnya dengan pembayaran sebenarnya di bank. Hanya bulan yang sudah selesai.
const db = require('../config/db');
const { getChannelNames } = require('./channelService');
const master = require('./kontenMasterService');

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const labelBulan = (ym) => BULAN[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4);

// Dua bulan terakhir yang sudah selesai (WIB), terlama dulu: ['2026-09', '2026-10'] bila sekarang November 2026.
function bulanSelesai(waktu = new Date(), n = 2) {
  const sekarang = new Date(waktu.getTime() + 7 * 3600 * 1000);
  const out = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

const akhirBulan = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5), 0)).toISOString().slice(0, 10);

// Murni: menyusun baris draf untuk Master. adsense: [{ channel_id, total }], nama: { id: nama }.
function susunDraf({ ym, adsense, nama, afiliasi }) {
  const draf = [];
  const totalAds = adsense.reduce((a, r) => a + (+r.total || 0), 0);
  if (Math.round(totalAds) > 0) {
    const rincian = adsense.filter((r) => Math.round(+r.total) > 0).sort((a, b) => b.total - a.total)
      .map((r) => `${nama[r.channel_id] || r.channel_id} ${rp(r.total)}`).join(', ');
    draf.push({
      kunci: 'adsense:' + ym, platform: 'youtube', jumlah: Math.round(totalAds), tanggal: akhirBulan(ym),
      catatan: `Estimasi YouTube Analytics ${labelBulan(ym)}: ${rincian}. Sesuaikan dengan pembayaran AdSense yang masuk bank.`,
    });
  }
  if (Math.round(+afiliasi || 0) > 0) {
    draf.push({
      kunci: 'afiliasi:' + ym, platform: 'afiliasi', jumlah: Math.round(+afiliasi), tanggal: akhirBulan(ym),
      catatan: `Komisi afiliasi ${labelBulan(ym)} dari laporan konversi yang diimpor di Pantau. Sesuaikan dengan pencairan yang masuk.`,
    });
  }
  return draf;
}

async function sudahRupiah() {
  const r = await db.query(`SELECT 1 FROM settings WHERE key = 'pendapatan_rupiah'`);
  return r.rows.length > 0;
}

async function hitung(ym) {
  const awal = ym + '-01', akhir = akhirBulan(ym);
  const a = await db.query(`SELECT channel_id, SUM(revenue)::float AS total FROM channel_daily WHERE tanggal BETWEEN $1 AND $2 AND revenue IS NOT NULL GROUP BY channel_id`, [awal, akhir]);
  const f = await db.query(`SELECT COALESCE(SUM(komisi), 0)::float AS total FROM afiliasi_komisi WHERE tanggal BETWEEN $1 AND $2`, [awal, akhir]);
  return susunDraf({ ym, adsense: a.rows, nama: await getChannelNames(), afiliasi: f.rows[0].total });
}

// Status draf yang sudah ada di Master: { kunci: status }.
async function statusMaster() {
  const r = await master.rest('GET', 'kas_harian?select=sumber_kunci,status&sumber_kunci=not.is.null&limit=500');
  if (r.status === 404) throw new Error('Tabel kas belum ada di Master (jalankan supabase/kas.sql)');
  if (r.status >= 300 || !Array.isArray(r.json)) throw new Error('Master menolak membaca draf (' + r.status + ')');
  return Object.fromEntries(r.json.map((x) => [x.sumber_kunci, x.status]));
}

async function pratinjau() {
  if (!master.siap()) return { terhubung: false, bulan: [] };
  if (!(await sudahRupiah())) return { terhubung: true, rupiah: false, bulan: [] };
  const ada = await statusMaster();
  const bulan = [];
  for (const ym of bulanSelesai()) {
    bulan.push({ ym, label: labelBulan(ym), draf: (await hitung(ym)).map((d) => ({ ...d, di_master: ada[d.kunci] || null })) });
  }
  return { terhubung: true, rupiah: true, bulan };
}

async function kirim() {
  const p = await pratinjau();
  if (!p.terhubung) throw new Error('Sambungan Master belum diatur');
  if (!p.rupiah) throw new Error('Pendapatan belum dikonversi ke rupiah; tunggu sinkron YouTube berikutnya');
  let dibuat = 0, sudah = 0;
  for (const b of p.bulan) {
    for (const d of b.draf) {
      if (d.di_master) { sudah++; continue; }
      const r = await master.rest('POST', 'kas_harian', { tanggal: d.tanggal, platform: d.platform, jumlah: d.jumlah, catatan: d.catatan, sumber_kunci: d.kunci });
      if (r.status === 409) { sudah++; continue; } // dibuat bersamaan oleh permintaan lain
      if (r.status >= 300) throw new Error('Master menolak draf ' + d.kunci + (r.json && r.json.message ? ': ' + r.json.message : ' (' + r.status + ')'));
      dibuat++;
    }
  }
  return { dibuat, sudah };
}

module.exports = { susunDraf, bulanSelesai, pratinjau, kirim };
