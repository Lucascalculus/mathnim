// I2 · Reading focus. The page knows where you are reading: an eye line rides down the view as you scroll (high at the
// top of the page, low at the end, so every paragraph gets its turn), or follows the pointer. The paragraph under it
// is fully inked and marked by a bar in the margin; the others recede, but only to a floor that stays readable
// (4.5 : 1 against the paper, the WCAG body-text minimum). The figure that paragraph speaks about opens to full size;
// the others wait as small proofs, never fainter than 3 : 1 for their marks. Nouns keep their pigment throughout:
// they are the threads between the text and the figures.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { css, SERIF, SANS, contrast, hex, mix, rgb } from './_text.js';

export const FLOOR = 4.5, FIG_FLOOR = 3;

export const meta = {
  id: 'focus',
  name: { zh: '阅读焦点', en: 'Reading focus' },
  means: { zh: '读到哪一段，哪一段就是全墨，其余的退后但仍然好读；这一段说的那张图同时展开到最大。', en: 'The paragraph you are reading is in full ink, the others recede but stay readable, and the figure it speaks about opens to full size.' },
  test: { zh: '任何滚动位置恰有一段在焦点；退后的正文对比度不低于 4.5 : 1，退后的图不低于 3 : 1；展开的图正是这一段引用的', en: 'Exactly one paragraph is in focus at every scroll position; receded text never falls below 4.5 : 1, receded figures below 3 : 1; the open figure is the one that paragraph cites' },
};

// paragraphs: runs of text and nouns, and the figure each one speaks about
const TEXT = {
  zh: {
    title: '矩阵在做什么',
    paras: [
      ['A', ['一个 2×2 矩阵把整个平面搬到新的位置。要知道它怎么搬，只需看两个箭头：', ['î', 'cobalt'], ' 和 ', ['ĵ', 'violet'], ' 落到了哪里。']],
      ['A', ['矩阵的第一列就是 ', ['î', 'cobalt'], ' 的新位置，第二列就是 ', ['ĵ', 'violet'], ' 的新位置。其余每个点都跟着这两个箭头走，所以网格线仍然平行、仍然等距。']],
      ['B', ['单位正方形被拉成一个平行四边形，它的面积就是矩阵的行列式。这个变换把平面上所有的面积都放大同样的倍数。']],
      ['B', ['这里行列式是 1.415：图上任何一块区域，不管什么形状，面积都变成原来的 1.415 倍。由 ', ['î', 'cobalt'], ' 和 ', ['ĵ', 'violet'], ' 围成的那一块，正好告诉你这个倍数。']],
      ['C', ['当行列式等于 0，平行四边形被压成一条线段，整个平面都挤到一条直线上，许多点落到了同一处。']],
      ['C', ['这时没有办法退回去：落在同一处的点，分不清各自是从哪里来的。所以行列式为 0 的矩阵没有逆。']],
    ],
    fig: { A: '图 1　两个箭头决定一切', B: '图 2　面积放大的倍数', C: '图 3　压成一条线' },
  },
  en: {
    title: 'What a matrix does',
    paras: [
      ['A', ['A 2×2 matrix moves the whole plane to a new place. To know how, you only need to watch two arrows: where ', ['î', 'cobalt'], ' and ', ['ĵ', 'violet'], ' land.']],
      ['A', ['The first column of the matrix is the new ', ['î', 'cobalt'], ', the second is the new ', ['ĵ', 'violet'], '. Every other point follows these two arrows, so grid lines stay parallel and evenly spaced.']],
      ['B', ['The unit square is stretched into a parallelogram, and its area is the determinant. The map scales every area in the plane by that same factor.']],
      ['B', ['Here the determinant is 1.415: any region of the plane, whatever its shape, ends up 1.415 times as large. The patch spanned by ', ['î', 'cobalt'], ' and ', ['ĵ', 'violet'], ' tells you that factor.']],
      ['C', ['When the determinant is 0, the parallelogram is squashed into a segment: the whole plane falls onto one line, and many points land in the same place.']],
      ['C', ['Then there is no way back: points that landed together cannot tell where each one came from. That is why a matrix with determinant 0 has no inverse.']],
    ],
    fig: { A: 'Figure 1  Two arrows decide everything', B: 'Figure 2  How much area grows', C: 'Figure 3  Squashed onto a line' },
  },
};

