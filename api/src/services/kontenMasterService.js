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
  if (!r.ok) { sesi = null; throw new Error('Login akun pantau di Master gagal (' + r.status + ')'); }
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
  if (r.status === 401) { sesi = null; throw new Error('Sesi Master ditolak'); }
  if (!r.ok) throw new Error('Tabel konten Master belum bisa dibaca (' + r.status + ')');
  const out = {};
  for (const k of await r.json()) if (k.youtube_id) out[k.youtube_id] = { judul: k.judul, channel: k.channel || null, petugas: k.petugas || null, status: k.status };
  cache = { at: Date.now(), daftar: out };
  return { terhubung: true, daftar: out };
}

const reset = () => { sesi = null; cache = null; };

module.exports = { daftar, siap, reset };
