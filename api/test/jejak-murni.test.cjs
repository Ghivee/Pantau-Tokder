const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/utils/perangkat');
const { nilai, tingkat, ATURAN } = require('../src/utils/anomali');

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.67',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.12.108',
  curl: 'curl/8.4.0',
  python: 'python-requests/2.31.0',
  headless: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/124.0.0.0 Safari/537.36',
};

test('urai perangkat: browser, versi, OS, jenis, dan model dari user agent nyata', () => {
  const t = (ua, browser, os, perangkat) => { const r = P.uraiUA(ua); assert.deepStrictEqual([r.browser, r.os, r.perangkat], [browser, os, perangkat], ua.slice(0, 50)); return r; };
  assert.equal(t(UA.iphone, 'Safari', 'iOS 17', 'mobile').versi, '17');
  t(UA.ipad, 'Safari', 'iPadOS 16', 'tablet');
  const a = t(UA.android, 'Chrome', 'Android 14', 'mobile'); assert.equal(a.model, 'SM-A546E'); assert.equal(a.versi, '124');
  t(UA.androidTablet, 'Chrome', 'Android 13', 'tablet');
  t(UA.macChrome, 'Chrome', 'macOS', 'desktop');
  t(UA.macSafari, 'Safari', 'macOS', 'desktop');
  t(UA.winEdge, 'Edge', 'Windows 10/11', 'desktop');
  t(UA.firefox, 'Firefox', 'Linux', 'desktop');
  assert.equal(P.uraiUA(UA.instagram).browser, 'Aplikasi Instagram/Facebook');
});

test('alat otomatis dan user agent kosong ditandai', () => {
  for (const k of ['curl', 'python', 'headless']) { const r = P.uraiUA(UA[k]); assert.equal(r.otomatis, true, k); assert.equal(r.perangkat, 'otomatis', k); }
  for (const ua of ['', '   ', undefined, null, 'unknown']) { const r = P.uraiUA(ua); assert.equal(r.perangkat, 'kosong'); assert.equal(r.otomatis, true); }
  for (const k of ['iphone', 'android', 'macChrome', 'winEdge', 'firefox']) assert.equal(P.uraiUA(UA[k]).otomatis, false, k);
  assert.ok(P.uraiUA('x'.repeat(5000)).browser.length < 100, 'masukan panjang dipotong');
});

test('sidik perangkat stabil antar versi browser, berbeda antar perangkat', () => {
  const s = (ua) => P.sidik(P.uraiUA(ua));
  assert.equal(s(UA.macChrome), s(UA.macChrome.replace('124.0.0.0', '125.0.6422.60')), 'versi browser naik: tetap perangkat yang sama');
  assert.notEqual(s(UA.macChrome), s(UA.macSafari));
  assert.notEqual(s(UA.macChrome), s(UA.winEdge));
  assert.notEqual(s(UA.android), s(UA.androidTablet));
  assert.equal(P.infoPermintaan({ headers: { 'user-agent': UA.macChrome, 'accept-language': 'id-ID' } }, '1.1.1.1').sidik, P.infoPermintaan({ headers: { 'user-agent': UA.macChrome } }, '1.1.1.1').sidik, 'bahasa tidak memengaruhi: Tokder dan Master mengenali perangkat yang sama');
  assert.match(s(UA.macChrome), /^[0-9a-f]{12}$/);
});

test('prefiks jaringan IPv4 dan IPv6', () => {
  assert.equal(P.prefixJaringan('203.0.113.77'), '203.0.113.0/24');
  assert.equal(P.prefixJaringan('2001:db8:abcd:12::1'), '2001:db8:abcd::/48');
  assert.equal(P.prefixJaringan('2001:0db8:0000:0042:0000:8a2e:0370:7334'), '2001:db8:0::/48');
  assert.equal(P.prefixJaringan('::1'), '0:0:0::/48');
  for (const x of ['', 'unknown', 'abc', '999', null, undefined, '1.2.3']) assert.equal(P.prefixJaringan(x), 'tidak diketahui', String(x));
});

