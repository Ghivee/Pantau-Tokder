// Data contoh: dipakai saat server/database belum tersambung atau saat alamat diakhiri ?demo.
// Semua angka di sini buatan, bukan data channel asli.
window.PantauDemo = (function () {
  const WIB = 7 * 3600 * 1000;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const day = (n) => new Date(Date.now() + WIB - n * 86400000).toISOString().slice(0, 10);
  const iso = (d, hm) => new Date(Date.parse(d + 'T' + hm + ':00Z') - WIB).toISOString();
  const addMin = (hm, m) => { const t = (+hm.slice(0, 2)) * 60 + (+hm.slice(3)) + m; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };

  const channels = [
    { id: 'UCdemoTokder000000000001', nama: 'Tokder', base: 1900 },
    { id: 'UCdemoBudidaya0000000002', nama: 'Budidaya Cabe', base: 2700 },
    { id: 'UCdemoHarga0000000000003', nama: 'Harga Cabe Hari Ini', base: 3400 },
  ];
  const JUDUL = {
    Tokder: [
      ['Pupuk daun terbaik fase generatif cabai', 1.4], ['Takaran NPK 16-16-16 untuk cabai', 1.3], ['Kalsium boron biar bunga cabai tidak rontok', 1.35],
      ['Insektisida ampuh untuk thrips cabai', 1.0], ['Fungisida untuk patek antraknosa', 1.05], ['Cara oplos pestisida yang aman', 0.9],
      ['Mulsa perak atau hitam, mana yang cocok?', 0.7], ['Ajir bambu vs ajir kayu', 0.65],
    ],
    'Budidaya Cabe': [
      ['Daun cabai keriting, ini penyebabnya', 1.5], ['Atasi layu fusarium sejak dini', 1.45], ['Kutu kebul: kenali dan basmi', 1.35],
      ['Pupuk dasar sebelum tanam cabai', 1.0], ['Kocor cabai umur 30 HST', 1.05], ['Cara semai cabai anti gagal', 0.85],
      ['Media semai murah dan subur', 0.8], ['Panen cabai pertama, hasil berapa kg?', 0.6],
    ],
    'Harga Cabe Hari Ini': [
      ['Harga cabai rawit hari ini', 1.25], ['Update harga cabai merah pagi ini', 1.2], ['Harga cabai di Jawa Timur hari ini', 1.1],
      ['Harga cabai pasar induk Kramat Jati', 1.05], ['Kenapa harga cabai naik minggu ini?', 0.6], ['Prediksi harga cabai akhir bulan', 0.55],
    ],
  };
  const editors = [
    { id: 1, nama: 'Alivia', kode_identifikasi: 'AL', status: 'aktif', peran: 'editor', jadwal: '06:00,07:00,12:00', target_harian: 3, foto_url: null, punya_pin: true },
    { id: 2, nama: 'Deni', kode_identifikasi: 'DE', status: 'aktif', peran: 'terbatas', jadwal: '13:00,16:00,19:00', target_harian: 3, foto_url: null, punya_pin: true },
  ];
  const slotChannel = { '06:00': 2, '07:00': 0, '12:00': 1, '13:00': 2, '16:00': 0, '19:00': 1 };

  function build() {
    seed = 7;
    const content = [];
    const aktivitas = [];
    let cid = 1, aid = 1;
    for (let n = 29; n >= 0; n--) {
      const d = day(n);
      for (const e of editors) {
        const lazy = e.id === 2 ? 0.16 : 0.05;
        const lateP = e.id === 2 ? 0.3 : 0.08;
        for (const slot of e.jadwal.split(',')) {
          if (rnd() < lazy) continue;
          const ch = channels[slotChannel[slot]];
          const [judul, mult] = pick(JUDUL[ch.nama]);
          const late = rnd() < lateP;
          const jam = addMin(slot, late ? 20 + Math.floor(rnd() * 110) : Math.floor(rnd() * 14) - 6);
          if (n === 0 && jam > new Date(Date.now() + WIB).toISOString().slice(11, 16)) continue;
          const age = Math.min(1, (n + 0.3) / 4);
          const views = Math.round(ch.base * mult * age * (0.6 + rnd() * 0.8) * (late ? 0.9 : 1));
          const unmatched = rnd() < 0.08;
          const short = rnd() < 0.8;
          const id = 'demo' + String(cid).padStart(7, '0');
          const dur = short ? 30 + Math.floor(rnd() * 70) : 240 + Math.floor(rnd() * 600);
          let r = 100;
          const ret = [];
          for (let p = 0; p <= 100; p += 5) { ret.push({ percent_duration: p, retention: Math.round(r * 10) / 10 }); r = Math.max(8, r - (p < 20 ? 4 + rnd() * 5 : 0.6 + rnd() * 1.6)); }
          content.push({
            id: cid++, post_id: id, platform: 'youtube', url: 'https://www.youtube.com/' + (short ? 'shorts/' : 'watch?v=') + id,
            judul: judul + (ch.nama === 'Harga Cabe Hari Ini' ? ' ' + d.slice(8) + '/' + d.slice(5, 7) : ''),
            tanggal_upload: iso(d, jam), editor_id: unmatched ? null : e.id, status_identifikasi: unmatched ? 'unmatched' : 'matched',
            tipe_video: short ? 'short' : 'long', duration_secs: dur, avg_view_duration: null, retention_data: ret,
            views, likes: Math.round(views * (0.03 + rnd() * 0.03)), comments: Math.round(views * (0.004 + rnd() * 0.01)),
            revenue: Math.round(views * (short ? 0.00004 : 0.0009) * 100) / 100,
            channel_id: ch.id, channel_nama: ch.nama, _slot: slot,
          });
          if (rnd() > lazy) aktivitas.push({ id: aid++, editor_id: e.id, tanggal: d, jam: addMin(slot, -60 - Math.floor(rnd() * 30)), tugas: 'Buat thumbnail', detail: ch.nama + ': ' + judul, jumlah: 1, channel_id: ch.id });
          if (rnd() > lazy * 1.5) aktivitas.push({ id: aid++, editor_id: e.id, tanggal: d, jam: addMin(slot, -25 - Math.floor(rnd() * 15)), tugas: 'Cek SEO & tag', detail: ch.nama + ': judul, deskripsi, tag', jumlah: 1, channel_id: ch.id });
        }
        if (rnd() > lazy * 1.4) aktivitas.push({ id: aid++, editor_id: e.id, tanggal: d, jam: addMin('05:15', Math.floor(rnd() * 30)), tugas: 'Riset harga cabai', detail: 'Cek harga rawit, merah dan keriting di pasar induk', jumlah: 1, channel_id: channels[2].id });
        for (const hm of ['10:30', '20:30']) {
          if (n === 0 && hm === '20:30') continue;
          if (rnd() > lazy) aktivitas.push({ id: aid++, editor_id: e.id, tanggal: d, jam: addMin(hm, Math.floor(rnd() * 40) - 15), tugas: 'Balas komentar', detail: 'Komentar di 3 channel', jumlah: 8 + Math.floor(rnd() * 14), channel_id: null });
        }
      }
    }
    aktivitas.sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));
    return {
      editors: editors.map((e) => ({ ...e })),
      content,
      aktivitas,
      channels: channels.map((c) => ({ id: c.id, nama: c.nama, jumlah_video: content.filter((x) => x.channel_id === c.id).length })),
      goal: { bulan: day(0).slice(0, 7), target_omset: 15000000, tercapai: 9350000 },
      scan: { youtube_api_key: true, youtube_channels: 3, database_url: true, google_oauth_client: true, last_scan: { created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), jumlah_post_baru: 4, jumlah_unmatched: 1 } },
      oauth: { connected: true },
    };
  }

  // Mutations stay in the browser tab while in demo mode.
  let nextId = 100000;
  async function handle(S, path, opts) {
    const m = (opts.method || 'GET').toUpperCase();
    const b = opts.body || {};
    await new Promise((r) => setTimeout(r, 150));
    if (path === '/api/auth/login') { if (b.password === 'demo') return { success: true }; throw new Error('Di mode demo, password pemilik adalah: demo'); }
    if (path === '/api/auth/editor-login') { const e = S.editors.find((x) => x.id === +b.editor_id); if (e && b.pin === '1234') return { id: e.id, nama: e.nama, peran: e.peran, foto_url: e.foto_url }; throw new Error('Di mode demo, PIN semua karyawan adalah: 1234'); }
    if (path === '/api/auth/password') return { success: true };
    if (path === '/api/aktivitas' && m === 'POST') { const row = { id: nextId++, ...b, editor_id: +b.editor_id, jumlah: +b.jumlah || 1 }; S.aktivitas.push(row); return row; }
    if (path.startsWith('/api/aktivitas/') && m === 'DELETE') { S.aktivitas = S.aktivitas.filter((a) => a.id !== +path.split('/').pop()); return null; }
    if (/^\/api\/content\/\d+\/assign$/.test(path)) { const c = S.content.find((x) => x.id === +path.split('/')[3]); if (c) { c.editor_id = +b.editor_id; c.status_identifikasi = 'matched'; } return { message: 'Success' }; }
    if (path === '/api/editors' && m === 'POST') { const e = { id: nextId++, status: 'aktif', ...b, kode_identifikasi: b.kode, target_harian: +b.target_harian || 3, punya_pin: !!b.pin }; S.editors.push(e); return e; }
    if (path.startsWith('/api/editors/')) {
      const id = +path.split('/').pop();
      if (m === 'DELETE') { S.editors = S.editors.filter((e) => e.id !== id); S.content.forEach((c) => { if (c.editor_id === id) { c.editor_id = null; c.status_identifikasi = 'unmatched'; } }); return null; }
      const e = S.editors.find((x) => x.id === id);
      Object.assign(e, b, { kode_identifikasi: b.kode, target_harian: +b.target_harian || 3, punya_pin: b.hapus_pin ? false : (e.punya_pin || !!b.pin) });
      return e;
    }
    if (path === '/api/goals' && m === 'PUT') { S.goal = { ...S.goal, ...b }; return S.goal; }
    if (path === '/api/scan' && m === 'POST') { await new Promise((r) => setTimeout(r, 600)); return { message: 'Scan completed', newPosts: 0, updatedPosts: S.content.length, unmatched: 0 }; }
    throw new Error('Tidak tersedia di mode demo');
  }

  return { build, handle };
})();