const INK = hex('#1a1b1f'), PAPER = hex('#fbfaf7');
// the receded colour: ink mixed toward the paper exactly until the floor (plus a hair of margin)
function floor_colour(c, f) { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (contrast(mix(c, PAPER, m), PAPER) >= f + 0.05) lo = m; else hi = m; } return mix(c, PAPER, lo); }
// the opacity a figure's mark may recede to: the least alpha that keeps it at the figure floor
function floor_alpha(c, f) { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (contrast(mix(PAPER, c, m), PAPER) >= f + 0.05) hi = m; else lo = m; } return hi; }
const FIG_INKS = ['#1a1b1f', '#2f5bd2', '#6a4ec4'];
const FIG_ALPHA = Math.max(...FIG_INKS.map((c) => floor_alpha(hex(c), FIG_FLOOR)));

// the figures, in a 300 × 220 box: the plane under M, from straight above
function figure(id, lang) {
  const M = { A: [1.4, 0.25, 0.5, 1.1], B: [1.4, 0.25, 0.5, 1.1], C: [1.2, 0.6, 0.6, 0.3] }[id];
  const o = [96, 168], u = 62, P = (x, y) => [o[0] + u * (M[0] * x + M[2] * y), o[1] - u * (M[1] * x + M[3] * y)], f = (p) => p.map((v) => v.toFixed(1)).join(' ');
  let s = `<svg viewBox="0 0 300 220" preserveAspectRatio="xMidYMid meet"><g class="marks">`;
  // the grid as moved by M (graphite scaffolding), and the unit square's image
  for (let k = -3; k <= 4; k++) { s += `<path d="M${f(P(k, -3))}L${f(P(k, 4))}M${f(P(-3, k))}L${f(P(4, k))}" stroke="#8d9198" stroke-opacity=".45" stroke-width="1" fill="none"/>`; }
  if (id !== 'A') s += `<path d="M${f(P(0, 0))}L${f(P(1, 0))}L${f(P(1, 1))}L${f(P(0, 1))}Z" fill="#1a1b1f" fill-opacity=".07" stroke="#1a1b1f" stroke-width="1.5"/>`;
  if (id === 'C') s += `<path d="M${f(P(-3, 0))}L${f(P(4, 0))}" stroke="#1a1b1f" stroke-width="2.5"/>`;
  const arrow = (x, y, c) => { const [ax, ay] = P(0, 0), [bx, by] = P(x, y), a = Math.atan2(by - ay, bx - ax), h = 10;
    return `<path d="M${ax} ${ay}L${(bx - Math.cos(a) * h * 0.8).toFixed(1)} ${(by - Math.sin(a) * h * 0.8).toFixed(1)}" stroke="${c}" stroke-width="3" stroke-linecap="round"/><path d="M${bx.toFixed(1)} ${by.toFixed(1)}l${(-Math.cos(a - 0.45) * h).toFixed(1)} ${(-Math.sin(a - 0.45) * h).toFixed(1)}l${(Math.cos(a - 0.45) * h - Math.cos(a + 0.45) * h).toFixed(1)} ${(Math.sin(a - 0.45) * h - Math.sin(a + 0.45) * h).toFixed(1)}z" fill="${c}"/>`; };
  s += arrow(1, 0, '#2f5bd2') + arrow(0, 1, '#6a4ec4');
  s += `<circle cx="${o[0]}" cy="${o[1]}" r="3" fill="#1a1b1f"/></g><g class="labels" font-family="${SANS.replace(/"/g, "'")}" font-size="14">`;
  const [ix, iy] = P(1, 0), [jx, jy] = P(0, 1);
  s += `<text x="${ix + 8}" y="${iy + 16}" fill="#2f5bd2" font-weight="600" font-family="${SERIF.replace(/"/g, "'")}" font-style="italic" font-size="17">î</text><text x="${jx - 4}" y="${jy - 10}" fill="#6a4ec4" font-weight="600" font-family="${SERIF.replace(/"/g, "'")}" font-style="italic" font-size="17">ĵ</text>`;
  const det = M[0] * M[3] - M[1] * M[2];
  if (id !== 'A') s += `<text x="292" y="26" text-anchor="end" fill="#1a1b1f">det = ${Math.abs(det) < 1e-9 ? '0' : det.toFixed(3).replace(/0+$/, '')}</text>`;
  else s += `<text x="292" y="26" text-anchor="end" fill="#1a1b1f">M = [ î  ĵ ]</text>`;
  return s + '</g></svg>';
}

