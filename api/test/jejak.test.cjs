const test = require('node:test');
const assert = require('node:assert');
const { pasangDb, permintaan } = require('./_pg.cjs');

let q, jejak;
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const UA_HP = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const UA_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const VIA = { id: 11, nama: 'Alivia' };
const login = (o = {}) => jejak.catat(permintaan({ editor: VIA, ...o }), { jenis: 'masuk', aksi: 'login_sso', metode: 'sso' });
const baris = () => q('select * from jejak order by id');

test.before(async () => {
  const d = await pasangDb(); q = d.q;
  await q(`insert into editors (nama, kode_identifikasi) values ('Alivia','AL'), ('Deni','DE')`);
  jejak = require('../src/services/jejakService');
});
test.beforeEach(async () => { await q('delete from jejak'); await q('delete from sesi'); await q('delete from login_gagal'); jejak.resetCache(); });

test('login dicatat lengkap: IP, jaringan, perangkat, browser, OS, model, sidik, cara masuk', async () => {
  const h = await login({ ip: '203.0.113.77', headers: { 'user-agent': UA_HP } });
  assert.equal(h.risiko, 0);
  const [r] = await baris();
  assert.deepStrictEqual([r.jenis, r.hasil, r.pengguna_tipe, r.pengguna_nama, r.metode], ['masuk', 'ok', 'karyawan', 'Alivia', 'sso']);
  assert.deepStrictEqual([r.ip, r.jaringan, r.browser, r.os, r.perangkat, r.model], ['203.0.113.77', '203.0.113.0/24', 'Chrome 124', 'Android 14', 'mobile', 'SM-A546E']);
  assert.match(r.sidik, /^[0-9a-f]{12}$/); assert.equal(r.kunci, 'k:11'); assert.equal(r.kantor, false);
  assert.ok(r.ua.includes('SM-A546E')); assert.equal(r.bahasa, 'id-ID,id;q=0.9');
});

test('identitas pemilik dibedakan per akun: Doni dan Windri tidak bercampur', async () => {
  await jejak.catat(permintaan({ admin: true, akun: 'doni@master.app', namaAkun: 'Doni' }), { jenis: 'masuk', aksi: 'login_sso', metode: 'sso' });
  await jejak.catat(permintaan({ admin: true, akun: 'windri@master.app', namaAkun: 'Windri' }), { jenis: 'masuk', aksi: 'login_sso', metode: 'sso' });
  await jejak.catat(permintaan({ admin: true }), { jenis: 'masuk', aksi: 'login_password', metode: 'password' });
  const r = await q(`select pengguna_nama, akun, kunci from jejak order by id`);
  assert.deepStrictEqual(r.map((x) => [x.pengguna_nama, x.akun, x.kunci]), [['Doni', 'doni@master.app', 'a:doni@master.app'], ['Windri', 'windri@master.app', 'a:windri@master.app'], ['Pemilik', null, 'a:pemilik']]);
});

test('perangkat baru dan jaringan baru dikenali setelah punya riwayat; perangkat yang sama tidak', async () => {
  for (let i = 0; i < 2; i++) await login();
  assert.deepStrictEqual((await baris()).map((x) => x.risiko), [0, 0]);
  const baru = await login({ ip: '198.51.100.20', headers: { 'user-agent': UA_WIN, 'accept-language': 'en-US' } });
  assert.deepStrictEqual(baru.tanda.sort(), ['jaringan_baru', 'perangkat_baru']); assert.equal(baru.risiko, 45);
  const [r] = await q(`select detail, tanda, risiko from jejak order by id desc limit 1`);
  assert.ok(r.detail.alasan.some((a) => a.includes('Edge') && a.includes('Windows'))); assert.deepStrictEqual(r.tanda.sort(), ['jaringan_baru', 'perangkat_baru']);
  const lagi = await login({ ip: '198.51.100.20', headers: { 'user-agent': UA_WIN, 'accept-language': 'en-US' } });
  assert.deepStrictEqual(lagi.tanda, ['jaringan_baru'].filter(() => false), 'perangkat dan jaringan itu kini dikenal');
});

test('login orang lain tidak memengaruhi baseline orang ini', async () => {
  for (let i = 0; i < 2; i++) await login();
  const deni = await jejak.catat(permintaan({ editor: { id: 12, nama: 'Deni' }, ip: '198.51.100.20', headers: { 'user-agent': UA_WIN } }), { jenis: 'masuk', aksi: 'login_pin', metode: 'pin' });
  assert.deepStrictEqual(deni.tanda, [], 'login pertama Deni: belum ada pembanding');
});

