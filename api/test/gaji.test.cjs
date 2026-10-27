const test = require('node:test');
const assert = require('node:assert');
const { hitung, validasiAturan, validasiConfig } = require('../src/services/gajiService');
const { validasi, workdaysIn } = require('../src/services/pengajuanService');
const { ringkasRetensi } = require('../src/routes/insight');

const cfg = { hari_kerja: [1, 2, 3, 4, 5, 6], libur: ['2026-10-17'], jatah_cuti: 12 };
const jam = { masuk: '08:00', pulang: '17:00', toleransi: 10 };
const editor = { id: 1, nama: 'Alivia', target_harian: 2, created_at: '2026-01-01T00:00:00Z' };
// 2026-10-31 12:00 WIB: the whole of October except the 31st is over.
const now = Date.parse('2026-10-31T05:00:00Z');
const wib = (d, hm) => new Date(Date.parse(`${d}T${hm}:00Z`) - 7 * 3600 * 1000).toISOString();

function base(extra = {}) {
  return {
    bulan: '2026-10', editor, cfg, jam, now,
    aturan: { gaji_pokok: 3000000, potong_alpa: 100000, potong_telat: 20000, tarif_lembur: 15000, bonus_video: 10000, bonus_1000_views: 500, potongan_tetap: 50000 },
    presensiRows: [], cuti: [], klaim: [], penyesuaian: [], videos: [], mulaiPresensi: '2026-10-26',
    ...extra,
  };
}

test('attendance counts only from the day presensi started; today is never an absence', () => {
  const r = hitung(base({
    presensiRows: [
      { jenis: 'masuk', tanggal: '2026-10-26', waktu: wib('2026-10-26', '08:30'), telat_menit: 20 },
      { jenis: 'pulang', tanggal: '2026-10-26', waktu: wib('2026-10-26', '18:15'), telat_menit: null },
      { jenis: 'masuk', tanggal: '2026-10-27', waktu: wib('2026-10-27', '07:55'), telat_menit: 0 },
      { jenis: 'pulang', tanggal: '2026-10-27', waktu: wib('2026-10-27', '17:10'), telat_menit: null },
    ],
    cuti: [{ jenis: 'sakit', dari: '2026-10-28', sampai: '2026-10-28' }],
  }));
  // 26–30 Oct are workdays before today (31st, Saturday): hadir 26, 27; sakit 28; alpa 29, 30.
  assert.deepStrictEqual([r.hari.hadir, r.hari.sakit, r.hari.alpa], [2, 1, 2]);
  assert.deepStrictEqual(r.hari.alpa_tanggal, ['2026-10-29', '2026-10-30']);
  assert.strictEqual(r.hari.telat, 1);
  assert.strictEqual(r.hari.lembur_menit, 75); // 17:10 is under 30 minutes and does not count
  const line = (l) => (r.baris.find((b) => b.label === l) || {}).jumlah;
  assert.strictEqual(line('Potongan tidak hadir'), -200000);
  assert.strictEqual(line('Potongan telat'), -20000);
  assert.strictEqual(line('Lembur'), 18750);
  assert.strictEqual(r.video.target, 8); // 2 per day × (2 present + 2 absent)
});

test('without presensi nobody is marked absent, and the video target uses working days', () => {
  const r = hitung(base({ mulaiPresensi: null, videos: Array.from({ length: 60 }, () => ({ views: 1000 })) }));
  assert.strictEqual(r.presensi_dipakai, false);
  assert.strictEqual(r.hari.alpa, 0);
  // October 2026 Mon–Sat up to the 30th, minus the 17th as a holiday: 25 days → target 50.
  assert.strictEqual(r.video.target, 50);
  assert.strictEqual(r.baris.find((b) => b.label === 'Bonus video di atas target').jumlah, 100000);
  assert.strictEqual(r.baris.find((b) => b.label === 'Bonus views').jumlah, 30000);
  assert.strictEqual(r.total, 3000000 + 100000 + 30000 - 50000);
});

test('rules that are 0 add no lines, and the total never goes below 0', () => {
  const r = hitung(base({ aturan: { gaji_pokok: 0 }, penyesuaian: [{ jumlah: -500000, keterangan: 'Kasbon' }] }));
  assert.deepStrictEqual(r.baris.map((b) => b.label), ['Gaji pokok', 'Kasbon']);
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.minus, true);
});

test('input checks', () => {
  assert.throws(() => validasiAturan({ gaji_pokok: -1 }));
  assert.strictEqual(validasiAturan({ gaji_pokok: '2500000.4' }).gaji_pokok, 2500000);
  assert.throws(() => validasiConfig({ jatah_cuti: 61 }));
  assert.deepStrictEqual(validasiConfig({ jatah_cuti: 12, hari_kerja: [1] }), { jatah_cuti: 12 });
  assert.throws(() => validasi({ jenis: 'klaim', dari: '2026-10-20', jumlah: 50, alasan: 'Bensin' }));
  assert.throws(() => validasi({ jenis: 'cuti', dari: '2026-10-20', sampai: '2026-10-19', alasan: 'Pulang' }));
  assert.strictEqual(workdaysIn('2026-10-17', '2026-10-19', cfg).length, 1); // Sat holiday, Sun, Mon
});

test('retention summary', () => {
  const pts = [0, 10, 25, 50, 75, 100].map((p, i) => ({ percent_duration: p, retention: 100 - i * 12 }));
  assert.deepStrictEqual(ringkasRetensi(JSON.stringify(pts)), { awal: 88, tengah: 64, akhir: 40 });
  assert.strictEqual(ringkasRetensi('rusak'), null);
});

test('push subscriptions are checked before they are stored', () => {
  const { validasi } = require('../src/services/pushService');
  const ok = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123def456', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } };
  assert.strictEqual(validasi(ok).endpoint, ok.endpoint);
  assert.throws(() => validasi({ ...ok, endpoint: 'http://evil.example/x' }));
  assert.throws(() => validasi({ ...ok, keys: { p256dh: '<script>', auth: 'x' } }));
});
