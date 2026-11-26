import { jamKerja } from '../core/calendar.js';
import { activeEditors, api, editorById } from '../core/data.js';
import { PAGES } from '../core/registry.js';
import { S, isAdmin, me } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { addDays, idr, sum, tglPanjang, tglPendek, today } from '../lib/format.js';
import { bantuan, muatUlang, notifCard } from './shared.js';
import { avatar, toast } from '../ui/bits.js';
import { closeOverlay, openDialog } from '../ui/dialog.js';
import { icon } from '../ui/icons.js';

const JENIS = { izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti', klaim: 'Klaim biaya' };

const statusPill = (s) => `<span class="pill ${s === 'disetujui' ? 'ok' : s === 'ditolak' ? 'bad' : 'warn'}">${s === 'menunggu' ? 'Menunggu' : s === 'disetujui' ? 'Disetujui' : 'Ditolak'}</span>`;

const rentangTgl = (p) => (p.jenis === 'klaim' || p.dari === p.sampai ? tglPanjang(p.dari) : tglPendek(p.dari) + ' – ' + tglPanjang(p.sampai));

function pengajuanRow(p, owner) {
  const e = editorById(p.editor_id);
  const aksi = owner && p.status === 'menunggu'
    ? `<button class="btn sm primary" data-act="putuskan" data-id="${p.id}" data-v="disetujui">Setujui</button><button class="btn sm ghost danger" data-act="putuskan" data-id="${p.id}" data-v="ditolak">Tolak</button>`
    : !owner && p.status === 'menunggu' ? `<button class="btn sm ghost" data-act="batal-pengajuan" data-id="${p.id}">Batalkan</button>` : '';
  return `<tr>${owner ? `<td data-label="Karyawan"><span class="ed">${avatar(e, 'xs')}${esc(e ? e.nama : '—')}</span></td>` : ''}
      <td data-label="Jenis"><b>${JENIS[p.jenis] || esc(p.jenis)}</b></td>
      <td data-label="Tanggal">${rentangTgl(p)}</td>
      <td class="full">${esc(p.alasan)}${p.jumlah ? ` · <b>${idr(p.jumlah)}</b>` : ''}${p.catatan ? `<div class="muted fs-125">Catatan pemilik: ${esc(p.catatan)}</div>` : ''}</td>
      <td data-label="Status">${statusPill(p.status)}</td>
      <td class="full"><div class="row-actions">${aksi}</div></td></tr>`;
}

PAGES.pengajuan = function () {
  const P = S.pengajuan;
  const head = (p, tools = '') => `<header class="head"><div><h1>Izin & klaim</h1><p>${p}</p></div><div class="tools"><a class="btn ghost" href="/presensi">‹ Presensi</a>${tools}${bantuan('pengajuan')}</div></header>`;
  if (!P) return head('Data izin dan klaim belum termuat.', '<button class="btn" data-act="retry">Coba lagi</button>');
  const owner = isAdmin();
  const th = `<thead><tr>${owner ? '<th>Karyawan</th>' : ''}<th>Jenis</th><th>Tanggal</th><th>Keterangan</th><th>Status</th><th></th></tr></thead>`;
  if (!owner) {
    const who = me();
    if (!who) return head('Masuk sebagai karyawan untuk mengajukan izin atau klaim.');
    const c = P.cuti[who.id] || { jatah: 0, terpakai: 0 };
    const wait = P.list.filter((p) => p.status === 'menunggu').length;
    return head(`Ajukan izin, sakit, cuti atau klaim biaya. Pemilik akan menyetujui atau menolak; yang disetujui otomatis masuk ke perhitungan gaji.`,
      `<button class="btn primary" data-act="ajukan" data-v="izin">${icon('plus')}Ajukan izin / cuti</button><button class="btn" data-act="ajukan" data-v="klaim">${icon('plus')}Klaim biaya</button>`) + `
        <section class="kpis">
          <div class="kpi"><span class="l">Sisa cuti ${today().slice(0, 4)}</span><span class="v">${Math.max(0, c.jatah - c.terpakai)} <small>/ ${c.jatah} hari</small></span><span class="d">${c.terpakai} hari kerja terpakai</span></div>
          <div class="kpi"><span class="l">Menunggu keputusan</span><span class="v">${wait}</span><span class="d">pengajuan</span></div>
          <div class="kpi"><span class="l">Klaim disetujui bulan ini</span><span class="v">${idr(sum(P.list.filter((p) => p.jenis === 'klaim' && p.status === 'disetujui' && p.dari.slice(0, 7) === today().slice(0, 7)), (p) => p.jumlah))}</span><span class="d">dibayar bersama gaji</span></div>
        </section>
        <section class="card"><div class="card-h"><h2>Pengajuan saya</h2><p>120 hari terakhir.</p></div>
          ${P.list.length ? `<div class="table-wrap"><table class="t stack">${th}<tbody>${P.list.map((p) => pengajuanRow(p, false)).join('')}</tbody></table></div>` : '<div class="empty"><b>Belum ada pengajuan</b>Klik Ajukan izin / cuti atau Klaim biaya.</div>'}
        </section>
        ${notifCard()}`;
  }
  const wait = P.list.filter((p) => p.status === 'menunggu');
  const done = P.list.filter((p) => p.status !== 'menunggu');
  return head(wait.length ? `<b>${wait.length}</b> pengajuan menunggu keputusan Anda.` : 'Tidak ada pengajuan yang menunggu.') + `
      <section class="card ${wait.length ? 'attn' : ''}"><div class="card-h"><h2>Menunggu keputusan</h2><p>Izin, sakit dan cuti yang disetujui tidak dihitung tidak hadir. Klaim yang disetujui ditambahkan ke gaji bulan tanggal klaimnya.</p></div>
        ${wait.length ? `<div class="table-wrap"><table class="t stack">${th}<tbody>${wait.map((p) => pengajuanRow(p, true)).join('')}</tbody></table></div>` : '<div class="empty"><b>Semua sudah diputuskan</b></div>'}
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Sisa cuti ${today().slice(0, 4)}</h2><p>Jatah per tahun diatur di Gaji → Atur gaji.</p></div>
          <div class="rank">${activeEditors().map((e) => { const c = P.cuti[e.id] || { jatah: 0, terpakai: 0 }; return `<div class="rank-row">${avatar(e, 'sm')}<div class="tx"><b>${esc(e.nama)}</b><div>${c.terpakai} dari ${c.jatah} hari terpakai</div><div class="bar"><i style="width:${c.jatah ? Math.min(100, (c.terpakai / c.jatah) * 100) : 0}%;background:${e._color}"></i></div></div><b>${Math.max(0, c.jatah - c.terpakai)} hari</b></div>`; }).join('') || '<div class="empty">Belum ada karyawan aktif.</div>'}</div></section>
        <section class="card"><div class="card-h"><h2>Bulan ini</h2></div>
          <dl class="kv">${['izin', 'sakit', 'cuti'].map((j) => `<dt>${JENIS[j]}</dt><dd>${done.filter((p) => p.jenis === j && p.status === 'disetujui' && (p.dari.slice(0, 7) === today().slice(0, 7) || p.sampai.slice(0, 7) === today().slice(0, 7))).length} disetujui</dd>`).join('')}
            <dt>Klaim</dt><dd>${idr(sum(done.filter((p) => p.jenis === 'klaim' && p.status === 'disetujui' && p.dari.slice(0, 7) === today().slice(0, 7)), (p) => p.jumlah))} disetujui</dd></dl></section>
      </div>
      <section class="card"><div class="card-h"><h2>Riwayat</h2><p>120 hari terakhir.</p></div>
        ${done.length ? `<div class="table-wrap"><table class="t stack">${th}<tbody>${done.map((p) => pengajuanRow(p, true)).join('')}</tbody></table></div>` : '<div class="empty"><b>Belum ada riwayat</b></div>'}
      </section>
      ${notifCard()}`;
};

export function ajukanDialog(jenis) {
  const klaim = jenis === 'klaim';
  openDialog(`<h2>${klaim ? 'Klaim biaya' : 'Ajukan izin, sakit atau cuti'}</h2>
      <form id="aj-form" class="stack">
        ${klaim ? '<input type="hidden" name="jenis" value="klaim">' : `<label class="field"><span>Jenis</span><select class="input" name="jenis"><option value="izin">Izin (keperluan pribadi)</option><option value="sakit">Sakit</option><option value="cuti">Cuti (memakai jatah tahunan)</option></select></label>`}
        <div class="row">
          <label class="field"><span>${klaim ? 'Tanggal pengeluaran' : 'Dari tanggal'}</span><input class="input" type="date" name="dari" value="${today()}" ${klaim ? `max="${today()}"` : ''} required></label>
          ${klaim ? `<label class="field"><span>Jumlah (Rp)</span><input class="input" type="number" name="jumlah" min="1000" step="500" required placeholder="50000"></label>` : `<label class="field"><span>Sampai tanggal</span><input class="input" type="date" name="sampai" value="${today()}" required></label>`}
        </div>
        ${klaim ? '' : '<p class="muted m-0 fs-13" id="aj-hari"></p>'}
        <label class="field"><span>${klaim ? 'Untuk apa' : 'Alasan'}</span><textarea class="input" name="alasan" maxlength="300" required placeholder="${klaim ? 'Misal: beli pupuk untuk video uji kocor, nota disimpan' : 'Misal: kontrol ke dokter'}"></textarea>${klaim ? '<small>Simpan nota; pemilik bisa memintanya sebelum menyetujui.</small>' : ''}</label>
        <div class="err" id="aj-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Kirim</button></div>
      </form>`, (d) => {
    const f = $('#aj-form', d), info = $('#aj-hari', d);
    const hitungHari = () => {
      if (!info) return;
      if (!f.dari.value || !f.sampai.value || f.sampai.value < f.dari.value) { info.textContent = ''; return; }
      let n = 0; for (let x = f.dari.value; x <= f.sampai.value && n < 400; x = addDays(x, 1)) if (jamKerja(x)) n++;
      info.textContent = `${n} hari kerja.`;
    };
    if (info) { f.dari.addEventListener('change', () => { if (f.sampai.value < f.dari.value) f.sampai.value = f.dari.value; hitungHari(); }); f.sampai.addEventListener('change', hitungHari); hitungHari(); }
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const body = Object.fromEntries(new FormData(f));
      if (body.jumlah) body.jumlah = +body.jumlah;
      const btn = $('button.primary', f); btn.disabled = true;
      try { await api('/api/pengajuan', { method: 'POST', body }); closeOverlay(); toast('Pengajuan terkirim, menunggu keputusan pemilik'); await muatUlang(); } catch (e) { $('#aj-err', d).textContent = e.message; btn.disabled = false; }
    });
  });
}

