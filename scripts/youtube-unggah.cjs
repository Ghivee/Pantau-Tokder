// Dijalankan oleh GitHub Actions (.github/workflows/posting-youtube.yml), bukan oleh Vercel:
// mengambil antrean unggahan YouTube dari Pantau Tokder, memindahkan videonya dari Vercel Blob ke
// YouTube (resumable upload, status privat), lalu melapor balik. Butuh CRON_SECRET yang sama dengan di Vercel.
const BASE = (process.env.APP_URL || 'https://tokder.vercel.app').replace(/\/+$/, '');
const SECRET = process.env.CRON_SECRET;
const auth = { Authorization: `Bearer ${SECRET}` };

async function lapor(id, body) {
  const r = await fetch(`${BASE}/api/posting/yt/${id}/hasil`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) console.error('Gagal melapor', id, r.status);
}

async function unggah(it) {
  const media = await fetch(it.media_url);
  if (!media.ok || !media.body) throw new Error(`Video tidak bisa diambil (${media.status})`);
  const ukuran = Number(media.headers.get('content-length')) || it.ukuran;
  if (!ukuran) throw new Error('Ukuran video tidak diketahui');
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${it.access_token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(ukuran), 'X-Upload-Content-Type': it.mime || 'video/mp4' },
    body: JSON.stringify({
      snippet: { title: String(it.judul).slice(0, 100), description: String(it.deskripsi || '').slice(0, 5000), categoryId: '22' },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
    }),
  });
  if (!init.ok) {
    const t = await init.text();
    throw new Error(init.status === 403 ? 'Channel belum memberi izin unggah. Hubungkan ulang channel di Pengaturan.' : `YouTube menolak (${init.status}) ${t.slice(0, 160)}`);
  }
  const lokasi = init.headers.get('location');
  if (!lokasi) throw new Error('YouTube tidak memberi alamat unggah');
  const put = await fetch(lokasi, { method: 'PUT', headers: { 'Content-Type': it.mime || 'video/mp4', 'Content-Length': String(ukuran) }, body: media.body, duplex: 'half' });
  if (!put.ok) throw new Error(`Unggah ke YouTube gagal (${put.status})`);
  const j = await put.json();
  if (!j.id) throw new Error('YouTube tidak mengirim ID video');
  return j.id;
}

(async () => {
  if (!SECRET) { console.log('CRON_SECRET belum diatur di GitHub (Settings > Secrets), dilewati.'); return; }
  const r = await fetch(`${BASE}/api/posting/yt/antrean`, { headers: auth });
  if (!r.ok) { console.error('Antrean gagal dibaca:', r.status); process.exit(1); }
  const antrean = await r.json();
  console.log(`${antrean.length} unggahan YouTube menunggu.`);
  for (const it of antrean) {
    try {
      const id = await unggah(it);
      await lapor(it.target_id, { video_id: id });
      console.log('Terunggah (privat):', id);
    } catch (e) {
      console.error('Gagal:', e.message);
      await lapor(it.target_id, { galat: e.message });
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
