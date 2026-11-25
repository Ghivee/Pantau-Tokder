// SSO dari Master: Master (Supabase Auth) memegang identitas. Browser membawa access token Supabase ke Pantau;
// Pantau memverifikasinya langsung ke Supabase (bukan percaya isi token), membaca peran dari tabel profiles,
// lalu membuat sesi Pantau sendiri. Token tidak disimpan.
const URL_ENV = () => String(process.env.MASTER_SUPABASE_URL || '').replace(/\/$/, '');
const KEY_ENV = () => process.env.MASTER_SUPABASE_ANON_KEY || '';

const aktif = () => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(URL_ENV()) && KEY_ENV().length > 20 && !KEY_ENV().includes('service_role');
const TOKEN_OK = /^[A-Za-z0-9._-]{20,4096}$/;

// URL app Master untuk tombol "Masuk dengan Master" (hanya https).
function masterUrl() {
  const u = String(process.env.MASTER_APP_URL || '').trim().replace(/\/$/, '');
  try { const p = new URL(u); return p.protocol === 'https:' ? p.origin : ''; } catch (e) { return ''; }
}

// Alamat https dari variabel lingkungan (hanya origin), atau '' bila kosong atau bukan https.
function urlDariEnv(nama) {
  const u = String(process.env[nama] || '').trim();
  try { const p = new URL(u); return p.protocol === 'https:' ? p.origin : ''; } catch (e) { return ''; }
}

// Memverifikasi token ke Supabase. Mengembalikan { id, email, role, staff, name } atau melempar galat berstatus.
async function verifikasi(token) {
  if (!aktif()) throw Object.assign(new Error('Masuk dengan Master belum diatur'), { status: 503 });
  if (!TOKEN_OK.test(String(token || ''))) throw Object.assign(new Error('Token tidak valid'), { status: 400 });
  const h = { apikey: KEY_ENV(), Authorization: 'Bearer ' + token };
  const u = await fetch(URL_ENV() + '/auth/v1/user', { headers: h });
  if (u.status === 401 || u.status === 403) throw Object.assign(new Error('Sesi Master tidak berlaku. Masuk ulang di Master.'), { status: 401 });
  if (!u.ok) throw Object.assign(new Error('Master belum bisa dihubungi'), { status: 502 });
  const user = await u.json();
  if (!user || !user.id || !/@master\.app$/i.test(String(user.email || ''))) throw Object.assign(new Error('Akun ini bukan akun Master'), { status: 403 });
  const p = await fetch(URL_ENV() + '/rest/v1/profiles?select=role,staff,name&limit=1', { headers: h });
  if (!p.ok) throw Object.assign(new Error('Peran akun belum bisa dibaca dari Master'), { status: 502 });
  const row = (await p.json())[0];
  if (!row) throw Object.assign(new Error('Akun ini belum diberi peran di Master'), { status: 403 });
  return { id: user.id, email: user.email, role: row.role, staff: row.staff || null, name: row.name || '' };
}

const norm = (s) => String(s || '').trim().toLowerCase();

// Murni: peran Master -> sesi Pantau. admin -> pemilik; staff -> karyawan Pantau yang namanya sama (aktif).
// editors: [{ id, nama, status }]. Peran lain (reader) ditolak.
function petakan(profil, editors) {
  if (profil.role === 'admin') return { tipe: 'admin' };
  if (profil.role === 'staff') {
    const cari = [norm(profil.name), norm(profil.staff)].filter(Boolean);
    const e = editors.find((x) => x.status === 'aktif' && cari.includes(norm(x.nama)));
    if (e) return { tipe: 'karyawan', editorId: e.id, nama: e.nama };
    return { galat: 'Akun Master ini belum punya karyawan dengan nama yang sama di Pantau. Minta pemilik menambahkannya di menu Karyawan.', status: 403 };
  }
  return { galat: 'Peran akun ini tidak boleh masuk Pantau', status: 403 };
}

module.exports = { aktif, masterUrl, urlDariEnv, verifikasi, petakan };
