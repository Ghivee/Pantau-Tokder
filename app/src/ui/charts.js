import { niceStep } from '../core/data.js';
import { slotsOf } from '../core/rules.js';
import { $, esc } from '../lib/dom.js';
import { fmt, nf, nowJam, sum, tglPanjang, tglPendek, toMin, today } from '../lib/format.js';

function measureText(svg, text) {
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.textContent = text;
  svg.append(t);
  const w = t.getComputedTextLength();
  t.remove();
  return w;
}

// Stacked bars per day with an optional dashed target line.
export function drawStacked(box, { days, series, target, label = 'Video tayang per hari' }) {
  const W = Math.max(280, box.clientWidth), H = 230;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(label)}"></svg><div class="tip" hidden></div>`;
  const svg = $('svg', box), tip = $('.tip', box);
  const totals = days.map((d, i) => sum(series, (s) => s.values[i]));
  const max = Math.max(target || 0, ...totals, 1);
  const step = Math.max(1, niceStep(max * 1.1));
  const yMax = Math.ceil((max * 1.1) / step) * step;
  const ticks = []; for (let v = 0; v <= yMax + step / 2; v += step) ticks.push(v);
  const left = Math.max(...ticks.map((t) => measureText(svg, fmt(t)))) + 10;
  const m = { t: 10, r: 6, b: 24, l: left };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const bw = iw / days.length;
  const y = (v) => m.t + ih - (v / yMax) * ih;
  let html = '';
  ticks.forEach((t) => { html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)"/><text x="${m.l - 8}" y="${y(t)}" dy="0.32em" text-anchor="end">${fmt(t)}</text>`; });
  const labelEvery = Math.ceil(days.length / Math.max(2, Math.floor(iw / 52)));
  days.forEach((d, i) => {
    const x = m.l + i * bw, w = Math.min(28, bw * 0.62), x0 = x + (bw - w) / 2;
    let acc = 0;
    series.forEach((s) => {
      const v = s.values[i];
      if (!v) return;
      const y1 = y(acc + v), h = y(acc) - y1;
      html += `<rect x="${x0}" y="${y1}" width="${w}" height="${Math.max(0, h - 1)}" rx="2" fill="${s.color}"/>`;
      acc += v;
    });
    if ((days.length - 1 - i) % labelEvery === 0) html += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${tglPendek(d)}</text>`;
    html += `<rect class="hit" data-i="${i}" x="${x}" y="${m.t}" width="${bw}" height="${ih}" fill="transparent"/>`;
  });
  if (target) html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(target)}" y2="${y(target)}" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
  html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line-2)"/>`;
  svg.innerHTML = html;
  svg.addEventListener('mousemove', (ev) => {
    const r = ev.target.closest('.hit');
    if (!r) { tip.hidden = true; return; }
    const i = +r.dataset.i;
    tip.innerHTML = `<div class="h">${tglPanjang(days[i])}</div>` + series.filter((s) => s.values[i]).map((s) => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b>${nf.format(s.values[i])}</b></div>`).join('') + `<div class="h" style="margin-top:3px">Total ${nf.format(totals[i])}${target ? ' dari target ' + target : ''}</div>`;
    tip.hidden = false;
    const bx = box.getBoundingClientRect();
    const px = ev.clientX - bx.left;
    tip.style.left = Math.max(0, Math.min(bx.width - tip.offsetWidth, px + 12)) + 'px';
    tip.style.top = Math.max(0, ev.clientY - bx.top - tip.offsetHeight - 10) + 'px';
  });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; });
}

export function drawSparkbars(box, values, color) {
  const W = Math.max(160, box.clientWidth), H = 44;
  const max = Math.max(...values, 1), bw = W / values.length;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" aria-hidden="true">${values.map((v, i) => {
      const h = Math.max(v ? 2 : 0, (v / max) * (H - 4));
      return `<rect x="${i * bw + bw * 0.15}" y="${H - h}" width="${bw * 0.7}" height="${h}" rx="1.5" fill="${i === values.length - 1 ? color : 'var(--line-2)'}"/>`;
    }).join('')}</svg>`;
}

// Share of viewers still watching at each point of the video (YouTube audienceWatchRatio).
// Shorts that loop go above 100%, so the scale follows the data instead of clipping it.
export function drawRetention(box, data) {
  const pts = [...data].sort((a, b) => a.percent_duration - b.percent_duration);
  const top = Math.max(100, Math.ceil(Math.max(...pts.map((d) => d.retention)) / 25) * 25);
  const W = Math.max(260, box.clientWidth), H = 170, m = { t: 8, r: 8, b: 22, l: 40 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = (p) => m.l + (p / 100) * iw, y = (v) => m.t + ih - (v / top) * ih;
  const step = top > 200 ? 50 : 25;
  let html = '';
  for (let t = 0; t <= top; t += step) html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)"/><text x="${m.l - 6}" y="${y(t)}" dy="0.32em" text-anchor="end">${t}%</text>`;
  [0, 50, 100].forEach((t) => { html += `<text x="${x(t)}" y="${H - 5}" text-anchor="${t === 0 ? 'start' : t === 100 ? 'end' : 'middle'}">${t === 0 ? 'Awal' : t === 100 ? 'Akhir' : 'Tengah'}</text>`; });
  const line = pts.map((d) => `${x(d.percent_duration)},${y(d.retention)}`).join(' ');
  html += `<polygon points="${x(pts[0].percent_duration)},${y(0)} ${line} ${x(pts[pts.length - 1].percent_duration)},${y(0)}" fill="var(--leaf)" opacity=".12"/>`;
  html += `<polyline points="${line}" fill="none" stroke="var(--leaf)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const at = (p) => pts.reduce((a, b) => (Math.abs(b.percent_duration - p) < Math.abs(a.percent_duration - p) ? b : a)).retention;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Grafik retensi penonton">${html}</svg>
      <div class="muted" style="font-size:12.5px;margin-top:6px">Masih menonton di tengah video <b>${nf.format(Math.round(at(50)))}%</b>, di akhir <b>${nf.format(Math.round(at(100)))}%</b>.${top > 100 ? ' Di atas 100% berarti bagian itu ditonton ulang.' : ''}</div>`;
}

// Day ruler: schedule slots, uploads (on time / late) and other tasks on one 24-hour line.
export function drawRuler(box, st) {
  const W = Math.max(280, box.clientWidth), H = 74, m = { l: 6, r: 6 };
  const startH = 4, endH = 24;
  const x = (hm) => m.l + ((Math.max(startH * 60, Math.min(endH * 60, toMin(hm))) - startH * 60) / ((endH - startH) * 60)) * (W - m.l - m.r);
  let html = `<line x1="${m.l}" x2="${W - m.r}" y1="34" y2="34" stroke="var(--line-2)"/>`;
  const every = W < 420 ? 4 : 2;
  for (let h = startH; h <= endH; h += every) {
    const hm = String(h).padStart(2, '0') + ':00';
    html += `<line x1="${x(hm)}" x2="${x(hm)}" y1="30" y2="38" stroke="var(--line-2)"/><text x="${x(hm)}" y="70" text-anchor="middle" style="font-family:var(--mono);font-size:10.5px">${String(h % 24).padStart(2, '0')}</text>`;
  }
  const nowX = st.day === today() ? x(nowJam()) : null;
  if (nowX != null) html += `<line x1="${nowX}" x2="${nowX}" y1="6" y2="52" stroke="var(--leaf)" stroke-dasharray="2 3"/>`;
  slotsOf(st.e).forEach((s) => { html += `<rect x="${x(s) - 5}" y="8" width="10" height="10" rx="2" fill="none" stroke="var(--muted)" stroke-width="1.5"><title>Jadwal ${s}</title></rect>`; });
  st.tasks.forEach((a) => { html += `<rect x="${x(a.jam) - 3}" y="47" width="6" height="6" rx="1" fill="var(--line-2)"><title>${esc(a.jam + ' ' + a.tugas)}</title></rect>`; });
  st.vids.forEach((v) => {
    const late = v._tepat === false;
    if (v._slot) html += `<line x1="${x(v._slot)}" x2="${x(v._jam)}" y1="22" y2="34" stroke="${late ? 'var(--bad)' : 'var(--ok)'}" stroke-width="1.2" opacity=".6"/>`;
    html += `<circle cx="${x(v._jam)}" cy="34" r="6" fill="${late ? 'var(--bad)' : 'var(--ok)'}" stroke="var(--surface)" stroke-width="2"><title>${esc(v._jam + ' ' + v.judul)}</title></circle>`;
  });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Linimasa hari ${esc(st.e.nama)}">${html}</svg>`;
}

// Simple bars with an optional dashed reference line (e.g. 100% = same as the channel median).
export function drawBars(box, { labels, values, ref = 0, fmtV = fmt, label, tipLabels = labels }) {
  const W = Math.max(260, box.clientWidth), H = 190;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(label)}"></svg><div class="tip" hidden></div>`;
  const svg = $('svg', box), tip = $('.tip', box);
  const vals = values.map((v) => v || 0);
  const max = Math.max(ref, ...vals, 1);
  const step = niceStep(max * 1.1);
  const yMax = Math.ceil((max * 1.1) / step) * step;
  const ticks = []; for (let v = 0; v <= yMax + step / 2; v += step) ticks.push(v);
  const m = { t: 10, r: 6, b: 24, l: Math.max(...ticks.map((t) => measureText(svg, fmtV(t)))) + 10 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, bw = iw / labels.length;
  const y = (v) => m.t + ih - (v / yMax) * ih;
  let html = '';
  ticks.forEach((t) => { html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)"/><text x="${m.l - 8}" y="${y(t)}" dy="0.32em" text-anchor="end">${fmtV(t)}</text>`; });
  const every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 52)));
  labels.forEach((l, i) => {
    const x = m.l + i * bw, w = Math.min(34, bw * 0.6), x0 = x + (bw - w) / 2;
    if (values[i] != null) html += `<rect x="${x0}" y="${y(vals[i])}" width="${w}" height="${Math.max(0, y(0) - y(vals[i]))}" rx="2" fill="${ref && vals[i] < ref ? 'var(--line-2)' : 'var(--leaf)'}"/>`;
    if ((labels.length - 1 - i) % every === 0) html += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>`;
    html += `<rect class="hit" data-i="${i}" x="${x}" y="${m.t}" width="${bw}" height="${ih}" fill="transparent"/>`;
  });
  if (ref) html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(ref)}" y2="${y(ref)}" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
  html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line-2)"/>`;
  svg.innerHTML = html;
  svg.addEventListener('mousemove', (ev) => {
    const r = ev.target.closest('.hit');
    if (!r) { tip.hidden = true; return; }
    const i = +r.dataset.i;
    tip.innerHTML = `<div class="h">${esc(tipLabels[i])}</div><div><b>${values[i] == null ? 'tidak ada video' : fmtV(values[i])}</b></div>`;
    tip.hidden = false;
    const bx = box.getBoundingClientRect();
    tip.style.left = Math.max(0, Math.min(bx.width - tip.offsetWidth, ev.clientX - bx.left + 12)) + 'px';
    tip.style.top = Math.max(0, ev.clientY - bx.top - tip.offsetHeight - 10) + 'px';
  });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; });
}

// Garis per seri di satu diagram (membandingkan beberapa channel). Nilai null = tidak ada data: garis putus di situ.
// labels = teks sumbu x, titles = judul tooltip, fmtY = format angka sumbu dan tooltip.
export function drawLines(box, { labels, titles, series, fmtY = fmt, label = 'Perbandingan channel' }) {
  const W = Math.max(280, box.clientWidth), H = 250;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(label)}"></svg><div class="tip" hidden></div>`;
  const svg = $('svg', box), tip = $('.tip', box);
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  const max = Math.max(...all, 0), min = Math.min(...all, 0);
  const step = niceStep(((max - Math.min(min, 0)) || 1) * 1.1);
  const yMax = Math.ceil((max * 1.08 || step) / step) * step, yMin = min < 0 ? Math.floor(min / step) * step : 0;
  const ticks = []; for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(v);
  const left = Math.max(...ticks.map((t) => measureText(svg, fmtY(t)))) + 10;
  const m = { t: 10, r: 10, b: 24, l: left };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, n = labels.length;
  const x = (i) => m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
  let html = '';
  ticks.forEach((t) => { html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)"/><text x="${m.l - 8}" y="${y(t)}" dy="0.32em" text-anchor="end">${fmtY(t)}</text>`; });
  const every = Math.ceil(n / Math.max(2, Math.floor(iw / 56)));
  labels.forEach((t, i) => { if ((n - 1 - i) % every === 0) html += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(t)}</text>`; });
  series.forEach((s) => {
    let d = '', pen = false;
    s.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
    html += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    // A day with data on both sides missing would vanish as a line; show every point as a dot when sparse.
    if (all.length <= series.length * 40) s.values.forEach((v, i) => { if (v != null) html += `<circle cx="${x(i)}" cy="${y(v)}" r="2.5" fill="${s.color}"/>`; });
  });
  html += '<line class="cur" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/>';
  svg.innerHTML = html;
  const cur = $('.cur', svg);
  const mover = (ev) => {
    const bx = svg.getBoundingClientRect();
    const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - bx.left;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px / bx.width * W) - m.l) / (iw || 1) * (n - 1))));
    cur.setAttribute('x1', x(i)); cur.setAttribute('x2', x(i)); cur.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="h">${esc(titles[i])}</div>` + series.map((s) => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b>${s.values[i] == null ? '—' : fmtY(s.values[i])}</b></div>`).join('');
    tip.hidden = false;
    const b = box.getBoundingClientRect();
    tip.style.left = Math.max(0, Math.min(b.width - tip.offsetWidth, px + 12)) + 'px';
    tip.style.top = '0px';
  };
  svg.addEventListener('mousemove', mover); svg.addEventListener('touchmove', mover, { passive: true });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; cur.setAttribute('visibility', 'hidden'); });
}