test('gagal masuk berulang: ditandai tepat pada percobaan ke-5, per IP dan per akun yang dituju', async () => {
  const gagal = (nama) => jejak.catat(permintaan({ ip: '198.51.100.9' }), { jenis: 'gagal', aksi: 'gagal_pin', hasil: 'gagal', status: 401, pengguna: { tipe: 'tamu', id: null, nama, akun: null, kunci: 'x:' + nama, metode: 'pin' } });
  const hasil = []; for (let i = 0; i < 6; i++) hasil.push(await gagal('alivia'));
  assert.deepStrictEqual(hasil.map((h) => h.tanda.join(',')), ['', '', '', '', 'gagal_berulang_ip,gagal_berulang_akun', 'gagal_berulang_ip,gagal_berulang_akun']);
  const lain = await gagal('deni');
  assert.deepStrictEqual(lain.tanda, ['gagal_berulang_ip'], 'akun lain baru sekali gagal, tapi IP-nya sama');
  const [r] = await q(`select detail from jejak where aksi='gagal_pin' order by id limit 1 offset 4`);
  assert.ok(r.detail.alasan.some((a) => a.includes('5 kali gagal')));
});

test('berhasil setelah gagal dari IP yang sama ditandai', async () => {
  for (let i = 0; i < 4; i++) await jejak.catat(permintaan({ ip: '198.51.100.9' }), { jenis: 'gagal', aksi: 'gagal_pin', hasil: 'gagal', pengguna: { tipe: 'tamu', id: null, nama: 'x', akun: null, kunci: 'x:acak' + i, metode: 'pin' } });
  const h = await login({ ip: '198.51.100.9' });
  assert.ok(h.tanda.includes('berhasil_setelah_gagal'));
  const [r] = await q(`select detail from jejak where jenis='masuk'`); assert.ok(r.detail.alasan[0].includes('4 kali gagal'));
});

test('alat otomatis dan UA kosong tercatat sebagai keanehan', async () => {
  const a = await login({ headers: { 'user-agent': 'curl/8.4.0' } });
  assert.ok(a.tanda.includes('perangkat_otomatis'));
  const [r] = await baris(); assert.deepStrictEqual([r.perangkat, r.browser], ['otomatis', 'curl']);
  const b = await login({ headers: { 'user-agent': '' } });
  assert.ok(b.tanda.includes('perangkat_otomatis'));
});

test('rencanakan: apa yang dicatat dari permintaan API biasa', () => {
  const res = (s) => ({ statusCode: s });
  const r = (o, s = 200) => jejak.rencanakan(permintaan(o), res(s));
  assert.equal(r({ editor: VIA, method: 'GET', url: '/api/bootstrap' }), null, 'GET biasa tidak dicatat');
  assert.equal(r({ editor: VIA, method: 'GET', url: '/api/rekap/realtime' }), null);
  assert.equal(r({ editor: VIA, method: 'OPTIONS', url: '/api/x' }), null);
  assert.equal(r({ editor: VIA, method: 'POST', url: '/api/auth/login' }), null, 'login dicatat terpisah');
  assert.equal(r({ editor: VIA, method: 'GET', url: '/go/abc' }), null);
  assert.equal(r({ method: 'GET', url: '/api/bootstrap' }, 200), null, 'tanpa login dan tidak ditolak: tidak dicatat');
  const post = r({ editor: VIA, method: 'POST', url: '/api/aktivitas?x=1' });
  assert.deepStrictEqual([post.jenis, post.aksi, post.hasil, post.status], ['interaksi', 'POST /api/aktivitas', 'ok', 200]);
  const del = r({ editor: VIA, method: 'DELETE', url: '/api/aktivitas/55' }, 204); assert.equal(del.aksi, 'DELETE /api/aktivitas/:id');
  const sens = r({ admin: true, method: 'GET', url: '/api/gaji?bulan=2026-11' }); assert.deepStrictEqual([sens.jenis, sens.aksi], ['sensitif', 'GET /api/gaji']);
  assert.equal(r({ admin: true, method: 'GET', url: '/api/akses' }).jenis, 'sensitif');
  assert.equal(r({ admin: true, method: 'PUT', url: '/api/akses/4' }).jenis, 'sensitif');
  const ditolak = r({ editor: VIA, method: 'GET', url: '/api/editors' }, 403); assert.deepStrictEqual([ditolak.hasil, ditolak.status], ['gagal', 403]);
  const tamu = r({ method: 'POST', url: '/api/content', ip: '198.51.100.40' }, 401); assert.deepStrictEqual([tamu.hasil, tamu.status], ['gagal', 401]);
  assert.equal(r({ method: 'POST', url: '/api/content', ip: '198.51.100.40' }, 401), null, 'tamu dari IP yang sama dibatasi sekali per menit');
  assert.ok(!JSON.stringify(r({ admin: true, method: 'POST', url: '/api/auth/password?token=RAHASIA' }) || {}).includes('RAHASIA'));
});

