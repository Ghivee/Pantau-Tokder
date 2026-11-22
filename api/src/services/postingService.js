const db = require('../config/db');
const { sign } = require('../utils/encryption');
const { bad } = require('../utils/httpError');
const social = require('./socialService');
const analyticsService = require('./analyticsService');
const { getChannelNames } = require('./channelService');
const sosmed = require('../integrations/sosmed');
const api = require('../integrations/posting');

// One upload to many platforms. Status of a target:
//   diproses  the platform is still fetching/processing the video
//   siap      Instagram/Facebook: ready, waiting for "Tayangkan"
//   tayang    public
//   di-app    TikTok draft in the app / YouTube private upload: the owner finishes it there
//   menunggu  YouTube: waiting for the GitHub Actions job (runs every hour)
//   mengunggah YouTube: the job has taken it
//   gagal     see galat

const mediaUrl = (base, id) => `${base}/api/posting/media/${id}/${sign(id)}`;
const teks = (p) => [p.judul, p.deskripsi].filter(Boolean).join('\n\n');

async function koneksi(id) {
  const r = await db.query('SELECT * FROM social_koneksi WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function setTarget(id, f) {
  await db.query(`UPDATE posting_target SET status = $2, ref_id = COALESCE($3, ref_id), hasil_url = COALESCE($4, hasil_url), galat = $5, updated_at = NOW() WHERE id = $1`,
    [id, f.status, f.ref || null, f.url || null, f.galat || null]);
}

async function kirim(posting, row, base) {
  const token = await social.tokenSegar(row);
  if (row.platform === 'tiktok') return api.tiktokDraf(token, mediaUrl(base, posting.id));
  if (row.platform === 'instagram') return api.instagramSiapkan(token, posting.blob_url, teks(posting));
  return api.facebookSiapkan(row.akun_id, token, posting.blob_url, posting.judul, posting.deskripsi);
}

async function buat({ judul, deskripsi, blob_url, ukuran, mime, sosmedIds = [], youtubeIds = [] }, base) {
  judul = String(judul || '').trim();
  if (!judul) throw bad(400, 'Judul wajib diisi');
  if (judul.length > 100) throw bad(400, 'Judul maksimal 100 huruf');
  if (!/^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(String(blob_url || ''))) throw bad(400, 'Video belum terunggah');
  if (!sosmedIds.length && !youtubeIds.length) throw bad(400, 'Pilih minimal satu akun tujuan');
  const p = (await db.query(`INSERT INTO posting (judul, deskripsi, blob_url, ukuran, mime) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [judul, String(deskripsi || '').slice(0, 4000), blob_url, Number(ukuran) || null, String(mime || '').slice(0, 60)])).rows[0];
  for (const id of sosmedIds) {
    const row = await koneksi(id);
    if (!row) continue;
    const t = (await db.query(`INSERT INTO posting_target (posting_id, platform, akun_id, akun_nama) VALUES ($1,$2,$3,$4) RETURNING id`, [p.id, row.platform, row.akun_id, row.nama])).rows[0];
    try {
      if (!sosmed.POSTING_SCOPE.test(row.scope || '')) throw new Error('Akun ini belum memberi izin posting. Putuskan lalu hubungkan ulang di menu Sosmed.');
      await setTarget(t.id, { status: 'diproses', ...(await kirim(p, row, base)) });
    } catch (e) {
      await setTarget(t.id, { status: 'gagal', galat: e.message });
    }
  }
  const names = youtubeIds.length ? await getChannelNames() : {};
  for (const ch of youtubeIds) {
    await db.query(`INSERT INTO posting_target (posting_id, platform, akun_id, akun_nama, status) VALUES ($1,'youtube',$2,$3,'menunggu')`, [p.id, ch, names[ch] || ch]);
  }
  return one(p.id);
}

const SELECT = `SELECT p.id, p.judul, p.deskripsi, p.created_at, p.ukuran, (p.blob_url IS NOT NULL) AS punya_file,
  COALESCE(json_agg(json_build_object('id', t.id, 'platform', t.platform, 'akun_nama', t.akun_nama, 'status', t.status, 'hasil_url', t.hasil_url, 'galat', t.galat) ORDER BY t.id) FILTER (WHERE t.id IS NOT NULL), '[]') AS targets
  FROM posting p LEFT JOIN posting_target t ON t.posting_id = p.id`;

async function daftar() {
  return (await db.query(`${SELECT} GROUP BY p.id ORDER BY p.id DESC LIMIT 20`)).rows;
}
async function one(id) {
  const r = (await db.query(`${SELECT} WHERE p.id = $1 GROUP BY p.id`, [id])).rows[0];
  if (!r) throw bad(404, 'Posting tidak ditemukan');
  return r;
}

async function targetRows(postingId, statuses) {
  return (await db.query(`SELECT t.*, p.blob_url FROM posting_target t JOIN posting p ON p.id = t.posting_id WHERE t.posting_id = $1 AND t.status = ANY($2) ORDER BY t.id`, [postingId, statuses])).rows;
}
async function rowFor(t) {
  const r = await db.query('SELECT * FROM social_koneksi WHERE platform = $1 AND akun_id = $2', [t.platform, t.akun_id]);
  return r.rows[0] || null;
}

// Ask each platform how its copy is doing.
async function segarkan(id) {
  for (const t of await targetRows(id, ['diproses'])) {
    try {
      const row = await rowFor(t);
      if (!row) throw new Error('Akun sudah diputuskan');
      const token = await social.tokenSegar(row);
      const s = t.platform === 'tiktok' ? await api.tiktokStatus(token, t.ref_id)
        : t.platform === 'instagram' ? await api.instagramStatus(token, t.ref_id)
        : await api.facebookStatus(token, t.ref_id);
      await setTarget(t.id, s);
    } catch (e) { await setTarget(t.id, { status: 'gagal', galat: e.message }); }
  }
  return one(id);
}

// Publish everything that is ready (Instagram and Facebook). TikTok and YouTube are finished by the owner in their apps.
async function tayangkan(id) {
  for (const t of await targetRows(id, ['siap'])) {
    try {
      const row = await rowFor(t);
      if (!row) throw new Error('Akun sudah diputuskan');
      const token = await social.tokenSegar(row);
      if (t.platform === 'instagram') { const r = await api.instagramTayang(token, t.ref_id); await setTarget(t.id, { status: 'tayang', url: r.url }); }
      else if (t.platform === 'facebook') await setTarget(t.id, await api.facebookTayang(token, t.ref_id));
    } catch (e) { await setTarget(t.id, { status: 'gagal', galat: e.message }); }
  }
  return one(id);
}

async function hapusBlob(url) {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try { await require('@vercel/blob').del(url); } catch (e) { console.warn('Hapus berkas video gagal:', e.message); }
}

async function hapus(id) {
  const r = await db.query('DELETE FROM posting WHERE id = $1 RETURNING blob_url', [id]);
  if (!r.rows[0]) throw bad(404, 'Posting tidak ditemukan');
  await hapusBlob(r.rows[0].blob_url);
}

// Video files are only needed until every platform has taken them; remove them after a week.
async function rawat() {
  const old = (await db.query(`SELECT p.id, p.blob_url FROM posting p WHERE p.blob_url IS NOT NULL AND p.created_at < NOW() - INTERVAL '7 days'
    AND NOT EXISTS (SELECT 1 FROM posting_target t WHERE t.posting_id = p.id AND t.status IN ('menunggu','mengunggah','diproses')) LIMIT 20`)).rows;
  for (const p of old) { await hapusBlob(p.blob_url); await db.query('UPDATE posting SET blob_url = NULL WHERE id = $1', [p.id]); }
  await db.query(`DELETE FROM posting WHERE created_at < NOW() - INTERVAL '90 days'`);
  return old.length;
}

// ---------- YouTube (done by the GitHub Actions job) ----------
async function antreanYoutube() {
  const rows = (await db.query(`SELECT t.id, t.akun_id, p.judul, p.deskripsi, p.blob_url, p.ukuran, p.mime FROM posting_target t JOIN posting p ON p.id = t.posting_id
    WHERE t.platform = 'youtube' AND p.blob_url IS NOT NULL AND (t.status = 'menunggu' OR (t.status = 'mengunggah' AND t.updated_at < NOW() - INTERVAL '2 hours')) ORDER BY t.id LIMIT 3`)).rows;
  const out = [];
  for (const r of rows) {
    try {
      const token = await analyticsService.accessTokenFor(r.akun_id);
      if (!token) throw new Error('Channel belum tersambung di Pengaturan');
      await db.query(`UPDATE posting_target SET status = 'mengunggah', updated_at = NOW() WHERE id = $1`, [r.id]);
      out.push({ target_id: r.id, judul: r.judul, deskripsi: r.deskripsi, media_url: r.blob_url, ukuran: Number(r.ukuran) || null, mime: r.mime || 'video/mp4', access_token: token });
    } catch (e) { await setTarget(r.id, { status: 'gagal', galat: e.message }); }
  }
  return out;
}

async function hasilYoutube(targetId, { video_id, galat }) {
  if (video_id && /^[\w-]{6,20}$/.test(String(video_id))) return setTarget(targetId, { status: 'di-app', ref: video_id, url: `https://studio.youtube.com/video/${video_id}/edit` });
  return setTarget(targetId, { status: 'gagal', galat: String(galat || 'Unggah gagal').slice(0, 300) });
}

module.exports = { buat, daftar, one, segarkan, tayangkan, hapus, rawat, antreanYoutube, hasilYoutube, mediaUrl };
