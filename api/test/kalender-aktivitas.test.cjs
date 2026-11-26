// Kalender aktivitas: aplikasi Express asli + Postgres sungguhan (PGlite). Pokoknya: karyawan hanya menerima miliknya,
// ringkasan Jejak hanya untuk pemilik, dan tanggal dihitung menurut WIB.
const test = require('node:test');
const assert = require('node:assert');
const { pasangDb } = require('./_pg.cjs');

let q, srv, u, svc, idVia, idDeni;
test.before(async () => {
  const d = await pasangDb(); q = d.q;
  assert.deepStrictEqual(d.gagal.filter((x) => /posting/.test(x)), [], 'skema posting terpasang');
  Object.assign(process.env, { ADMIN_PASSWORD: 'sandi-pemilik-123' });
  delete process.env.VERCEL; delete process.env.MASTER_SUPABASE_URL;
  const { hashPin } = require('../src/middlewares/sessionAuth');
  await q(`insert into editors (nama, kode_identifikasi, pin, akun_master, created_at) values ('Via','VI',$1,'via','2026-11-01'), ('Deni','DE',$2,'deni','2026-11-01')`, [hashPin('1234'), hashPin('5678')]);
  [idVia, idDeni] = (await q('select id from editors order by id')).map((r) => r.id);
  // Via: tepat waktu tanggal 2, telat tanggal 3, izin tanggal 4. Deni hanya hadir tanggal 2.
  await q(`insert into presensi (editor_id, tanggal, jenis, waktu, telat_menit, jarak) values
    ($1,'2026-11-02','masuk','2026-11-02 00:55',0,23.4), ($1,'2026-11-02','pulang','2026-11-02 09:04',null,30),
    ($1,'2026-11-03','masuk','2026-11-03 01:21',21,15), ($2,'2026-11-02','masuk','2026-11-02 00:58',0,12)`, [idVia, idDeni]);
  await q(`insert into pengajuan (editor_id, jenis, dari, sampai, alasan, status) values ($1,'izin','2026-11-04','2026-11-04','acara keluarga','disetujui'), ($2,'sakit','2026-11-04','2026-11-04','rahasia-deni','menunggu')`, [idVia, idDeni]);
  // 2 November 18.30 UTC = 3 November 01.30 WIB.
  await q(`insert into content (editor_id, platform, post_id, url, judul, tanggal_upload, views, revenue) values ($1,'youtube','a','https://youtu.be/a','Video Via','2026-11-02 18:30',120,99999), ($2,'youtube','b','https://youtu.be/b','Video Deni','2026-11-02 03:00',50,1), (null,'youtube','c','https://youtu.be/c','Video tanpa kode','2026-11-02 03:00',5,0)`, [idVia, idDeni]);
  const p = await q(`insert into posting (judul, created_at, editor_id) values ('Draf Via','2026-11-02 04:00',$1), ('Draf pemilik','2026-11-02 04:00',null) returning id`, [idVia]);
  await q(`insert into posting_target (posting_id, platform, akun_id, status) values ($1,'tiktok','x','draf')`, [p[0].id]);
  await q(`insert into aktivitas (editor_id, tanggal, jam, tugas, detail) values ($1,'2026-11-02','10:00','Riset harga cabai','pasar induk'), ($2,'2026-11-02','11:00','Edit video','rahasia-deni')`, [idVia, idDeni]);
  await q(`insert into jejak (waktu, sumber, jenis, aksi, hasil, pengguna_tipe, pengguna_id, pengguna_nama, akun, browser, os, kota, ip, risiko) values
    ('2026-11-02 01:00+00','tokder','masuk','login_pin','ok','karyawan',$1,'Via',null,'Chrome 140','Android 15','Kediri','36.80.1.2',0),
    ('2026-11-02 09:00+00','master','perubahan','ubah','ok','akun',null,'via','via@master.app',null,null,null,null,40),
    ('2026-11-02 02:00+00','tokder','masuk','login_sso','ok','admin',null,'Windri','windri@master.app','Safari 26','iOS 26','Surabaya','10.0.0.9',0),
    ('2026-11-02 18:00+00','tokder','interaksi','x','ok','karyawan',$2,'Deni',null,null,null,null,null,0)`, [idVia, idDeni]);
  svc = require('../src/services/kalenderAktivitasService');
  const app = require('../src/app');
  srv = app.listen(0); u = `http://127.0.0.1:${srv.address().port}`;
});
test.after(() => srv.close());

const KINI = Date.parse('2026-11-06T05:00:00Z');
const hari = (r, t) => r.hari.find((h) => h.tanggal === t);
const orang = (r, t, id) => hari(r, t).orang.find((o) => o.id === id);