test('catat tidak pernah melempar galat walau database bermasalah, dan jenis asing diabaikan', async () => {
  assert.equal(await jejak.catat(permintaan(), { jenis: 'tidak-ada', aksi: 'x' }), null);
  assert.equal((await q('select count(*)::int as n from jejak'))[0].n, 0);
  const rusak = permintaan({ editor: VIA }); rusak.headers = null;
  assert.equal(await jejak.catat(rusak, { jenis: 'masuk', aksi: 'x' }), null);
});

test('halaman dibuka: dicatat, rute asing ditolak, dan dibatasi sekali per 20 detik per halaman', async () => {
  const p = (rute) => jejak.catatHalaman(permintaan({ editor: VIA }), rute);
  assert.equal((await p('/rangkuman')).dicatat, true);
  assert.equal((await p('/rangkuman')).dicatat, false, 'terlalu cepat');
  assert.equal((await p('/saran')).dicatat, true, 'halaman lain boleh');
  for (const buruk of ['http://jahat', '/api/x/../..', "/a'; drop table jejak;--", '/' + 'x'.repeat(100), '', null, '/rute spasi']) assert.equal((await p(buruk)).dicatat, false, String(buruk));
  const r = await q(`select aksi, rute, detail from jejak where jenis='halaman' order by id`);
  assert.deepStrictEqual(r.map((x) => x.rute), ['/rangkuman', '/saran']);
});

test('daftar: filter nama, jenis, risiko, kata kunci, dan halaman berikutnya tanpa celah', async () => {
  for (let i = 0; i < 7; i++) await login();
  await jejak.catat(permintaan({ editor: { id: 12, nama: 'Deni' } }), { jenis: 'interaksi', aksi: 'POST /api/aktivitas', rute: '/api/aktivitas', metodeHttp: 'POST', status: 200 });
  await jejak.catat(permintaan({ editor: VIA, headers: { 'user-agent': 'curl/8' } }), { jenis: 'sensitif', aksi: 'GET /api/gaji', rute: '/api/gaji', metodeHttp: 'GET', status: 200 });
  assert.equal((await jejak.daftar({ nama: 'Deni' })).baris.length, 1);
  assert.equal((await jejak.daftar({ jenis: 'masuk' })).baris.length, 7);
  assert.equal((await jejak.daftar({ risikoMin: 30 })).baris.length, 1, 'hanya yang otomatis curl');
  assert.equal((await jejak.daftar({ q: 'gaji' })).baris.length, 1);
  assert.equal((await jejak.daftar({ q: "%'; drop table jejak; --" })).baris.length, 0, 'masukan jahat hanya pencarian biasa');
  assert.equal((await q('select count(*)::int as n from jejak'))[0].n, 9, 'tabel utuh');
  const a = await jejak.daftar({ batas: 4 }); assert.equal(a.baris.length, 4); assert.ok(a.berikutnya);
  const b = await jejak.daftar({ batas: 4, sebelum: a.berikutnya }); const c = await jejak.daftar({ batas: 4, sebelum: b.berikutnya });
  const ids = [...a.baris, ...b.baris, ...c.baris].map((x) => x.id);
  assert.equal(ids.length, 9); assert.equal(new Set(ids).size, 9, 'tidak ada baris ganda');
  assert.equal(c.berikutnya, null);
  assert.equal((await jejak.daftar({ hari: 1 })).baris.length, 9);
  assert.equal((await jejak.daftar({ sampai: '2020-01-01' })).baris.length, 0);
  assert.equal((await jejak.daftar({ sumber: 'master' })).baris.length, 0);
});

test('ringkasan per pengguna, peringatan yang belum ditinjau, dan tinjau', async () => {
  await login(); await login({ headers: { 'user-agent': UA_WIN }, ip: '198.51.100.20' });
  await jejak.catat(permintaan({ editor: { id: 12, nama: 'Deni' } }), { jenis: 'masuk', aksi: 'login_pin', metode: 'pin' });
  const r = await jejak.ringkasan();
  const al = r.pengguna.find((x) => x.nama === 'Alivia');
  assert.deepStrictEqual([al.masuk_30h, al.perangkat, al.ip_unik, al.peringatan], [2, 2, 2, 1]);
  assert.equal(al.terakhirMasuk.os, 'Windows 10/11'); assert.equal(al.aktifSekarang, true);
  assert.equal(r.peringatan, 1); assert.equal(r.tinggi, 0); assert.equal(r.pengguna.length, 2);
  const [p] = (await jejak.daftar({ belumDitinjau: true })).baris;
  assert.equal(await jejak.tinjau(p.id, 'Doni'), true);
  assert.equal(await jejak.tinjau(p.id, 'Doni'), false, 'sudah ditinjau');
  assert.equal((await jejak.ringkasan()).peringatan, 0);
  assert.equal(await jejak.tinjau('1; drop table jejak', 'x'), false);
  const [t] = await q(`select ditinjau_oleh from jejak where id = $1`, [p.id]); assert.equal(t.ditinjau_oleh, 'Doni');
  await login({ headers: { 'user-agent': 'wget/1.21' } }); await login({ headers: { 'user-agent': 'curl/7' } });
  assert.equal(await jejak.tinjauSemua('Doni', 'Alivia'), 2);
});

