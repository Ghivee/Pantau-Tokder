import { agoText, analyticsChannels, api, normalize } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { nf } from '../lib/format.js';
import { notifCard } from './shared.js';
import { toast } from '../ui/bits.js';
import { icon } from '../ui/icons.js';
import { render } from '../ui/layout.js';

PAGES.pengaturan = function () {
    const sc = S.scan || {};
    const last = sc.last_scan;
    const item = (ok, title, desc, action = '') => `<div class="ck"><span class="st ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!'}</span><div><b>${title}</b><div>${desc}</div></div>${action}</div>`;
    return `
        <header class="head"><div><h1>Pengaturan</h1><p>Sambungan data, sinkronisasi video dan keamanan.</p></div>
          <div class="tools"><button class="btn primary" data-act="sync">${icon('sync')}Sinkronkan sekarang</button></div></header>
        ${notifCard()}
        <div class="grid-2">
          <section class="card"><div class="card-h"><h2>Sambungan</h2><p>${last ? 'Sinkronisasi terakhir ' + new Date(last.waktu_scan || last.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + (last.jumlah_post_baru ?? 0) + ' video baru' : 'Belum ada catatan sinkronisasi.'}</p></div>
            <div class="checklist">
              ${item(sc.database_url, 'Database', sc.database_url ? 'Tersambung' : 'Isi DATABASE_URL di Vercel')}
              ${item(sc.youtube_api_key, 'YouTube Data API', sc.youtube_api_key ? 'Kunci API terpasang' : 'Isi YOUTUBE_API_KEY di Vercel')}
              ${item((sc.youtube_channels || 0) >= 3, 'Channel dipantau', (sc.youtube_channels || 0) + ' channel' + ((sc.youtube_channels || 0) < 3 ? '. Tambahkan ketiga channel di kartu Channel.' : ''))}
              ${analyticsChannels(true).map((c) => item(c.connected, 'Analytics: ' + esc(c.nama), c.connected ? 'Terhubung' + (c.connected_at ? ' sejak ' + new Date(c.connected_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '') : 'Belum terhubung: retensi, jam tonton dan pendapatan belum terbaca',
                c.connected ? `<button class="btn sm ghost danger" data-act="putus-analytics" data-id="${esc(c.id)}">Putuskan</button>` : `<a class="btn sm" href="/api/auth/google">Hubungkan</a>`)).join('')}
            </div>
            ${sc.last_summary ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><div class="card-h mb-6"><h2>Catatan sinkronisasi terakhir</h2><p>${new Date(sc.last_summary.selesai).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} · ${sc.last_summary.detik ?? '—'} detik · ${nf.format(sc.last_summary.newPosts || 0)} video baru, ${nf.format(sc.last_summary.updatedPosts || 0)} diperbarui, analytics ${sc.last_summary.analyticsChannels ?? 0} channel</p></div>
              ${(sc.last_summary.errors || []).length ? `<ul style="margin:0;padding-left:18px;color:var(--warn);font-size:13px">${sc.last_summary.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="muted m-0 fs-13">Tidak ada masalah.</p>'}</div>` : ''}
          </section>
          <section class="card"><div class="card-h"><h2>Channel</h2><p>Channel yang videonya ditarik saat sinkronisasi.</p></div>
            <div class="rank">${S.channels.map((c) => `<div class="rank-row"><span></span><div class="tx"><b>${esc(c.nama)}</b><div class="mono">${esc(c.id)}</div></div><span class="muted">${nf.format(S.content.filter((x) => x._ch === c.id).length)} video</span></div>`).join('') || '<div class="empty">Belum ada channel.</div>'}</div>
            <form id="ch-form" style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
              <label class="field"><span>Ganti daftar channel</span><textarea class="input mono" name="channels" rows="3" placeholder="@tokder&#10;https://www.youtube.com/@budidayacabe&#10;UCxxxxxxxxxxxxxxxxxxxxxx">${esc(S.channels.map((c) => c.id).join('\n'))}</textarea>
                <small>Satu channel per baris: link channel, @handle, atau ID (UC…). Setelah disimpan, klik Sinkronkan sekarang.</small></label>
              <div class="err text-bad fs-13" id="ch-err" role="alert"></div>
              <div><button class="btn">Simpan channel</button></div>
            </form></section>
          <section class="card"><div class="card-h"><h2>Password pemilik</h2><p>Dipakai untuk masuk sebagai pemilik. Mengganti password mengeluarkan pemilik dari perangkat lain.</p></div>
            <div class="tools"><input class="input" type="password" id="pw-baru" placeholder="Password baru, minimal 8 karakter" autocomplete="new-password" style="max-width:300px"><button class="btn" data-act="ganti-pw">Simpan</button></div></section>
        </div>
        ${aksesWebCard()}
        ${sistemCard()}`;
  };

// Pemilik memilih web mana yang boleh dibuka tiap karyawan dari halaman Aplikasi (dimuat saat Pengaturan dibuka).
function aksesWebCard() {
  const x = S.aksesWeb;
  if (x === undefined) {
    S.aksesWeb = null;
    api('/api/aplikasi/akses').then((r) => { S.aksesWeb = r; }).catch((e) => { S.aksesWeb = { error: e.message }; }).then(() => { if (route() === 'pengaturan') render(); });
  }
  const kepala = '<div class="card-h"><h2>Akses web karyawan</h2><p>Pilih web yang tampil di halaman Aplikasi tiap karyawan. Pantau selalu terbuka bagi yang sudah masuk.</p></div>';
  if (!x) return `<section class="card">${kepala}<p class="muted">Memuat…</p></section>`;
  if (x.error) return `<section class="card">${kepala}<p class="muted">${esc(x.error)}</p></section>`;
  if (!x.karyawan.length) return `<section class="card">${kepala}<p class="muted">Belum ada karyawan aktif.</p></section>`;
  return `<section class="card">${kepala}
    <div class="akses-web" role="table">
      <div class="aw-row aw-h" role="row"><span role="columnheader">Karyawan</span>${x.web.map((w) => `<span role="columnheader">${esc(w.nama)}</span>`).join('')}</div>
      ${x.karyawan.map((k) => `<div class="aw-row" role="row"><b role="cell">${esc(k.nama)}</b>${x.web.map((w) => `<label role="cell" class="aw-c"><input type="checkbox" data-act="akses-web" data-editor="${k.id}" data-web="${esc(w.id)}" ${k.web[w.id] ? 'checked' : ''} aria-label="${esc(k.nama)} boleh membuka ${esc(w.nama)}"></label>`).join('')}</div>`).join('')}
    </div>
    <p class="muted" style="margin-top:10px">Ini mengatur apa yang tampil di Pantau. Izin di dalam web itu sendiri tetap diatur di web tersebut (di Master: Pengaturan, Akses Via/Deni).</p></section>`;
}

// Database size, the nightly clean-up and the last sync, loaded when Pengaturan opens.
function sistemCard() {
  const x = S.sistem;
  if (!x) {
    if (x === undefined) { S.sistem = null; api('/api/scan/sistem').then((r) => { S.sistem = r; }).catch((e) => { S.sistem = { error: e.message }; }).then(() => { if (route() === 'pengaturan' && !$('#overlay').innerHTML) render(); }); }
    return '<section class="card"><div class="card-h"><h2>Kesehatan sistem</h2><p>Memuat…</p></div></section>';
  }
  if (x.error) return `<section class="card"><div class="card-h"><h2>Kesehatan sistem</h2><p>${esc(x.error)}</p></div></section>`;
  const mb = (b) => (b == null ? '—' : nf.format(Math.round(b / 1048576)) + ' MB');
  const b = x.baris || {};
  const r = x.perawatan;
  return `<section class="card"><div class="card-h"><h2>Kesehatan sistem</h2><p>Data lama dirapikan otomatis tiap malam: angka views per jam disimpan 14 hari, setelahnya satu angka per hari.</p></div>
      <div class="sys-grid">
        <div><span>Ukuran database</span><b>${mb(x.db_bytes)}</b></div>
        <div><span>Video</span><b>${nf.format(b.content || 0)}</b></div>
        <div><span>Catatan views</span><b>${nf.format(b.metrics_snapshot || 0)}</b></div>
        <div><span>Sinkron terakhir</span><b>${x.sinkron_terakhir ? agoText(new Date(x.sinkron_terakhir).getTime()) : '—'}</b></div>
        <div><span>Perapian terakhir</span><b>${r ? agoText(new Date(r.waktu).getTime()) : 'belum pernah'}</b>${r ? `<span>${nf.format(r.dihapus.snapshot + r.dihapus.terkirim + r.dihapus.ditolak)} baris lama dihapus</span>` : ''}</div>
        <div><span>Perangkat dengan notifikasi</span><b>${x.perangkat_notif}</b></div>
      </div></section>`;
}

AFTER.pengaturan = function () {
    const f = $('#ch-form');
    if (!f) return;
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const channels = f.channels.value.split('\n').map((x) => x.trim()).filter(Boolean);
      const btn = $('button', f);
      btn.disabled = true; btn.textContent = 'Memeriksa ke YouTube…';
      try {
        const list = await api('/api/channels', { method: 'PUT', body: { channels } });
        S.channels = list;
        if (S.scan) S.scan.youtube_channels = list.length;
        normalize();
        toast(list.length + ' channel tersimpan: ' + list.map((c) => c.nama).join(', '));
        render();
      } catch (e) { $('#ch-err').textContent = e.message; btn.disabled = false; btn.textContent = 'Simpan channel'; }
    });
  };
