const test = require('node:test');
const assert = require('node:assert');

const db = require('../src/config/db');
const asli = db.query;
const simpan = new Map();
db.query = async (sql, p = []) => {
  if (/SELECT 1 FROM settings WHERE key/.test(sql)) return { rows: simpan.has(p[0]) ? [{ '?column?': 1 }] : [] };
  if (/INSERT INTO settings/.test(sql)) { simpan.set(p[0], p[1]); return { rows: [] }; }
  return { rows: [] };
};
const { hariSinkron, tandaiRiwayat } = require('../src/services/analyticsService');
test.after(() => { db.query = asli; });

test('riwayat setahun: 400 hari sekali per channel, sesudahnya 95 hari', async () => {
  assert.strictEqual(await hariSinkron('C1', false), 400);
  await tandaiRiwayat('C1', 400);
  assert.strictEqual(await hariSinkron('C1', false), 95);
  assert.strictEqual(await hariSinkron('C2', false), 400); // channel lain belum
});

test('riwayat: tanda tidak dipasang untuk pengambilan pendek; konversi rupiah selalu 400', async () => {
  await tandaiRiwayat('C3', 95);
  assert.strictEqual(await hariSinkron('C3', false), 400);
  await tandaiRiwayat('C3', 400);
  assert.strictEqual(await hariSinkron('C3', true), 400);
});