const CSS = `
.fc-wrap{position:absolute;inset:0;background:var(--paper);overflow:hidden}
.fc-scroll{position:absolute;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.fc-scroll::-webkit-scrollbar{display:none}
.fc-text{position:relative}
.fc-title{font-family:${SANS};font-weight:600;color:var(--ink);letter-spacing:-.005em;margin:0 0 22px}
.fc-p{font-family:${SERIF};margin:0;position:relative}
.fc-p b{font-weight:600;font-style:italic}
.fc-p b.cobalt{color:var(--cobalt)}.fc-p b.violet{color:var(--violet)}
.fc-bar{position:absolute;left:0;top:0;width:2.5px;border-radius:2px;background:var(--ink);pointer-events:none}
.fc-figs{position:absolute}
.fc-fig{position:absolute;left:0;right:0;border-radius:12px;background:#f3f1ec;overflow:hidden;cursor:pointer}
.fc-fig svg{position:absolute;inset:8px 8px 26px 8px;width:calc(100% - 16px);height:calc(100% - 34px)}
.fc-fig .fc-cap{position:absolute;left:12px;right:12px;bottom:7px;font-family:${SANS};font-size:12.5px;color:#62666d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fc-fig .tick{position:absolute;left:0;top:14px;bottom:14px;width:2.5px;border-radius:2px;background:var(--ink)}
`;

