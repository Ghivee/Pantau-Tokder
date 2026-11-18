const test = require('node:test');
const assert = require('node:assert');
const { ringkas } = require('../src/integrations/reporting');
const { kelompokkan, isPertanyaan } = require('../src/services/komentarService');
const { susunDeskripsi, tagarProduk, KALIMAT_AFILIASI } = require('../src/utils/deskripsi');

test('laporan reach: CTR per hari ditimbang impresi, pecahan dikali 100, baris rusak dibuang', () => {
  const csv = ['date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr',
    '20261110,C,aaaaaaaaaaa,1000,0.04', '20261110,C,bbbbbbbbbbb,3000,0.06', '20261111,C,aaaaaaaaaaa,500,0.05', 'rusak,C,x,1,1'].join('\n');
  assert.deepStrictEqual(ringkas(csv), { '2026-11-10': { impresi: 4000, ctr: 5.5 }, '2026-11-11': { impresi: 500, ctr: 5 } });
  const persen = ['date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr', '20261110,C,a,1000,4', '20261110,C,b,3000,6'].join('\n');
  assert.deepStrictEqual(ringkas(persen), { '2026-11-10': { impresi: 4000, ctr: 5.5 } });
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
