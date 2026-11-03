const db = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');
const sosmed = require('../integrations/sosmed');

// TikTok, Instagram and Facebook connections and their posts. Read-only: the app only pulls
// profile and post statistics of accounts the owner connected. Removing a connection removes
// its posts too, as the privacy policy promises.

const HARI_SINKRON = 90;
const MARGIN = { tiktok: 10 * 60 * 1000, instagram: 7 * 86400000, facebook: 0 };

async function simpan(k) {
  await db.query(
    `INSERT INTO social_koneksi (platform, akun_id, pemilik_id, nama, handle, avatar, followers, access_token, refresh_token, expires_at, refresh_expires_at, scope, status, galat)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'aktif',NULL)
     ON CONFLICT (platform, akun_id) DO UPDATE SET pemilik_id = $3, nama = $4, handle = $5, avatar = $6, followers = COALESCE($7, social_koneksi.followers),
       access_token = $8, refresh_token = COALESCE($9, social_koneksi.refresh_token), expires_at = $10, refresh_expires_at = $11, scope = $12, status = 'aktif', galat = NULL`,
    [k.platform, k.akun_id, k.pemilik_id || null, k.nama || null, k.handle || null, k.avatar || null, k.followers ?? null,
      encrypt(k.access), k.refresh ? encrypt(k.refresh) : null, k.expires_at || null, k.refresh_expires_at || null, k.scope || null]
  );
}

const publik = `id, platform, akun_id, nama, handle, avatar, followers, status, galat, last_sync, created_at, expires_at, scope`;

async function daftar() {
  return (await db.query(`SELECT ${publik} FROM social_koneksi ORDER BY platform, nama`)).rows.map((k) => ({ ...k, bisa_posting: sosmed.POSTING_SCOPE.test(k.scope || '') }));
}

async function hapus(id) {
  const r = await db.query('SELECT platform, akun_id FROM social_koneksi WHERE id = $1', [id]);
  if (!r.rows[0]) return false;
  await db.query('DELETE FROM social_post WHERE platform = $1 AND akun_id = $2', [r.rows[0].platform, r.rows[0].akun_id]);
  await db.query('DELETE FROM social_koneksi WHERE id = $1', [id]);
  return true;
}

// Meta tells us (deauthorize / data deletion) that a person removed the app: delete everything of theirs.
async function hapusByPemilik(platforms, pemilikId) {
  const r = await db.query('SELECT id FROM social_koneksi WHERE platform = ANY($1) AND pemilik_id = $2', [platforms, String(pemilikId)]);
  for (const row of r.rows) await hapus(row.id);
  return r.rows.length;
}

const tokenMati = (e) => {
  const s = e.response && e.response.status;
  return s === 400 || s === 401 || s === 403;
};

// A usable access token, renewed first when it is about to expire. Throws when the connection must be redone.
async function tokenSegar(row) {
  const access = decrypt(row.access_token);
  const exp = row.expires_at ? new Date(row.expires_at).getTime() : null;
  if (exp == null || exp - Date.now() > (MARGIN[row.platform] || 0)) return access;
  let baru;
  if (row.platform === 'tiktok') {
    if (!row.refresh_token || (row.refresh_expires_at && new Date(row.refresh_expires_at) < new Date())) throw Object.assign(new Error('Izin TikTok kedaluwarsa, hubungkan ulang'), { putus: true });
    baru = await sosmed.tiktok.refresh(decrypt(row.refresh_token));
  } else if (row.platform === 'instagram') {
    if (exp < Date.now()) throw Object.assign(new Error('Izin Instagram kedaluwarsa, hubungkan ulang'), { putus: true });
    baru = await sosmed.instagram.refresh(access);
  } else {
    return access;
  }
  await db.query(
    `UPDATE social_koneksi SET access_token = $1, refresh_token = COALESCE($2, refresh_token), expires_at = $3, refresh_expires_at = COALESCE($4, refresh_expires_at) WHERE id = $5`,
    [encrypt(baru.access), baru.refresh ? encrypt(baru.refresh) : null, baru.expires_at, baru.refresh_expires_at, row.id]
  );
  return baru.access;
}