export function make({ stage, canvas, hud, lang }) {
  canvas.style.display = 'none';
  css('fc-css', CSS);
  const zh = lang === 'zh', T = TEXT[lang];
  const wrap = document.createElement('div'); wrap.className = 'fc-wrap';
  const scroll = document.createElement('div'); scroll.className = 'fc-scroll';
  const text = document.createElement('div'); text.className = 'fc-text';
  const title = document.createElement('h3'); title.className = 'fc-title'; title.textContent = T.title;
  const bar = document.createElement('div'); bar.className = 'fc-bar';
  text.append(title, bar); scroll.append(text);
  const figs_el = document.createElement('div'); figs_el.className = 'fc-figs';
  wrap.append(scroll, figs_el); stage.append(wrap);
  const FLOOR_RGB = floor_colour(INK, FLOOR);

  const paras = T.paras.map(([ref, runs], i) => {
    const el = document.createElement('p'); el.className = 'fc-p';
    for (const r of runs) { if (typeof r === 'string') el.append(r); else { const b = document.createElement('b'); b.className = r[1]; b.textContent = r[0]; el.append(b); } }
    text.append(el);
    const p = { el, ref, k: new Spring(i ? 0 : 1, 0.38, 1) };
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = i; update(); } });
    return p;
  });
  scroll.addEventListener('pointerleave', () => { hover = -1; update(); });
  const figs = {};
  for (const id of ['A', 'B', 'C']) {
    const el = document.createElement('div'); el.className = 'fc-fig';
    el.innerHTML = figure(id, lang) + `<div class="fc-cap">${T.fig[id]}</div><div class="tick"></div>`;
    figs_el.append(el);
    // tapping a waiting figure takes you to the first paragraph that speaks about it
    el.addEventListener('click', () => { const i = paras.findIndex((p) => p.ref === id); if (i >= 0 && focus_i !== i) go_to(i); });
    figs[id] = { el, svg: el.querySelector('svg'), marks: el.querySelector('.marks'), labels: el.querySelector('.labels'), cap: el.querySelector('.fc-cap'), tick: el.querySelector('.tick'), k: new Spring(id === 'A' ? 1 : 0, 0.45, 1) };
  }
  const bar_top = new Spring(0, 0.4, 1), bar_bot = new Spring(0, 0.4, 1);
  let narrow = false, hover = -1, focus_i = 0, band = 0, W = 0, H = 0;

  function fit() {
    W = wrap.clientWidth; H = wrap.clientHeight; narrow = W < 700;
    const fs = narrow ? 17 : 18;
    for (const p of paras) { p.el.style.fontSize = fs + 'px'; p.el.style.lineHeight = '1.8'; p.el.style.marginBottom = (narrow ? 16 : 20) + 'px'; }
    title.style.fontSize = (narrow ? 22 : 26) + 'px';
    if (narrow) {
      band = Math.round(Math.min(250, W * 0.6));
      Object.assign(figs_el.style, { left: '12px', right: '12px', top: '12px', height: band + 'px' });
      Object.assign(scroll.style, { left: '0', right: '0', top: (band + 24) + 'px', bottom: '0' });
      text.style.margin = '0 20px 0 22px';
    } else {
      const fw = Math.min(400, W * 0.36), tw = Math.min(560, W - fw - 120), x0 = Math.round((W - fw - tw - 56) / 2);
      Object.assign(scroll.style, { left: x0 + 'px', width: (tw + 24) + 'px', top: '0', bottom: '0' });
      text.style.margin = '0 0 0 24px';
      Object.assign(figs_el.style, { left: (x0 + tw + 80) + 'px', width: fw + 'px', top: Math.round(H * 0.1) + 'px', height: Math.round(H * 0.8) + 'px' });
    }
    text.style.paddingTop = (narrow ? 8 : Math.round(H * 0.14)) + 'px';
    text.style.paddingBottom = Math.round(scroll.clientHeight * 0.55) + 'px';
    update(true);
  }
  // the eye line: high on the view at the top of the page, low at its end, so each paragraph gets its turn
  function eye() {
    const max = Math.max(1, scroll.scrollHeight - scroll.clientHeight), f = Math.min(1, scroll.scrollTop / max);
    return scroll.scrollTop + scroll.clientHeight * (0.22 + 0.5 * f);
  }
  function focused() {
    if (hover >= 0) return hover;
    const e = eye(); let best = 0, bd = 1e9;
    paras.forEach((p, i) => { const t = p.el.offsetTop, b = t + p.el.offsetHeight, d = e < t ? t - e : e > b ? e - b : 0; if (d < bd - 1e-6) { bd = d; best = i; } });
    return best;
  }
  function update(snap) {
    focus_i = focused();
    paras.forEach((p, i) => { p.k.to(i === focus_i ? 1 : 0); if (snap) p.k.snap(p.k.target); });
    for (const id in figs) { figs[id].k.to(id === paras[focus_i].ref ? 1 : 0); if (snap) figs[id].k.snap(figs[id].k.target); }
    const el = paras[focus_i].el; bar_top.to(el.offsetTop + 6); bar_bot.to(el.offsetTop + el.offsetHeight - 6);
    if (snap) { bar_top.snap(bar_top.target); bar_bot.snap(bar_bot.target); }
    sched.wake();
  }
  scroll.addEventListener('scroll', () => { hover = -1; update(); }, { passive: true });
  function colour_of(p) { return mix(FLOOR_RGB, INK, Math.max(0, Math.min(1, p.k.x))); }
  function render() {
    for (const p of paras) p.el.style.color = rgb(colour_of(p));
    bar.style.transform = `translateX(-16px) translateY(${bar_top.x.toFixed(1)}px)`; bar.style.height = Math.max(0, bar_bot.x - bar_top.x).toFixed(1) + 'px';
    // the figure column: the open one takes the room, the others wait as small proofs
    const ids = ['A', 'B', 'C'], ks = ids.map((id) => Math.max(0, figs[id].k.x));
    const box = figs_el.getBoundingClientRect(), gap = 12;
    if (!narrow) {
      const small = Math.min(96, box.height * 0.16), big = box.height - 2 * small - 2 * gap, sum = ks.reduce((a, b) => a + b, 0) || 1;
      let y = 0;
      ids.forEach((id, i) => { const h = small + (big - small) * ks[i] / Math.max(1, sum); place(figs[id], 0, y, box.width, h, ks[i]); y += h + gap; });
    } else {
      // phone: the open figure fills the band; the other two stand beside it, stacked
      const thumb = Math.round(box.width * 0.24), bigw = box.width - thumb - gap, order = ids.slice().sort((a, b) => figs[b].k.x - figs[a].k.x);
      // positions interpolate by each figure's openness, so a swap is a slide, not a jump
      let ty = 0; const th = (box.height - gap) / 2;
      ids.forEach((id, i) => {
        const k = ks[i], rank = order.indexOf(id), sx = bigw + gap, sy = rank === 0 ? 0 : (rank - 1) * (th + gap);
        place(figs[id], sx * (1 - k), sy * (1 - k), thumb + (bigw - thumb) * k, th + (box.height - th) * k, k);
        ty += th;
      });
    }
    hud.innerHTML = `<b>${focus_i + 1}</b> / ${paras.length}`;
  }
  function place(f, x, y, w, h, k) {
    Object.assign(f.el.style, { left: x.toFixed(1) + 'px', top: y.toFixed(1) + 'px', width: w.toFixed(1) + 'px', right: 'auto', height: h.toFixed(1) + 'px' });
    f.marks.style.opacity = (FIG_ALPHA + (1 - FIG_ALPHA) * k).toFixed(3);
    f.labels.style.opacity = Math.max(0, k * 1.4 - 0.4).toFixed(3);
    f.cap.style.opacity = Math.max(0, k * 1.6 - 0.6).toFixed(3);
    f.tick.style.opacity = k.toFixed(3);
    f.svg.style.inset = k > 0.5 ? '' : `6px`; f.svg.style.height = `calc(100% - ${(12 + 22 * k).toFixed(1)}px)`; f.svg.style.width = 'calc(100% - 12px)';
  }
  const sched = scheduler((dt) => { let b = false; for (const p of paras) b = p.k.step(dt) || b; for (const id in figs) b = figs[id].k.step(dt) || b; b = bar_top.step(dt) || b; b = bar_bot.step(dt) || b; render(); return b; });
  // scroll to a paragraph on a spring (the demo, and a tap on a waiting figure)
  let glide = null;
  function go_to(i) {
    const el = paras[i].el, max = scroll.scrollHeight - scroll.clientHeight;
    // the scroll position whose eye line sits in the paragraph's middle: solve s + v(0.22 + 0.5 s / max) = mid
    const mid = el.offsetTop + el.offsetHeight / 2, v = scroll.clientHeight, s = Math.max(0, Math.min(max, (mid - 0.22 * v) / (1 + 0.5 * v / max)));
    const S = new Spring(scroll.scrollTop, 0.7, 1).to(s);
    if (glide) glide.stop = true; const g = glide = { stop: false };
    let last = performance.now();
    const tick = (t) => { if (g.stop) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; const busy = S.step(dt); scroll.scrollTop = S.x; if (busy) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  fit(); render();
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { fit(); render(); },
    demo() { let i = 0; const next = () => { i++; if (i < paras.length) { go_to(i); setTimeout(next, 1300); } }; setTimeout(next, 200); },
    go: go_to,
    async accept() {
      const max = scroll.scrollHeight - scroll.clientHeight, N = 48, s0 = scroll.scrollTop;
      let one = 0, worst = 99, fig_ok = 0, fig_worst = 99, visits = new Set();
      for (let q = 0; q <= N; q++) {
        scroll.scrollTop = max * q / N; hover = -1; update();
        // mid-transition (6 frames in) and settled: every paragraph's ink and every figure's marks against the floor
        for (const steps of [6, 90]) {
          for (let s = 0; s < steps; s++) { for (const p of paras) p.k.step(1 / 60); for (const id in figs) figs[id].k.step(1 / 60); }
          render();
          for (const p of paras) { const c = getComputedStyle(p.el).color.match(/[\d.]+/g).slice(0, 3).map(Number); worst = Math.min(worst, contrast(c, PAPER)); }
          for (const id in figs) { const a = +figs[id].marks.style.opacity; for (const c of FIG_INKS) fig_worst = Math.min(fig_worst, contrast(mix(PAPER, hex(c), a), PAPER)); }
        }
        const inked = paras.filter((p) => Math.abs(p.k.x - 1) < 1e-3).length;
        if (inked === 1 && paras.filter((p) => p.k.target === 1).length === 1) one++;
        const open = Object.keys(figs).filter((id) => figs[id].k.x > 0.999);
        if (open.length === 1 && open[0] === paras[focus_i].ref) fig_ok++;
        visits.add(focus_i);
      }
      scroll.scrollTop = s0; update(true); render();
      const pass = one === N + 1 && fig_ok === N + 1 && worst >= FLOOR && fig_worst >= FIG_FLOOR && visits.size === paras.length;
      return { pass, value: zh ? `${N + 1} 个位置各恰一段在焦点 ${one}/${N + 1}；每段都轮到 ${visits.size}/${paras.length}；正文最低 ${worst.toFixed(2)} : 1，图最低 ${fig_worst.toFixed(2)} : 1；图对应 ${fig_ok}/${N + 1}` : `exactly one in focus at ${one}/${N + 1} positions; every paragraph reached ${visits.size}/${paras.length}; text never below ${worst.toFixed(2)} : 1, figures ${fig_worst.toFixed(2)} : 1; right figure ${fig_ok}/${N + 1}` };
    },
  };
}
