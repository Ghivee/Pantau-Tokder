// Membaca tabel konten di Master (Supabase) dengan akun baca-saja 'pantau'. Dipakai untuk mencocokkan
// video YouTube dengan konten di Master (siapa yang memegang, judul kerja). Tanpa env, fitur mati tanpa galat.
const URL_ENV = () => String(process.env.MASTER_SUPABASE_URL || '').replace(/\/$/, '');
const KEY_ENV = () => process.env.MASTER_SUPABASE_ANON_KEY || '';
const PASS_ENV = () => process.env.MASTER_PANTAU_PASSWORD || '';
const CACHE_MS = 10 * 60 * 1000;

let sesi = null; // { token, exp }
let cache = null; // { at, daftar }

const siap = () => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(URL_ENV()) && KEY_ENV().length > 20 && !KEY_ENV().includes('service_role') && !!PASS_ENV();

async function masuk() {
  if (sesi && sesi.exp - Date.now() > 60000) return sesi.token;
  const r = await fetch(URL_ENV() + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY_ENV() },
    body: JSON.stringify({ email: 'pantau@master.app', password: PASS_ENV() }),
  });
  if (!r.ok) { sesi = null; throw new Error('Login akun pantau di Office gagal (' + r.status + ')'); }
  const j = await r.json();
  sesi = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return sesi.token;
}

// Hasil: { terhubung, daftar: { <youtube_id>: { judul, channel, petugas, status } } }
async function daftar() {
  if (!siap()) return { terhubung: false, daftar: {} };
  if (cache && Date.now() - cache.at < CACHE_MS) return { terhubung: true, daftar: cache.daftar };
  const token = await masuk();
  const r = await fetch(URL_ENV() + '/rest/v1/konten?select=judul,channel,petugas,status,youtube_id&youtube_id=not.is.null&limit=2000', {
    headers: { apikey: KEY_ENV(), Authorization: 'Bearer ' + token },
  });
  if (r.status === 401) { sesi = null; throw new Error('Sesi Office ditolak'); }
  if (!r.ok) throw new Error('Tabel konten Office belum bisa dibaca (' + r.status + ')');
  const out = {};
  for (const k of await r.json()) if (k.youtube_id) out[k.youtube_id] = { judul: k.judul, channel: k.channel || null, petugas: k.petugas || null, status: k.status };
  cache = { at: Date.now(), daftar: out };
  return { terhubung: true, daftar: out };
}

// Panggilan REST umum ke Master dengan akun yang sama. Mengembalikan { status, json }.
async function rest(method, path, body, prefer = 'return=minimal') {
  if (!siap()) throw new Error('Sambungan Office belum diatur');
  const panggil = async () => fetch(URL_ENV() + '/rest/v1/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: KEY_ENV(), Authorization: 'Bearer ' + (await masuk()), ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let r = await panggil();
  if (r.status === 401) { sesi = null; r = await panggil(); }
  let json = null;
  try { json = await r.json(); } catch (e) { /* jawaban kosong */ }
  return { status: r.status, json };
}

const reset = () => { sesi = null; cache = null; };

module.exports = { daftar, siap, rest, reset };