test('detail pengguna: perangkat, jaringan, jam aktif, halaman', async () => {
  await login(); await login({ headers: { 'user-agent': UA_HP }, ip: '198.51.100.20' }); await login({ headers: { 'user-agent': UA_HP }, ip: '198.51.100.20' });
  await jejak.catatHalaman(permintaan({ editor: VIA }), '/rangkuman');
  const d = await jejak.detailPengguna('Alivia');
  assert.equal(d.perangkat.length, 2); assert.equal(d.perangkat.find((x) => x.model === 'SM-A546E').kali, 2);
  assert.equal(d.jaringan.length, 2); assert.ok(d.jam.length >= 1); assert.equal(d.halaman[0].rute, '/rangkuman');
});

test('sesi aktif dan pencabutan: hanya awalan 12 heksa yang sah', async () => {
  await q(`insert into sesi (token_hash, tipe, editor_id, nama, akun, metode, ip, ua, expires_at) values (repeat('a',64), 'karyawan', (select id from editors where nama='Alivia'), 'Alivia', null, 'pin', '203.0.113.5', 'UA', now() + interval '1 day'), (repeat('b',64), 'admin', null, 'Windri', 'windri@master.app', 'sso', '203.0.113.6', 'UA', now() + interval '1 day'), (repeat('c',64), 'admin', null, 'Basi', null, 'password', '1.1.1.1', 'UA', now() - interval '1 day')`);
  const s = await jejak.sesiAktif();
  assert.deepStrictEqual(s.map((x) => x.nama).sort(), ['Alivia', 'Windri']);
  assert.equal(s.find((x) => x.nama === 'Windri').id, 'bbbbbbbbbbbb');
  for (const buruk of ['bbbb', '', "b'; drop table sesi;--", 'zzzzzzzzzzzz', null]) assert.equal(await jejak.cabutSesi(buruk), 0, String(buruk));
  assert.equal(await jejak.cabutSesi('BBBBBBBBBBBB'), 1);
  assert.equal((await jejak.sesiAktif()).length, 1);
});

test('ekspor CSV: kolom lengkap, kutip digandakan, dan sel berawalan rumus dinetralkan', async () => {
  await jejak.catat(permintaan({ editor: { id: 11, nama: '=HYPERLINK("http://jahat")' }, headers: { 'user-agent': 'curl/8' } }), { jenis: 'interaksi', aksi: 'POST /api/x', rute: '/api/x', metodeHttp: 'POST', status: 200 });
  await jejak.catat(permintaan({ editor: { id: 12, nama: 'Deni, "si" editor' } }), { jenis: 'masuk', aksi: 'login_pin', metode: 'pin' });
  const csv = await jejak.ekspor({});
  const baris = csv.replace(/^﻿/, '').split('\r\n');
  assert.equal(baris.length, 3); assert.ok(baris[0].startsWith('"Waktu (WIB)","Sumber","Jenis"'));
  assert.ok(csv.includes(`"'=HYPERLINK(""http://jahat"")"`), 'rumus dinetralkan dengan tanda kutip');
  assert.ok(csv.includes('"Deni, ""si"" editor"'));
  assert.match(baris[1], /"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}"/);
});

test('pangkas: baris lama berisiko rendah dihapus, yang berisiko tinggi disimpan lebih lama', async () => {
  await q(`insert into jejak (waktu, jenis, aksi, risiko) values (now() - interval '200 days', 'interaksi', 'lama-biasa', 0), (now() - interval '200 days', 'masuk', 'lama-berisiko', 60), (now() - interval '10 days', 'masuk', 'baru', 0), (now() - interval '450 days', 'masuk', 'sangat-lama-berisiko', 90)`);
  assert.equal(await jejak.pangkas(), 2);
  assert.deepStrictEqual((await q('select aksi from jejak order by aksi')).map((x) => x.aksi), ['baru', 'lama-berisiko']);
});
