// app/charts/charts.js - Chart rendering components
import { getState } from '../core/state.js';
import { icon, esc, fmt, measureText, niceStep, PALETTE, BLN, HARI, tglPendek } from '../core/utils.js';

export function drawStacked(box, { days, series, target, label = 'Video tayang per hari' }) {
  const W = Math.max(280, box.clientWidth), H = 230;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(label)}"></svg><div class="tip" hidden></div>`;
  const svg = $('svg', box), tip = $('.tip', box);
  const totals = days.map((d, i) => series.reduce((s, s2) => s + s2.values[i], 0));
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
    const cx = m.l + i * bw + bw / 2;
    if (i % labelEvery === 0) html += `<text x="${cx}" y="${H - m.b + 16}" text-anchor="middle" font-size="11" fill="var(--muted)">${tglPendek(d)}</text>`;
    let y0 = y(0);
    series.forEach((s, si) => {
      const v = s.values[i];
      const y1 = y(v);
      const h = Math.max(0, y0 - y1);
      html += `<rect x="${m.l + i * bw + 2}" y="${y1}" width="${bw - 4}" height="${h}" fill="${s.color}" rx="2" data-tip="${esc(s.name)}: ${fmt(v)}" data-day="${esc(d)}"/>`;
      y0 = y1;
    });
  });
  if (target) html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(target)}" y2="${y(target)}" stroke="var(--accent)" stroke-dasharray="4,4" stroke-width="2"/><text x="${W - m.r - 6}" y="${y(target) - 6}" text-anchor="end" fill="var(--accent)" font-size="11">Target ${fmt(target)}</text>`;
  svg.innerHTML = html;
  svg.querySelectorAll('rect[data-tip]').forEach((r) => {
    r.addEventListener('mouseenter', () => { tip.textContent = r.dataset.tip; tip.hidden = false; tip.style.left = (r.getBoundingClientRect().left - box.getBoundingClientRect().left + r.offsetWidth / 2) + 'px'; tip.style.top = (r.getBoundingClientRect().top - box.getBoundingClientRect().top - 28) + 'px'; });
    r.addEventListener('mouseleave', () => { tip.hidden = true; });
  });
}

export function drawSparkbars(box, { days, values, color = 'var(--s1)', label = '' }) {
  const W = Math.max(200, box.clientWidth), H = 100;
  const max = Math.max(...values, 1);
  const step = Math.max(1, niceStep(max * 1.2));
  const yMax = Math.ceil(max * 1.2 / step) * step;
  const m = { t: 10, r: 6, b: 20, l: 6 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const bw = iw / days.length;
  const y = (v) => m.t + ih - (v / yMax) * ih;
  let html = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(label)}">`;
  for (let v = 0; v <= yMax; v += step) html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--chart-grid)"/>`;
  days.forEach((d, i) => {
    const v = values[i];
    const y1 = y(v);
    html += `<rect x="${m.l + i * bw + 1}" y="${y1}" width="${bw - 2}" height="${Math.max(1, H - m.b - y1)}" fill="${color}" rx="1"/>`;
    if (i % Math.ceil(days.length / 4) === 0) html += `<text x="${m.l + i * bw + bw / 2}" y="${H - m.b + 14}" text-anchor="middle" font-size="10" fill="var(--muted)">${tglPendek(d)}</text>`;
  });
  html += `</svg>`;
  box.innerHTML = html;
}

export function drawRetention(box, data) {
  if (!Array.isArray(data) || !data.length) { box.innerHTML = '<div class="empty"><b>Belum ada data retensi</b></div>'; return; }
  const W = Math.max(280, box.clientWidth), H = 230;
  const m = { t: 10, r: 6, b: 24, l: 40 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const n = data.length;
  const stepX = iw / (n - 1);
  let html = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Retensi penonton">`;
  for (let p = 0; p <= 100; p += 20) {
    const y = m.t + ih - (p / 100) * ih;
    html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="var(--chart-grid)"/><text x="${m.l - 8}" y="${y}" dy="0.32em" text-anchor="end">${p}%</text>`;
  }
  data.forEach((p, i) => {
    const x = m.l + i * stepX;
    const y = m.t + ih - (p / 100) * ih;
    if (i > 0) {
      const px = m.l + (i - 1) * stepX;
      const py = m.t + ih - (data[i - 1] / 100) * ih;
      html += `<line x1="${px}" y1="${py}" x2="${x}" y2="${y}" stroke="var(--s1)" stroke-width="2" stroke-linecap="round"/>`;
    }
    html += `<circle cx="${x}" cy="${y}" r="3" fill="var(--s1)"/>`;
  });
  data.forEach((p, i) => {
    const x = m.l + i * stepX;
    html += `<text x="${x}" y="${H - m.b + 16}" text-anchor="middle" font-size="11" fill="var(--muted)">${i + 1}</text>`;
  });
  html += `</svg><div class="tip" hidden></div>`;
  box.innerHTML = html;
  const svg = $('svg', box), tip = $('.tip', box);
  svg.querySelectorAll('circle').forEach((c, i) => {
    c.addEventListener('mouseenter', () => { tip.textContent = `Detik ${i + 1}: ${data[i]}%`; tip.hidden = false; tip.style.left = (c.cx.baseVal.value + 10) + 'px'; tip.style.top = (c.cy.baseVal.value - 28) + 'px'; });
    c.addEventListener('mouseleave', () => { tip.hidden = true; });
  });
}