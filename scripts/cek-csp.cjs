// After `vite build`: every inline <script> in dist/index.html must be allowed by its hash in
// vercel.json's Content-Security-Policy, because the policy no longer allows inline scripts.
// `node scripts/cek-csp.cjs --tulis` writes the current hashes into vercel.json.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).filter((js) => js.trim())
  .map((js) => `'sha256-${crypto.createHash('sha256').update(js).digest('base64')}'`);

const vercelPath = path.join(root, 'vercel.json');
const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
const header = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy');
const scriptSrc = `script-src 'self' ${[...new Set(hashes)].join(' ')}`;

if (process.argv.includes('--tulis')) {
  header.value = header.value.replace(/script-src [^;]*/, scriptSrc);
  fs.writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + '\n');
  console.log('vercel.json diperbarui:', hashes.length, 'hash');
} else {
  const kurang = hashes.filter((h) => !header.value.includes(h));
  if (kurang.length || /script-src[^;]*'unsafe-inline'/.test(header.value)) {
    console.error('CSP tidak cocok dengan dist/index.html. Jalankan: node scripts/cek-csp.cjs --tulis');
    process.exit(1);
  }
  console.log('CSP cocok:', hashes.length, 'skrip inline diizinkan lewat hash');
}
