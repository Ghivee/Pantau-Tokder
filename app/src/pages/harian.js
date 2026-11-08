import { jamKerja, ketLibur } from '../core/calendar.js';
import { activeEditors, editorById } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { TUGAS, slotsOf } from '../core/rules.js';
import { S, canLog, isAdmin, me } from '../core/state.js';
import { dayStats, daysBack } from '../core/stats.js';
import { $, $$, esc } from '../lib/dom.js';
import { fmt, nf, nowJam, tglPanjang, tglPendek, today } from '../lib/format.js';
import { bantuan } from './shared.js';
import { avatar, peranLabel } from '../ui/bits.js';
import { drawRuler } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { render } from '../ui/layout.js';

PAGES.harian = function () {
    const day = S.day;
    const team = activeEditors();
    const mine = me();
    const order = mine ? [mine] : team;
    const list = order.map((e) => dayStats(e, day));
    const gaps = (st) => {
      const g = [];
      if (st.n < st.target) g.push((st.target - st.n) + ' video kurang');
      if (st.telat) g.push(st.telat + ' telat');
      if (S.aktivitas.length) TUGAS.forEach((t) => { if (st.done(t.nama) < st.tTarget[t.nama]) g.push(t.short.toLowerCase() + ' ' + st.done(t.nama) + '/' + st.tTarget[t.nama]); });
      return g;
    };
    const sentence = list.length
      ? !jamKerja(day) ? `<b>Libur: ${esc(ketLibur(day))}.</b> Tidak ada target; video yang tetap tayang tetap tercatat.`
      : list.map((st) => { const g = gaps(st); return `${mine ? 'Anda' : esc(st.e.nama)}: <b>${st.n}</b> dari ${st.target} video, skor <b>${st.skor ?? '—'}</b>${g.length ? ' (' + esc(g.slice(0, 3).join(', ')) + ')' : ', semua beres'}`; }).join('. ') + '.'
      : 'Belum ada karyawan aktif.';
    const isToday = day === today();
    return `
        <header class="head">
          <div><h1>${mine ? 'Harian saya' : 'Harian'}</h1><p><span class="muted">${tglPanjang(day)}${isToday ? ' · hari ini, sampai jam ' + nowJam() : ''}.</span> ${sentence}</p></div>
          <div class="tools">
            <div class="daynav">
              <button class="btn icon" data-act="hari" data-v="-1" aria-label="Hari sebelumnya">${icon('left')}</button>
              <input class="input" type="date" id="f-day" value="${day}" max="${today()}" aria-label="Tanggal">
              <button class="btn icon" data-act="hari" data-v="1" aria-label="Hari berikutnya" ${isToday ? 'disabled' : ''}>${icon('right')}</button>
            </div>
            ${!isToday ? '<button class="btn ghost" data-act="hari-ini">Hari ini</button>' : ''}
            ${canLog() ? `<button class="btn primary" data-act="catat">${icon('plus')}Catat aktivitas</button>` : ''}
            ${bantuan('harian')}
          </div>
        </header>
        <div class="people">${list.map(personCard).join('') || '<div class="card empty"><b>Belum ada karyawan aktif</b>Tambahkan di menu Karyawan.</div>'}</div>
        <p class="muted" style="font-size:12.5px;margin:0;max-width:90ch">Skor harian 0–100: video tayang dibanding target (35 poin), tepat jadwal (25), views dibanding median channel untuk video berumur ≥ 2 hari (20), tugas lain (20). Komponen yang belum ada datanya tidak dihitung. Nilai A ≥ 85, B ≥ 70, C ≥ 55.</p>`;
  };