export function putuskanDialog(id, status) {
  const p = S.pengajuan.list.find((x) => x.id === +id);
  if (!p) return;
  const e = editorById(p.editor_id);
  openDialog(`<h2>${status === 'disetujui' ? 'Setujui' : 'Tolak'} ${JENIS[p.jenis].toLowerCase()} ${esc(e ? e.nama : '')}?</h2>
      <p>${rentangTgl(p)} · ${esc(p.alasan)}${p.jumlah ? ' · <b>' + idr(p.jumlah) + '</b>' : ''}</p>
      <form id="pt-form" class="stack">
        <label class="field"><span>Catatan untuk karyawan (opsional)</span><input class="input" name="catatan" maxlength="200"></label>
        <div class="err" id="pt-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">${status === 'disetujui' ? 'Setujui' : 'Tolak'}</button></div>
      </form>`, (d) => {
    $('#pt-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = $('button.primary', d); btn.disabled = true;
      try { await api('/api/pengajuan/' + p.id, { method: 'PUT', body: { status, catatan: ev.target.catatan.value } }); closeOverlay(); toast(status === 'disetujui' ? 'Disetujui' : 'Ditolak'); await muatUlang(); } catch (err) { $('#pt-err', d).textContent = err.message; btn.disabled = false; }
    });
  });
}