async function simpanPost(row, p, editorId) {
  await db.query(
    `INSERT INTO social_post (platform, akun_id, post_id, url, judul, tanggal, views, likes, comments, shares, durasi, editor_id, stats_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT (platform, post_id) DO UPDATE SET url = $4, judul = $5, views = COALESCE($7, social_post.views), likes = $8, comments = $9, shares = $10,
       durasi = $11, editor_id = COALESCE(social_post.editor_id, $12), stats_at = NOW()`,
    [row.platform, row.akun_id, p.post_id, p.url, p.judul, p.tanggal, p.views, p.likes, p.comments, p.shares, p.durasi, editorId || null]
  );
}

// Pull profile and recent posts for one connection. Never throws: the outcome is stored on the row.
async function sinkron(row, { editors = [], match = () => null } = {}) {
  try {
    const access = await tokenSegar(row);
    const sejak = new Date(Date.now() - HARI_SINKRON * 86400000);
    let profil, posts;
    if (row.platform === 'tiktok') { [profil, posts] = await Promise.all([sosmed.tiktok.profile(access), sosmed.tiktok.posts(access, sejak)]); }
    else if (row.platform === 'instagram') { [profil, posts] = await Promise.all([sosmed.instagram.profile(access), sosmed.instagram.posts(access, sejak)]); }
    else { [profil, posts] = await Promise.all([sosmed.facebook.profile(row.akun_id, access), sosmed.facebook.posts(row.akun_id, access, sejak)]); }
    for (const p of posts) await simpanPost(row, p, match(p.deskripsi, editors));
    await db.query(`UPDATE social_koneksi SET nama = COALESCE($1, nama), followers = COALESCE($2, followers), avatar = COALESCE($3, avatar), status = 'aktif', galat = NULL, last_sync = NOW() WHERE id = $4`,
      [profil.nama, profil.followers, profil.avatar, row.id]);
    return { id: row.id, platform: row.platform, posts: posts.length };
  } catch (e) {
    const pesan = (e.response && e.response.data && (e.response.data.error && (e.response.data.error.message || e.response.data.error.description) || e.response.data.message)) || e.message;
    await db.query(`UPDATE social_koneksi SET galat = $1, status = $2 WHERE id = $3`, [String(pesan).slice(0, 300), e.putus || (e.response && tokenMati(e)) ? 'putus' : 'aktif', row.id]).catch(() => {});
    return { id: row.id, platform: row.platform, galat: String(pesan).slice(0, 300) };
  }
}

async function sinkronSemua({ editors, match, deadline = Date.now() + 40000 } = {}) {
  const rows = (await db.query(`SELECT * FROM social_koneksi WHERE status <> 'putus' OR last_sync IS NULL OR last_sync < NOW() - INTERVAL '1 day' ORDER BY last_sync NULLS FIRST`)).rows;
  const out = { akun: 0, posts: 0, galat: [] };
  for (const row of rows) {
    if (Date.now() > deadline) { out.galat.push('Waktu habis: sisa akun diproses di sinkronisasi berikutnya'); break; }
    const r = await sinkron(row, { editors, match });
    out.akun++;
    if (r.galat) out.galat.push(`${sosmed.PLATFORMS[row.platform].nama} ${row.nama || row.akun_id}: ${r.galat}`);
    else out.posts += r.posts;
  }
  return out;
}

// What the Sosmed page shows: connections per platform and the last 90 days of posts.
async function ringkasan() {
  const [konek, posts, kiriman] = await Promise.all([
    daftar(),
    db.query(`SELECT p.id, p.platform, p.akun_id, p.post_id, p.url, p.judul, p.tanggal, p.views, p.likes, p.comments, p.shares, p.editor_id, k.nama AS akun_nama
              FROM social_post p LEFT JOIN social_koneksi k ON k.platform = p.platform AND k.akun_id = p.akun_id
              WHERE p.tanggal > NOW() - INTERVAL '90 days' ORDER BY p.tanggal DESC LIMIT 400`),
    // Cannot be required at the top: the posting service uses this one.
    require('./postingService').daftar().catch(() => []),
  ]);
  return {
    platforms: Object.entries(sosmed.PLATFORMS).map(([id, p]) => ({ id, nama: p.nama, siap: sosmed.configured(id), env: p.env, koneksi: konek.filter((k) => k.platform === id) })),
    posts: posts.rows,
    posting: kiriman,
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
  };
}

module.exports = { simpan, daftar, hapus, hapusByPemilik, sinkron, sinkronSemua, ringkasan, tokenSegar };