function personCard(st) {
  const e = st.e;
  const isMe = me() && me().id === e.id;
  const strip = daysBack(14, S.day > today() ? today() : S.day).map((d) => dayStats(e, d));
  const checks = [
    { l: st.partial ? 'Video sejauh ini' : 'Video tayang', v: st.n, t: st.target },
    { l: 'Tepat jadwal', v: st.tepat, t: st.withSlot, na: !slotsOf(e).length ? 'jadwal belum diatur' : !st.withSlot ? 'belum ada video' : null },
    ...TUGAS.map((t) => ({ l: t.short, v: st.done(t.nama), t: st.tTarget[t.nama] })),
  ];
  const items = [
    ...st.vids.map((v) => ({ jam: v._jam, kind: 'up', v })),
    ...st.tasks.map((a) => ({ jam: a.jam, kind: 'task', a })),
  ].sort((a, b) => a.jam.localeCompare(b.jam));
  const canDel = (a) => isAdmin() || (me() && me().id === a.editor_id);
  return `<section class="card person" id="orang-${e.id}">
      <div class="person-top">${avatar(e, 'lg')}
        <div class="t"><h2>${esc(e.nama)}${isMe ? ' <span class="pill leaf">Anda</span>' : ''}</h2><div class="sub">${peranLabel(e.peran)} · kode #${esc(e.kode_identifikasi)} · ${slotsOf(e).length ? 'jadwal ' + slotsOf(e).join(', ') : 'jadwal belum diatur'}</div></div>
        <div class="score"><div class="cap">${st.partial ? 'Skor<br>sementara' : 'Skor<br>' + tglPendek(st.day)}</div><span class="n">${st.skor ?? '—'}</span>${st.nilai ? `<span class="grade ${st.nilai}">${st.nilai}</span>` : ''}</div>
      </div>
      <div class="checks">${checks.map((c) => {
        if (c.na) return `<div class="check"><span class="l">${c.l}</span><span class="v muted" style="font-size:12.5px;font-weight:500">${c.na}</span></div>`;
        const r = c.t ? c.v / c.t : c.v ? 1 : null;
        const cls = r == null ? '' : r >= 1 ? '' : r > 0 ? 'warn' : 'bad';
        return `<div class="check"><span class="l">${c.l}</span><span class="v">${nf.format(c.v)}<small> / ${nf.format(c.t)}</small></span><span class="meter"><i class="${cls}" style="width:${Math.min(1, r ?? 0) * 100}%"></i></span></div>`;
      }).join('')}</div>
      <div>
        <div class="legend" style="margin-bottom:6px"><span><i class="slot"></i>Jadwal</span><span><i style="background:var(--ok)"></i>Tayang tepat</span><span><i style="background:var(--bad)"></i>Telat</span><span><i class="task"></i>Tugas lain</span></div>
        <div class="ruler" data-ruler="${e.id}" style="min-height:74px"></div>
      </div>
      <div>
        <div class="strip-l"><span>${tglPendek(strip[0].day)}</span><span>Skor 14 hari</span><span>${tglPendek(strip[strip.length - 1].day)}</span></div>
        <div class="strip">${strip.map((x) => `<button class="${x.nilai || ''}" data-act="ke-hari" data-v="${x.day}" aria-pressed="${x.day === S.day}" title="${tglPendek(x.day)}: skor ${x.skor ?? '—'}" aria-label="${tglPendek(x.day)}, skor ${x.skor ?? 'tidak ada'}">${x.skor ?? '·'}</button>`).join('')}</div>
      </div>
      <div>
        <div class="card-h" style="margin-bottom:4px"><h2>Yang dikerjakan</h2>${isAdmin() || isMe ? `<button class="btn sm ghost" data-act="catat" data-id="${e.id}">${icon('plus')}Catat</button>` : ''}</div>
        <div class="timeline">${items.length ? items.map((it) => it.kind === 'up' ? `
          <div class="tl"><span class="time">${it.jam}</span><span class="dot ${it.v._tepat === false ? 'late' : 'up'}"></span>
            <div class="what"><b>Upload video</b> <a href="/harian" data-act="video" data-id="${it.v.id}" style="color:inherit">${esc(it.v.judul)}</a><div>${esc(it.v._chNama)} · ${fmt(it.v.views)} views</div></div>
            <div class="res">${it.v._tepat == null ? '<span class="pill">tanpa jadwal</span>' : it.v._tepat ? `<span class="pill ok">tepat ${it.v._slot}</span>` : `<span class="pill bad">telat ${it.v._late} mnt</span>`}</div></div>` : `
          <div class="tl"><span class="time">${esc(it.jam)}</span><span class="dot task"></span>
            <div class="what"><b>${esc(it.a.tugas)}</b>${it.a.jumlah > 1 ? ' · ' + nf.format(it.a.jumlah) : ''}<div>${esc(it.a.detail || '')}</div></div>
            <div class="res res-btn">${canDel(it.a) ? `<button class="btn sm ghost" data-act="hapus-aktivitas" data-id="${it.a.id}" aria-label="Hapus aktivitas">${icon('x')}</button>` : ''}</div></div>`).join('')
          : `<div class="empty"><b>Belum ada catatan</b>${S.day === today() ? 'Video yang tayang muncul setelah sinkronisasi; tugas lain dicatat lewat tombol Catat.' : 'Tidak ada video atau tugas tercatat di hari ini.'}</div>`}</div>
      </div>
    </section>`;
}

AFTER.harian = function () {
    $$('[data-ruler]').forEach((el) => drawRuler(el, dayStats(editorById(el.dataset.ruler), S.day)));
    const inp = $('#f-day');
    if (inp) inp.addEventListener('change', () => { if (inp.value && inp.value <= today()) { S.day = inp.value; render(); } });
    const target = location.pathname.split('/')[2];
    // Employees have only their own page: /harian/<someone> is just /harian.
    if (target && me()) history.replaceState(null, '', '/harian');
    else if (target) { const el = $('#orang-' + target); if (el) el.scrollIntoView({ block: 'start' }); }
  };
