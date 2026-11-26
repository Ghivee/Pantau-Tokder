// Gaji gabungan: Pantau membaca jumlah pcs terjual dari Master (komponen penjualan) dan mengirim total gaji
// per orang ke Master (dipakai Laba). Keduanya lewat fungsi khusus di Master (supabase/gaji-pantau.sql) yang
// hanya bisa dipanggil akun pantau@master.app: Pantau tidak bisa membaca isi order atau keuangan Master.
const master = require('./kontenMasterService');

const BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;
const CACHE_MS = 10 * 60 * 1000;
let cache = {}; // { [bulan]: { at, hasil } }
const reset = () => { cache = {}; };

// { terhubung, pcs, per_channel: { shopee: 12, ... }, galat? }. Tidak pernah melempar: gaji tetap bisa dihitung.
async function penjualan(bulan) {
  if (!BULAN.test(bulan)) return { terhubung: false, pcs: 0, per_channel: {}, galat: 'Bulan tidak valid' };
  if (!master.siap()) return { terhubung: false, pcs: 0, per_channel: {}, galat: 'Sambungan Master belum diatur' };
  const c = cache[bulan];
  if (c && Date.now() - c.at < CACHE_MS) return c.hasil;
  try {
    const r = await master.rest('POST', 'rpc/penjualan_pcs', { p_bulan: bulan }, null);
    if (r.status === 404) return { terhubung: false, pcs: 0, per_channel: {}, galat: 'Fungsi penjualan_pcs belum ada di Master (jalankan supabase/gaji-pantau.sql)' };
    if (r.status >= 300 || !Array.isArray(r.json)) return { terhubung: false, pcs: 0, per_channel: {}, galat: 'Master menolak membaca penjualan (' + r.status + ')' };
    const per_channel = {};
    for (const x of r.json) per_channel[x.channel] = (per_channel[x.channel] || 0) + (Number(x.pcs) || 0);
    const hasil = { terhubung: true, pcs: Object.values(per_channel).reduce((a, b) => a + b, 0), per_channel };
    cache[bulan] = { at: Date.now(), hasil };
    return hasil;
  } catch (e) {
    return { terhubung: false, pcs: 0, per_channel: {}, galat: 'Master belum bisa dihubungi' };
  }
}

// Murni: daftar gaji satu bulan -> isi yang dikirim ke Master. Kunci = akun Master (via/deni) bila dipetakan.
function susunKiriman(list, editors) {
  const staff = {};
  for (const g of list) {
    const e = editors.find((x) => x.id === g.editor_id) || {};
    const k = e.akun_master || 'pantau_' + g.editor_id;
    staff[k] = { total: Math.round(Number(g.total) || 0), nama: g.nama, final: g.status === 'final' };
  }
  return { staff, final: list.length > 0 && list.every((g) => g.status === 'final') };
}

async function kirim(bulan, list, editors) {
  if (!master.siap()) throw new Error('Sambungan Master belum diatur');
  const data = susunKiriman(list, editors);
  const r = await master.rest('POST', 'rpc/kirim_gaji', { p_bulan: bulan, p_data: data }, null);
  if (r.status === 404) throw new Error('Fungsi kirim_gaji belum ada di Master (jalankan supabase/gaji-pantau.sql)');
  if (r.status >= 300) throw new Error('Master menolak data gaji' + (r.json && r.json.message ? ': ' + r.json.message : ' (' + r.status + ')'));
  return data;
}

module.exports = { penjualan, susunKiriman, kirim, reset };
