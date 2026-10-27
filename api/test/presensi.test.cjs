const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../src/services/presensiService');

const KANTOR = { lat: -6.2, lng: 106.816666 };
const cfg = { ...KANTOR, radius: 100, akurasi_maks: 50, ips: ['203.0.113.7', '198.51.100.0/24', '2001:db8:1:2::/64'], jam_masuk: '08:00', toleransi: 10, jam_pulang: '17:00', siap: true };
const now = Date.parse('2026-10-26T01:05:00Z'); // 08:05 WIB
const ok = { cfg, jenis: 'masuk', lat: KANTOR.lat, lng: KANTOR.lng, akurasi: 12, diambil: now - 3000, ip: '203.0.113.7', now };

test('accepts a precise reading inside the office on the office network', () => {
  assert.equal(p.periksa(ok).ok, true);
});

test('refuses when not on the office Wi-Fi, whatever the GPS says', () => {
  const r = p.periksa({ ...ok, ip: '36.80.1.2' });
  assert.equal(r.ok, false);
  assert.match(r.alasan, /Wi-Fi kantor/);
});

test('matches IP ranges and IPv6 prefixes', () => {
  assert.equal(p.periksa({ ...ok, ip: '198.51.100.250' }).ok, true);
  assert.equal(p.periksa({ ...ok, ip: '2001:db8:1:2:abcd::9' }).ok, true);
  assert.equal(p.periksa({ ...ok, ip: '2001:db8:1:3::9' }).ok, false);
  assert.equal(p.ipTerdaftar('not-an-ip', cfg.ips), false);
});

test('refuses GPS accuracy that is too coarse or impossibly perfect', () => {
  assert.match(p.periksa({ ...ok, akurasi: 51 }).alasan, /terlalu besar/);
  assert.match(p.periksa({ ...ok, akurasi: 0 }).alasan, /tidak wajar/);
  assert.match(p.periksa({ ...ok, akurasi: NaN }).alasan, /tidak lengkap/);
});

test('refuses stale or clock-skewed readings', () => {
  assert.match(p.periksa({ ...ok, diambil: now - 3 * 60000 }).alasan, /sudah lama/);
  assert.match(p.periksa({ ...ok, diambil: now + 10 * 60000 }).alasan, /jam server/);
  assert.match(p.periksa({ ...ok, diambil: undefined }).alasan, /jam server/);
});

test('refuses positions outside the radius', () => {
  const r = p.periksa({ ...ok, lat: KANTOR.lat + 0.002 }); // ~222 m north
  assert.equal(r.ok, false);
  assert.match(r.alasan, /dari kantor/);
});

test('refuses a position that jumped faster than a vehicle', () => {
  const terakhir = { lat: KANTOR.lat + 0.1, lng: KANTOR.lng, waktu: new Date(now - 2 * 60000).toISOString() }; // ~11 km, 2 min ago
  assert.match(p.periksa({ ...ok, terakhir }).alasan, /berpindah/);
  const lama = { ...terakhir, waktu: new Date(now - 30 * 60000).toISOString() }; // 11 km in 30 min is fine
  assert.equal(p.periksa({ ...ok, terakhir: lama }).ok, true);
});

test('refuses when the owner has not configured presensi', () => {
  assert.match(p.periksa({ ...ok, cfg: { ...cfg, siap: false } }).alasan, /belum diatur/);
});

test('distance is measured in metres', () => {
  const d = p.jarakMeter(-6.2, 106.8, -6.201, 106.8);
  assert.ok(d > 110 && d < 112, String(d));
});

test('config validation', () => {
  const good = { lat: '-6.2', lng: '106.8', radius: 100, akurasi_maks: 50, ips: ['203.0.113.7'], jam_masuk: '08:00', toleransi: 10, jam_pulang: '17:00' };
  assert.deepEqual(p.validasiConfig(good).ips, ['203.0.113.7']);
  assert.throws(() => p.validasiConfig({ ...good, ips: [] }), /minimal satu IP/);
  assert.throws(() => p.validasiConfig({ ...good, ips: ['999.1.1.1'] }), /tidak valid/);
  assert.throws(() => p.validasiConfig({ ...good, ips: ['10.0.0.0/4'] }), /tidak valid/);
  assert.throws(() => p.validasiConfig({ ...good, lat: '' }), /lat/);
  assert.throws(() => p.validasiConfig({ ...good, jam_pulang: '07:00' }), /setelah jam masuk/);
});

test('IPv6 suggestion is the /64 network', () => {
  assert.equal(p.ipSaran('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(p.ipSaran('203.0.113.7'), '203.0.113.7');
});

test('marks a network-only refusal, so a changed office IP can be spotted', () => {
  const r = p.periksa({ ...ok, ip: '36.80.1.2' });
  assert.equal(r.kode, 'ip');
  // Same reading checked against the new network passes: this is the evidence counted.
  assert.equal(p.periksa({ ...ok, cfg: { ...cfg, ips: [p.ipSaran('36.80.1.2')] }, ip: '36.80.1.2' }).ok, true);
  // Outside the office it is not evidence.
  assert.equal(p.periksa({ ...ok, cfg: { ...cfg, ips: ['36.80.1.2'] }, ip: '36.80.1.2', lat: -6.3 }).ok, false);
  assert.equal(p.ipSaran('2001:db8:1:2:abcd::9'), '2001:db8:1:2::/64');
});