test('satu bulan penuh dan status kehadiran per orang', async () => {
  const r = await svc.sebulan('2026-11', { admin: true, now: KINI });
  assert.equal(r.hari.length, 30);
  assert.deepStrictEqual(['02', '03', '04', '05', '06', '09'].map((d) => orang(r, '2026-11-' + d, idVia).status), ['hadir', 'telat', 'izin', 'alpa', 'belum', '']);
  assert.equal(orang(r, '2026-11-04', idDeni).status, 'alpa', 'pengajuan yang belum disetujui tidak menghapus ketidakhadiran');
  assert.equal(orang(r, '2026-11-01', idVia).status, 'libur'); assert.equal(hari(r, '2026-11-01').libur, 'Minggu');
  const v = orang(r, '2026-11-02', idVia);
  assert.deepStrictEqual(v.masuk, { jam: '07:55', telat: 0, jarak: 23 }); assert.equal(v.pulang.jam, '16:04');
  assert.equal(v.tugas[0].tugas, 'Riset harga cabai'); assert.deepStrictEqual(v.unggah[0].tujuan, [{ platform: 'tiktok', status: 'draf' }]);
});

test('tanggal mengikuti WIB, dan penghasilan tidak ikut dikirim', async () => {
  const r = await svc.sebulan('2026-11', { admin: true, now: KINI });
  assert.equal(orang(r, '2026-11-02', idVia).video.length, 0);
  assert.equal(orang(r, '2026-11-03', idVia).video[0].jam, '01:30');
  assert.equal(orang(r, '2026-11-03', idDeni).jejak.awal, '01:00', 'jejak 18.00 UTC masuk tanggal 3 WIB');
  assert.ok(!/revenue|99999/.test(JSON.stringify(r)));
});

test('ringkasan Jejak pemilik: gabungan Tokder dan Office per karyawan, tanpa IP; orang lain terpisah', async () => {
  const r = await svc.sebulan('2026-11', { admin: true, now: KINI });
  const j = orang(r, '2026-11-02', idVia).jejak;
  assert.deepStrictEqual([j.jumlah, j.masuk, j.perubahan, j.peringatan, j.awal, j.akhir], [2, 1, 1, 1, '08:00', '16:00']);
  assert.deepStrictEqual(j.lokasi, ['Kediri']);
  assert.deepStrictEqual(hari(r, '2026-11-02').lain.jejak.map((x) => x.nama), ['Windri']);
  assert.deepStrictEqual(hari(r, '2026-11-02').lain.video.map((x) => x.judul), ['Video tanpa kode']);
  assert.deepStrictEqual(hari(r, '2026-11-02').lain.unggah.map((x) => x.judul), ['Draf pemilik']);
  assert.ok(!JSON.stringify(r).includes('36.80.1.2'));
});

test('karyawan lewat HTTP: hanya miliknya, tanpa Jejak, dan parameter tidak bisa memperluas', async () => {
  const masuk = await fetch(u + '/api/auth/editor-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editor_id: idVia, pin: '1234' }) });
  assert.equal(masuk.status, 200);
  const cookie = masuk.headers.get('set-cookie').split(';')[0];
  const res = await fetch(u + `/api/kalender?bulan=2026-11&editor_id=${idDeni}&admin=1`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  const r = await res.json();
  assert.deepStrictEqual(r.orang.map((o) => o.nama), ['Via']);
  assert.ok(r.hari.every((h) => h.orang.length === 1 && h.orang[0].id === idVia && !('lain' in h) && !('jejak' in h.orang[0])));
  const teks = JSON.stringify(r);
  assert.ok(!/Deni|rahasia-deni|Windri|Draf pemilik|tanpa kode|jejak|Kediri/i.test(teks), 'tidak ada data orang lain atau jejak');
});

test('tanpa masuk ditolak; bulan aneh ditolak; karyawan tanpa identitas ditolak', async () => {
  assert.equal((await fetch(u + '/api/kalender?bulan=2026-11')).status, 401);
  await assert.rejects(svc.sebulan('2026-13', { admin: true }), /YYYY-MM/);
  await assert.rejects(svc.sebulan("2026-11'; drop table jejak;--", { admin: true }), /YYYY-MM/);
  await assert.rejects(svc.sebulan('2026-11', {}), /Tidak diizinkan/);
});

test('statusHari: sebelum presensi dipakai tidak dianggap bolos', () => {
  const s = svc.statusHari;
  assert.equal(s({ tanggal: '2026-10-05', hariIni: '2026-11-06', buka: true, mulai: '2026-11-02' }), '');
  assert.equal(s({ tanggal: '2026-11-05', hariIni: '2026-11-06', buka: true, mulai: null }), '');
  assert.equal(s({ tanggal: '2026-11-08', hariIni: '2026-11-09', masuk: { telat_menit: 0 }, buka: false }), 'hadir', 'masuk saat libur tetap tercatat');
});
