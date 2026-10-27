const test = require('node:test');
const assert = require('node:assert');
const kalender = require('../src/services/kalenderService');
const { hitung } = require('../src/services/gajiService');
const { samarkan } = require('../src/services/dataService');
const { bad } = require('../src/utils/httpError');

const cfg = { jadwal: kalender.JADWAL_DEFAULT, cuti_bersama: false, libur_kantor: ['2026-10-31'] };

test('opening hours follow the weekday; Sunday, red dates and office days off are closed', () => {
  assert.deepStrictEqual(kalender.jamPada(cfg, '2026-10-26'), { masuk: '08:00', pulang: '16:00' }); // Senin
  assert.deepStrictEqual(kalender.jamPada(cfg, '2026-10-29'), { masuk: '08:00', pulang: '16:00' }); // Kamis
  assert.deepStrictEqual(kalender.jamPada(cfg, '2026-10-30'), { masuk: '08:00', pulang: '15:00' }); // Jumat
  assert.deepStrictEqual(kalender.jamPada(cfg, '2026-10-24'), { masuk: '08:00', pulang: '15:00' }); // Sabtu
  assert.strictEqual(kalender.jamPada(cfg, '2026-10-25'), null); // Minggu
  assert.strictEqual(kalender.jamPada(cfg, '2026-12-25'), null); // Natal (Jumat)
  assert.strictEqual(kalender.jamPada(cfg, '2026-08-17'), null); // Kemerdekaan (Senin)
  assert.strictEqual(kalender.jamPada(cfg, '2026-10-31'), null); // libur kantor
  // Cuti bersama only when switched on.
  assert.ok(kalender.jamPada(cfg, '2026-12-24'));
  assert.strictEqual(kalender.jamPada({ ...cfg, cuti_bersama: true }, '2026-12-24'), null);
  assert.deepStrictEqual(kalender.kalenderGaji(cfg).hari_kerja, [1, 2, 3, 4, 5, 6]);
});

test('weekly hours are checked', () => {
  const j = kalender.JADWAL_DEFAULT.slice();
  assert.throws(() => kalender.validasiJadwal(j.slice(0, 6), bad));
  assert.throws(() => kalender.validasiJadwal(Array(7).fill(null), bad));
  j[1] = { masuk: '16:00', pulang: '08:00' };
  assert.throws(() => kalender.validasiJadwal(j, bad));
  assert.deepStrictEqual(kalender.validasiJadwal([null, { masuk: '08.00', pulang: '16.00' }, null, null, null, null, null], bad)[1], { masuk: '08:00', pulang: '16:00' });
  assert.throws(() => kalender.validasiLibur('2026-13-01', bad));
});

test('payroll: Friday closes at 15:00, a red date is not an absence, work on a day off is overtime', () => {
  const wib = (d, hm) => new Date(Date.parse(`${d}T${hm}:00Z`) - 7 * 3600 * 1000).toISOString();
  const gcfg = kalender.kalenderGaji(cfg);
  const r = hitung({
    bulan: '2026-08', editor: { id: 1, nama: 'A', target_harian: 1, created_at: '2026-01-01T00:00:00Z' },
    cfg: gcfg, jam: (d) => kalender.jamPada(cfg, d), now: Date.parse('2026-08-19T05:00:00Z'), mulaiPresensi: '2026-08-14',
    aturan: { gaji_pokok: 1 }, cuti: [], klaim: [], penyesuaian: [], videos: [],
    presensiRows: [
      { jenis: 'masuk', tanggal: '2026-08-14', waktu: wib('2026-08-14', '08:00'), telat_menit: 0 }, // Jumat
      { jenis: 'pulang', tanggal: '2026-08-14', waktu: wib('2026-08-14', '15:40'), telat_menit: null }, // 40 mnt lembur
      { jenis: 'masuk', tanggal: '2026-08-17', waktu: wib('2026-08-17', '09:00'), telat_menit: 0 }, // tanggal merah
      { jenis: 'pulang', tanggal: '2026-08-17', waktu: wib('2026-08-17', '12:00'), telat_menit: null }, // 3 jam lembur
      { jenis: 'masuk', tanggal: '2026-08-18', waktu: wib('2026-08-18', '08:00'), telat_menit: 0 },
    ],
  });
  // 14 (Jum), 15 (Sab) absent, 16 Minggu, 17 merah, 18 hadir; 19 is today.
  assert.deepStrictEqual(r.hari.alpa_tanggal, ['2026-08-15']);
  assert.strictEqual(r.hari.lembur_menit, 40 + 180);
});

test('an employee does not learn who made a colleague\'s video', () => {
  assert.strictEqual(samarkan({ editor_id: 2 }, 1).editor_id, 0);
  assert.strictEqual(samarkan({ editor_id: 1 }, 1).editor_id, 1);
  assert.strictEqual(samarkan({ editor_id: null }, 1).editor_id, null);
});
