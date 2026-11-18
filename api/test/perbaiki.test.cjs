const test = require('node:test');
const assert = require('node:assert');
const { cariPerbaikan } = require('../src/services/perbaikiService');
const { ringkas } = require('../src/integrations/reporting');
const { kelompokkan, isPertanyaan } = require('../src/services/komentarService');
const { susunDeskripsi, tagarProduk, KALIMAT_AFILIASI } = require('../src/utils/deskripsi');

const vid = (id, ch, views = 5000, umur = 10) => ({ id, channel_id: ch, judul: 'Video ' + id, views, umur_hari: umur, url: 'https://youtu.be/' + id });

test('perbaiki: CTR jauh di bawah rata-rata channel masuk "thumbnail dan judul", urut dari yang paling rugi', () => {
  const videos = [vid('aaaaaa', 'C1'), vid('bbbbbb', 'C1'), vid('cccccc', 'C1'), vid('dddddd', 'C1')];
  const reach = new Map([['aaaaaa', { impresi: 20000, ctr: 2 }], ['bbbbbb', { impresi: 5000, ctr: 2 }], ['cccccc', { impresi: 30000, ctr: 6 }], ['dddddd', { impresi: 500, ctr: 1 }]]);
  const r = cariPerbaikan({ videos, reach, ctrChannel: { C1: { impresi: 55500, ctr: 4.5 } }, awal: new Map() });
  assert.deepStrictEqual(r.thumbnail.map((x) => x.id), ['aaaaaa', 'bbbbbb']); // dddddd: impresi < 1000, cccccc: CTR bagus
  assert.ok(r.thumbnail[0].potensi > r.thumbnail[1].potensi);
  assert.strictEqual(r.thumbnail[0].ctr_channel, 4.5);
});

test('perbaiki: CTR bagus tapi retensi awal jatuh masuk "pembukaan"; CTR rendah tidak', () => {
  const videos = [vid('aaaaaa', 'C1'), vid('bbbbbb', 'C1'), vid('cccccc', 'C1'), vid('dddddd', 'C1'), vid('eeeeee', 'C1'), vid('ffffff', 'C1')];
  const reach = new Map(videos.map((v) => [v.id, { impresi: 5000, ctr: 5 }]));
  reach.set('ffffff', { impresi: 5000, ctr: 2 });
  const awal = new Map([['aaaaaa', 40], ['bbbbbb', 75], ['cccccc', 76], ['dddddd', 78], ['eeeeee', 80], ['ffffff', 35]]);
  const r = cariPerbaikan({ videos, reach, ctrChannel: { C1: { impresi: 30000, ctr: 4.8 } }, awal });
  assert.deepStrictEqual(r.pembukaan.map((x) => x.id), ['aaaaaa']);
  assert.ok(r.thumbnail.some((x) => x.id === 'ffffff') && !r.pembukaan.some((x) => x.id === 'ffffff'));
  assert.ok(r.pembukaan[0].awal < r.pembukaan[0].awal_channel);
});

test('perbaiki: data kurang berarti tidak ada tuduhan; video baru dilewati', () => {
  const videos = [vid('aaaaaa', 'C1', 5000, 1), vid('bbbbbb', 'C2')];
  const reach = new Map([['aaaaaa', { impresi: 9000, ctr: 1 }], ['bbbbbb', { impresi: 9000, ctr: 1 }]]);
  const r = cariPerbaikan({ videos, reach, ctrChannel: { C1: { impresi: 50000, ctr: 5 }, C2: { impresi: 100, ctr: 5 } }, awal: new Map([['bbbbbb', 10]]) });
  assert.deepStrictEqual([r.thumbnail, r.pembukaan], [[], []]); // C1 baru 1 hari; C2 baseline impresi terlalu kecil dan retensi < 5 video
  assert.strictEqual(r.siap.ctr, true);
  assert.strictEqual(r.siap.retensi, false);
  assert.strictEqual(cariPerbaikan({ videos: [], reach: new Map(), ctrChannel: {}, awal: new Map() }).siap.ctr, false);
});

test('laporan reach: per hari dan per video, CTR pecahan dikali 100, baris rusak dibuang', () => {
  const csv = ['date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr',
    '20261110,C,aaaaaaaaaaa,1000,0.04', '20261110,C,bbbbbbbbbbb,3000,0.06', '20261111,C,aaaaaaaaaaa,500,0.05', '20261111,C,,200,0.05', 'rusak,C,x,1,1'].join('\n');
  const r = ringkas(csv);
  assert.deepStrictEqual(r.hari['2026-11-10'], { impresi: 4000, ctr: 5.5 });
  assert.strictEqual(r.video.length, 3);
  const a = r.video.find((x) => x.video_id === 'aaaaaaaaaaa' && x.tanggal === '2026-11-10');
  assert.deepStrictEqual([a.impresi, a.ctr], [1000, 4]);
  assert.throws(() => ringkas('foo,bar\n1,2'), /tidak dikenali/);
});

test('komentar: hanya pertanyaan yang jelas, tanpa spam dan duplikat, dikelompokkan ke topik', () => {
  assert.ok(isPertanyaan('Kenapa daun cabe rawit saya keriting ya, obatnya apa?'));
  assert.ok(!isPertanyaan('Mantap bang'));
  assert.ok(!isPertanyaan('Apa kabar? cek https://spam.example/slot'));
  assert.ok(!isPertanyaan('bagaimana?'));
  const k = kelompokkan([
    'Kenapa daun cabe rawit saya keriting ya, obatnya apa?', 'Kenapa daun cabe rawit saya keriting ya, obatnya apa?',
    'Hama thrips di kebun saya banyak, bagaimana cara membasminya?', 'Ada thrips dan kutu, harus disemprot pakai apa ya?',
    'Berapa dosis pupuk NPK untuk cabe rawit umur 1 bulan?', 'Mantap videonya bang, sukses terus', 'Kapan waktu panen yang tepat untuk cabe rawit?',
  ]);
  assert.strictEqual(k.dipindai, 7);
  assert.strictEqual(k.pertanyaan, 5);
  assert.strictEqual(k.topik[0].topik, 'Hama');
  assert.strictEqual(k.topik[0].n, 2);
  assert.ok(k.topik.every((t) => t.contoh.length >= 1 && t.contoh.every((c) => c.length <= 140)));
  assert.deepStrictEqual(kelompokkan([]).topik, []);
});

test('deskripsi: judul, produk bertautan pelacak, pernyataan afiliasi, tagar tanpa duplikat', () => {
  const d = susunDeskripsi({ judul: 'Obat Hama Cabe Rawit', tautan: [{ label: 'fungisida cabai antraknosa', url: 'https://x.id/go/abc123' }, { label: 'perekat perata pestisida', url: 'https://x.id/go/def456' }] });
  assert.ok(d.startsWith('Obat Hama Cabe Rawit\n\nProduk di video ini:\n• fungisida cabai antraknosa: https://x.id/go/abc123'));
  assert.ok(d.includes(KALIMAT_AFILIASI));
  assert.ok(/#cabairawit #petanicabai #fungisida #perekat$/.test(d));
  const tanpa = susunDeskripsi({ judul: 'Tes', tautan: [] });
  assert.strictEqual(tanpa, 'Tes\n\n#cabairawit #petanicabai');
  assert.ok(!tanpa.includes('afiliasi'));
  assert.strictEqual(tagarProduk('untuk cabe rawit'), null);
});