test('jarak haversine: Jakarta-Surabaya sekitar 665 km, titik sama 0, data kurang = null', () => {
  const km = P.jarakKm(-6.2088, 106.8456, -7.2575, 112.7521);
  assert.ok(km > 650 && km < 680, String(km));
  assert.ok(P.jarakKm(1, 1, 1, 1) < 0.001);
  assert.equal(P.jarakKm(null, 1, 2, 3), null);
  assert.equal(P.jarakKm(NaN, 1, 2, 3), null);
  assert.ok(P.jarakKm(-6.2, 106.8, 51.5, -0.12) > 11000, 'Jakarta-London');
});

test('rute dinormalkan: tanpa query, angka dan token jadi penanda', () => {
  assert.equal(P.normalisasiRute('/api/editors/12/pin?x=1'), '/api/editors/:id/pin');
  assert.ok(!P.normalisasiRute('/api/auth/sso?token=SECRET123').includes('SECRET'));
  assert.equal(P.normalisasiRute('/api/posting/media/7/' + 'a'.repeat(32)), '/api/posting/media/:id/:token');
  assert.ok(P.normalisasiRute('/' + 'x'.repeat(500)).length <= 160);
});

test('geo hanya dipercaya di Vercel; header disandi dan dibersihkan', () => {
  const h = { 'x-vercel-ip-country': 'id', 'x-vercel-ip-city': 'Jakarta%20Selatan', 'x-vercel-ip-latitude': '-6.26', 'x-vercel-ip-longitude': '106.81', 'x-vercel-ip-timezone': 'Asia/Jakarta', 'x-vercel-ip-country-region': 'JK' };
  const adaVercel = process.env.VERCEL; delete process.env.VERCEL;
  try {
    assert.equal(P.geoDariHeader(h).negara, null, 'di luar Vercel header bisa dipalsukan: diabaikan');
    process.env.VERCEL = '1';
    const g = P.geoDariHeader(h);
    assert.deepStrictEqual([g.negara, g.kota, g.lintang, g.bujur, g.zona], ['ID', 'Jakarta Selatan', -6.26, 106.81, 'Asia/Jakarta']);
    assert.equal(P.geoDariHeader({ 'x-vercel-ip-latitude': 'bukan-angka', 'x-vercel-ip-city': '%E0%A4%A' }).lintang, null);
  } finally { if (adaVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = adaVercel; }
});

// ---- anomali
const BIASA = P.infoPermintaan({ headers: { 'user-agent': UA.macChrome, 'accept-language': 'id-ID' } }, '203.0.113.5');
const lokJakarta = { negara: 'ID', kota: 'Jakarta', lintang: -6.2088, bujur: 106.8456 };
const RIWAYAT = { masuk: 20, sidik: [BIASA.sidik], jaringan: [BIASA.jaringan], negara: ['ID'], terakhir: null, jam: { total: 40, malam: 0 } };
const kodes = (h) => h.tanda.map((t) => t.kode).sort();
const SIANG = new Date('2026-11-26T05:00:00Z'); // 12:00 WIB
const TENGAH_MALAM = new Date('2026-11-25T19:00:00Z'); // 02:00 WIB
const login = { jenis: 'masuk', hasil: 'ok', tipe: 'karyawan' };

test('login biasa (perangkat, jaringan, negara, jam dikenal) tidak memicu apa pun', () => {
  const h = nilai({ e: login, info: { ...BIASA, ...lokJakarta }, kantor: false, riwayat: RIWAYAT, sekarang: SIANG });
  assert.deepStrictEqual(h.tanda, []); assert.equal(h.risiko, 0); assert.equal(h.tingkat, 'normal');
});

test('login pertama kali seseorang tidak dianggap keanehan (belum ada pembanding)', () => {
  const h = nilai({ e: login, info: BIASA, kantor: false, riwayat: { masuk: 0 }, sekarang: SIANG });
  assert.deepStrictEqual(h.tanda, []);
});

test('perangkat baru, jaringan baru, negara baru dikenali dan diberi alasan yang jelas', () => {
  const asing = P.infoPermintaan({ headers: { 'user-agent': UA.winEdge, 'accept-language': 'en-US', 'x-vercel-ip-country': 'RU' } }, '198.51.100.9');
  const adaVercel = process.env.VERCEL; process.env.VERCEL = '1';
  try {
    const info = P.infoPermintaan({ headers: { 'user-agent': UA.winEdge, 'accept-language': 'en-US', 'x-vercel-ip-country': 'RU', 'x-vercel-ip-city': 'Moscow', 'x-vercel-ip-latitude': '55.75', 'x-vercel-ip-longitude': '37.62' } }, '198.51.100.9');
    const h = nilai({ e: login, info, kantor: false, riwayat: RIWAYAT, sekarang: SIANG });
    assert.deepStrictEqual(kodes(h), ['jaringan_baru', 'negara_baru', 'perangkat_baru']);
    assert.equal(h.risiko, 90); assert.equal(h.tingkat, 'tinggi');
    assert.ok(h.tanda.find((t) => t.kode === 'negara_baru').ket.includes('RU'));
    assert.ok(h.tanda.find((t) => t.kode === 'perangkat_baru').ket.includes('Edge'));
  } finally { if (adaVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = adaVercel; }
  assert.ok(asing.sidik !== BIASA.sidik);
});

test('jaringan kantor tidak dianggap jaringan baru', () => {
  const info = { ...BIASA, jaringan: '10.9.9.0/24', ip: '10.9.9.9' };
  assert.ok(!kodes(nilai({ e: login, info, kantor: true, riwayat: RIWAYAT, sekarang: SIANG })).includes('jaringan_baru'));
  assert.ok(kodes(nilai({ e: login, info, kantor: false, riwayat: RIWAYAT, sekarang: SIANG })).includes('jaringan_baru'));
});

test('lompatan lokasi: Jakarta ke London dalam 2 jam ditandai; Jakarta ke Bandung dalam 2 jam tidak; 3 hari kemudian tidak', () => {
  const dulu = (jam) => ({ waktu: new Date(SIANG.getTime() - jam * 3600000), ...lokJakarta });
  const london = { ...BIASA, negara: 'ID', kota: 'London', lintang: 51.5, bujur: -0.12 };
  const h = nilai({ e: login, info: london, kantor: false, riwayat: { ...RIWAYAT, terakhir: dulu(2) }, sekarang: SIANG });
  assert.ok(kodes(h).includes('lompatan_lokasi')); assert.ok(h.tanda.find((t) => t.kode === 'lompatan_lokasi').ket.includes('London'));
  const bandung = { ...BIASA, kota: 'Bandung', lintang: -6.9175, bujur: 107.6191 };
  assert.ok(!kodes(nilai({ e: login, info: bandung, kantor: false, riwayat: { ...RIWAYAT, terakhir: dulu(2) }, sekarang: SIANG })).includes('lompatan_lokasi')); // ~120 km
  assert.ok(!kodes(nilai({ e: login, info: london, kantor: false, riwayat: { ...RIWAYAT, terakhir: dulu(72) }, sekarang: SIANG })).includes('lompatan_lokasi'));
});

test('lompatan lokasi: jarak dekat tidak pernah ditandai walau waktunya sangat singkat (lokasi dari IP hanya perkiraan kota)', () => {
  const dulu = { waktu: new Date(SIANG.getTime() - 5 * 60000), ...lokJakarta };
  const bandung = { ...BIASA, kota: 'Bandung', lintang: -6.9175, bujur: 107.6191 }; // ~120 km dalam 5 menit = >1400 km/jam
  assert.ok(!kodes(nilai({ e: login, info: bandung, kantor: false, riwayat: { ...RIWAYAT, terakhir: dulu }, sekarang: SIANG })).includes('lompatan_lokasi'));
  const surabaya = { ...BIASA, kota: 'Surabaya', lintang: -7.2575, bujur: 112.7521 }; // ~665 km dalam 5 menit
  assert.ok(kodes(nilai({ e: login, info: surabaya, kantor: false, riwayat: { ...RIWAYAT, terakhir: dulu }, sekarang: SIANG })).includes('lompatan_lokasi'));
  // jauh tapi wajar secara kecepatan (Jakarta-Surabaya 9 jam, naik pesawat/kereta): tidak ditandai
  const lama = { waktu: new Date(SIANG.getTime() - 9 * 3600000), ...lokJakarta };
  assert.ok(!kodes(nilai({ e: login, info: surabaya, kantor: false, riwayat: { ...RIWAYAT, terakhir: lama }, sekarang: SIANG })).includes('lompatan_lokasi'));
});

test('gagal berulang per IP dan per akun; berhasil setelah banyak gagal', () => {
  const g = (r) => nilai({ e: { jenis: 'gagal', hasil: 'gagal', tipe: 'tamu' }, info: BIASA, kantor: false, riwayat: r, sekarang: SIANG });
  assert.deepStrictEqual(kodes(g({ gagalIp: 4, gagalAkun: 4 })), []);
  assert.deepStrictEqual(kodes(g({ gagalIp: 5, gagalAkun: 2 })), ['gagal_berulang_ip']);
  assert.deepStrictEqual(kodes(g({ gagalIp: 5, gagalAkun: 6 })), ['gagal_berulang_akun', 'gagal_berulang_ip']);
  const ok = nilai({ e: login, info: BIASA, kantor: false, riwayat: { ...RIWAYAT, gagalAkun: 3 }, sekarang: SIANG });
  assert.deepStrictEqual(kodes(ok), ['berhasil_setelah_gagal']);
  assert.equal(ok.tingkat, 'sedang');
});

test('alat otomatis dan UA kosong; satu IP banyak akun; banyak ditolak; lonjakan aksi', () => {
  const curl = P.infoPermintaan({ headers: { 'user-agent': 'curl/8.4.0' } }, '203.0.113.5');
  assert.ok(kodes(nilai({ e: { jenis: 'interaksi', hasil: 'ok', tipe: 'karyawan' }, info: curl, kantor: false, riwayat: {}, sekarang: SIANG })).includes('perangkat_otomatis'));
  const kosong = P.infoPermintaan({ headers: {} }, '203.0.113.5');
  assert.ok(nilai({ e: login, info: kosong, kantor: false, riwayat: {}, sekarang: SIANG }).tanda.find((t) => t.kode === 'perangkat_otomatis').ket.includes('kosong'));
  const baik = { jenis: 'interaksi', hasil: 'ok', tipe: 'karyawan' };
  assert.ok(kodes(nilai({ e: baik, info: BIASA, kantor: false, riwayat: { akunSamaIp: 3 }, sekarang: SIANG })).includes('ip_dipakai_banyak_akun'));
  assert.ok(!kodes(nilai({ e: baik, info: BIASA, kantor: true, riwayat: { akunSamaIp: 5 }, sekarang: SIANG })).includes('ip_dipakai_banyak_akun'), 'kantor wajar dipakai bersama');
  assert.ok(kodes(nilai({ e: { ...baik, hasil: 'gagal', status: 403 }, info: BIASA, kantor: false, riwayat: { ditolak5m: 10 }, sekarang: SIANG })).includes('banyak_ditolak'));
  assert.ok(!kodes(nilai({ e: { ...baik, hasil: 'gagal', status: 403 }, info: BIASA, kantor: false, riwayat: { ditolak5m: 9 }, sekarang: SIANG })).includes('banyak_ditolak'));
  assert.ok(kodes(nilai({ e: baik, info: BIASA, kantor: false, riwayat: { aksiPerMenit: 60 }, sekarang: SIANG })).includes('lonjakan_aksi'));
  assert.ok(!kodes(nilai({ e: baik, info: BIASA, kantor: false, riwayat: { aksiPerMenit: 59 }, sekarang: SIANG })).includes('lonjakan_aksi'));
});

test('jam tidak lazim: hanya bila sudah cukup riwayat dan orang itu memang tidak pernah aktif malam', () => {
  const mk = (jam) => nilai({ e: login, info: BIASA, kantor: false, riwayat: { ...RIWAYAT, jam }, sekarang: TENGAH_MALAM });
  assert.ok(kodes(mk({ total: 40, malam: 0 })).includes('jam_tak_lazim'));
  assert.ok(!kodes(mk({ total: 40, malam: 8 })).includes('jam_tak_lazim'), 'sering aktif malam: wajar');
  assert.ok(!kodes(mk({ total: 10, malam: 0 })).includes('jam_tak_lazim'), 'riwayat belum cukup');
  assert.ok(!kodes(nilai({ e: login, info: BIASA, kantor: false, riwayat: RIWAYAT, sekarang: SIANG })).includes('jam_tak_lazim'), 'siang hari');
});

test('pemilik dari luar kantor di perangkat baru; baca data sensitif di luar kantor', () => {
  const baru = { ...BIASA, sidik: 'bukan-dikenal1' };
  assert.ok(kodes(nilai({ e: { ...login, tipe: 'admin' }, info: baru, kantor: false, riwayat: RIWAYAT, sekarang: SIANG })).includes('pemilik_luar_kantor'));
  assert.ok(!kodes(nilai({ e: { ...login, tipe: 'admin' }, info: BIASA, kantor: false, riwayat: RIWAYAT, sekarang: SIANG })).includes('pemilik_luar_kantor'), 'perangkat dan jaringan biasa');
  const s = { jenis: 'sensitif', hasil: 'ok', tipe: 'karyawan' };
  assert.ok(kodes(nilai({ e: s, info: BIASA, kantor: false, riwayat: {}, sekarang: SIANG })).includes('baca_sensitif_luar_kantor'));
  assert.ok(!kodes(nilai({ e: s, info: BIASA, kantor: true, riwayat: {}, sekarang: SIANG })).includes('baca_sensitif_luar_kantor'));
  assert.ok(!kodes(nilai({ e: { ...s, tipe: 'admin' }, info: BIASA, kantor: false, riwayat: {}, sekarang: SIANG })).includes('baca_sensitif_luar_kantor'), 'pemilik membaca data sendiri: wajar, bukan peringatan');
});

test('skor dibatasi 100, tingkat sesuai ambang, dan setiap aturan punya bobot dan judul', () => {
  assert.deepStrictEqual([0, 9, 10, 29, 30, 59, 60, 100].map(tingkat), ['normal', 'normal', 'rendah', 'rendah', 'sedang', 'sedang', 'tinggi', 'tinggi']);
  for (const [k, a] of Object.entries(ATURAN)) { assert.ok(a.bobot > 0 && a.judul, k); }
  const parah = nilai({ e: { jenis: 'gagal', hasil: 'gagal', tipe: 'tamu', status: 403 }, info: P.infoPermintaan({ headers: {} }, '1.2.3.4'), kantor: false, riwayat: { gagalIp: 9, gagalAkun: 9, ditolak5m: 50, aksiPerMenit: 500, akunSamaIp: 9 }, sekarang: SIANG });
  assert.ok(parah.risiko <= 100); assert.equal(parah.tingkat, 'tinggi');
});

test('robot tanpa login hanya bernilai rendah; robot yang sudah masuk sebagai orang tetap peringatan', () => {
  const bot = P.infoPermintaan({ headers: { 'user-agent': UA.headless } }, '1.1.1.1');
  const tamu = nilai({ e: { jenis: 'interaksi', hasil: 'gagal', tipe: 'tamu', status: 401 }, info: bot, kantor: false, riwayat: {}, sekarang: SIANG });
  assert.deepStrictEqual([tamu.risiko, tamu.tingkat], [5, 'normal'], 'dicatat tetapi tidak naik jadi peringatan');
  const orang = nilai({ e: { jenis: 'masuk', hasil: 'ok', tipe: 'karyawan' }, info: bot, kantor: false, riwayat: {}, sekarang: SIANG });
  assert.ok(orang.risiko >= 30, 'orang yang login lewat alat otomatis tetap diberi peringatan');
});
