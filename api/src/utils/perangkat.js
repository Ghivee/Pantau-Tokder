// Mengurai perangkat, jaringan, dan lokasi perkiraan dari satu permintaan. Murni (tanpa database), supaya mudah diuji.
// Yang dikumpulkan hanya yang dikirim browser sendiri atau yang ditambahkan oleh Vercel (negara, kota, koordinat kota).
// Tidak ada pencarian IP ke layanan luar: alamat IP karyawan tidak dikirim ke pihak ketiga.
const crypto = require('crypto');

const OTOMATIS = /curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx|node-fetch|undici|axios\/|go-http-client|okhttp\/(?!.*Mobile)|java\/|libwww|postman|insomnia|HeadlessChrome|PhantomJS|puppeteer|playwright|selenium|scrapy|bot\b|crawler|spider/i;

// Urutan penting: Edge dan Opera juga memuat kata "Chrome"; Chrome juga memuat kata "Safari".
const PERAMBAN = [
  [/EdgA?\/(\d+)/, 'Edge'], [/OPR\/(\d+)/, 'Opera'], [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
  [/(?:Instagram|FBAN|FBAV)[ /]?(\d+)?/, 'Aplikasi Instagram/Facebook'], [/(?:musical_ly|TikTok|Bytedance)/i, 'Aplikasi TikTok'],
  [/Firefox\/(\d+)/, 'Firefox'], [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'], [/Version\/(\d+)[^]*Safari\//, 'Safari'],
];

function uraiOS(ua) {
  let m;
  if ((m = /Android (\d+(?:\.\d+)?)/.exec(ua))) return 'Android ' + m[1];
  if (/iPad/.test(ua)) { m = /OS (\d+)[_.]/.exec(ua); return 'iPadOS' + (m ? ' ' + m[1] : ''); }
  if (/iPhone|iPod/.test(ua)) { m = /OS (\d+)[_.]/.exec(ua); return 'iOS' + (m ? ' ' + m[1] : ''); }
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux|X11/.test(ua)) return 'Linux';
  return 'Tidak dikenal';
}

// Hasil: { browser, versi, os, perangkat: 'mobile'|'tablet'|'desktop'|'otomatis'|'kosong', model, otomatis }
function uraiUA(uaMentah) {
  const ua = String(uaMentah || '').slice(0, 600);
  if (!ua.trim() || ua === 'unknown') return { browser: 'Tidak ada', versi: '', os: 'Tidak dikenal', perangkat: 'kosong', model: '', otomatis: true };
  const otomatis = OTOMATIS.test(ua);
  let browser = 'Tidak dikenal', versi = '';
  for (const [re, nama] of PERAMBAN) { const m = re.exec(ua); if (m) { browser = nama; versi = m[1] || ''; break; } }
  if (otomatis) { const m = /(curl|wget|python-requests|python-urllib|aiohttp|httpx|node-fetch|undici|axios|go-http-client|okhttp|java|postman|insomnia|HeadlessChrome|puppeteer|playwright|selenium|scrapy)/i.exec(ua); if (m) browser = m[1]; }
  const model = (/Android [\d.]+; ([^;)]+)/.exec(ua) || [])[1] || '';
  let perangkat = 'desktop';
  if (otomatis) perangkat = 'otomatis';
  else if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) perangkat = 'tablet';
  else if (/Mobile|iPhone|iPod|Android/.test(ua)) perangkat = 'mobile';
  return { browser, versi, os: uraiOS(ua), perangkat, model: model.trim().slice(0, 40), otomatis };
}

// Sidik perangkat: pengenal kasar yang stabil antar pembaruan browser (versi tidak ikut), BUKAN identitas unik.
// Bahasa browser sengaja tidak ikut: sisi Master tidak melihatnya, dan perangkat yang sama harus dikenali di kedua sumber.
function sidik(ringkas) {
  return crypto.createHash('sha256').update([ringkas.browser, ringkas.os, ringkas.perangkat, ringkas.model].join('|')).digest('hex').slice(0, 12);
}

// Prefiks jaringan: /24 untuk IPv4, /48 untuk IPv6. Dipakai untuk mengenali "jaringan yang sama" walau IP berganti sedikit.
function prefixJaringan(ip) {
  const s = String(ip || '').trim();
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(s);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (s.includes(':')) {
    const [kiri, kanan = ''] = s.split('::');
    const a = kiri ? kiri.split(':') : [], b = kanan ? kanan.split(':') : [];
    const penuh = s.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
    if (penuh.length === 8 && penuh.every((x) => /^[0-9a-f]{1,4}$/i.test(x))) return penuh.slice(0, 3).map((x) => x.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/48';
  }
  return 'tidak diketahui';
}

// Lokasi perkiraan dari header Vercel (hanya dipercaya di Vercel; di tempat lain bisa dipalsukan).
function geoDariHeader(headers) {
  if (!process.env.VERCEL) return { negara: null, wilayah: null, kota: null, zona: null, lintang: null, bujur: null };
  const h = (k) => { const v = headers[k]; return Array.isArray(v) ? v[0] : v; };
  const dec = (v) => { try { return v ? decodeURIComponent(v) : null; } catch (e) { return v || null; } };
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  return {
    negara: (h('x-vercel-ip-country') || '').toUpperCase().slice(0, 2) || null,
    wilayah: dec(h('x-vercel-ip-country-region')),
    kota: dec(h('x-vercel-ip-city')),
    zona: dec(h('x-vercel-ip-timezone')),
    lintang: num(h('x-vercel-ip-latitude')),
    bujur: num(h('x-vercel-ip-longitude')),
  };
}

// Jarak garis lurus (km) antara dua koordinat (haversine).
function jarakKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((x) => typeof x !== 'number' || !Number.isFinite(x))) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Rute yang aman disimpan: tanpa query, angka dan token diganti penanda supaya tidak membocorkan data.
function normalisasiRute(url) {
  const path = String(url || '').split('?')[0].split('#')[0];
  return path.replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, '/:token').slice(0, 160);
}

// Semua keterangan permintaan dalam satu objek siap simpan.
function infoPermintaan(req, ip) {
  const ua = String(req.headers['user-agent'] || '').slice(0, 600);
  const bahasa = String(req.headers['accept-language'] || '').slice(0, 60);
  const r = uraiUA(ua);
  return {
    ip: ip || 'unknown', jaringan: prefixJaringan(ip), ua, bahasa,
    browser: (r.browser + (r.versi ? ' ' + r.versi : '')).slice(0, 60), os: r.os, perangkat: r.perangkat, model: r.model, otomatis: r.otomatis,
    sidik: sidik(r), ...geoDariHeader(req.headers),
  };
}

module.exports = { uraiUA, sidik, prefixJaringan, geoDariHeader, jarakKm, normalisasiRute, infoPermintaan, OTOMATIS };
