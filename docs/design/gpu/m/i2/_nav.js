// Shared pieces for the navigation-and-tutor materials (tutor, stars, lasso, reason, deck): a CSS injector, a
// 2D canvas fitted to its box, geometry (point in polygon, boxes), and one real lesson page built in the DOM so
// that every word, term and part of the figure is an element with a box the tutor can point at or a loop can catch.
import { C, SANS, SERIF } from '../../lib/ui.js';

export { C, SANS, SERIF };

export function css(id, text) {
  if (document.getElementById(id)) return;
  const st = document.createElement('style'); st.id = id; st.textContent = text; document.head.append(st);
}

// a 2D canvas sized to its CSS box at the device ratio; returns {ctx, W, H, dpr, fit()}
export function canvas2d(cv) {
  const o = { ctx: cv.getContext('2d'), W: 0, H: 0, dpr: 1 };
  o.fit = () => {
    const r = cv.getBoundingClientRect(); o.dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.max(2, Math.round(r.width * o.dpr)); cv.height = Math.max(2, Math.round(r.height * o.dpr)); o.W = r.width; o.H = r.height;
    o.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  };
  o.fit();
  return o;
}

// an element's box in the coordinates of a container (CSS px)
export function box_in(el, wrap) {
  const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  return { x: r.left - w.left, y: r.top - w.top, w: r.width, h: r.height, cx: r.left - w.left + r.width / 2, cy: r.top - w.top + r.height / 2 };
}
export const inside_box = (b, x, y, pad = 0) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;

// even–odd ray casting
export function in_poly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// winding number, an independent second opinion for the tests
export function winding(poly, x, y) {
  let w = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const side = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
    if (ay <= y) { if (by > y && side > 0) w++; } else if (by <= y && side < 0) w--;
  }
  return w;
}
export function poly_len(p, closed = true) { let s = 0; for (let i = 0; i < p.length - (closed ? 0 : 1); i++) { const a = p[i], b = p[(i + 1) % p.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; }
export function poly_area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
// n points evenly spaced by arc length along a closed polygon
export function resample(p, n) {
  const L = poly_len(p), out = []; let seg = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const d = k * L / n;
    while (seg < p.length && acc + seg_len(p, seg) < d) { acc += seg_len(p, seg); seg++; }
    const a = p[seg % p.length], b = p[(seg + 1) % p.length], l = seg_len(p, seg) || 1, t = (d - acc) / l;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}
const seg_len = (p, i) => { const a = p[i % p.length], b = p[(i + 1) % p.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); };

// ——— the lesson page (MPC lesson 4), every selectable piece an element ———
// zh text is pre-cut into words with '|'; English is cut at spaces
const PAGE = {
  zh: {
    kick: '模型预测控制 · 第 4 课', title: '约束起作用的时候',
    p1: '把|球|放开，|它会|沿着|山谷|滚下去。|可是|谷底|在|墙|的|另一边，|球|到不了。',
    cap: '图 4.2　从正上方看代价的山谷',
    p2: '球|被|墙|挡住，|停在|墙|边。|这道|墙|就是|起作用的约束|：|它的|乘子|λ|大于零。',
    f: [['min', 'op'], ['½ aᵀHa', 't', 'H'], ['+', 'op'], ['gᵀa', 't', 'g'], ['使得', 'op'], ['Ga ≤ b', 't', 'G']],
    parts: { valley: '山谷', bottom: '谷底', wall: '墙', ball: '球' },
  },
  en: {
    kick: 'Model predictive control · Lesson 4', title: 'When a constraint is active',
    p1: 'Let go of the ball and it rolls down the valley. But the bottom is on the far side of the wall.',
    cap: 'Figure 4.2  The valley of the cost, seen from above',
    p2: 'The wall stops the ball, and it rests against it. That wall is the active constraint: its multiplier λ is positive.',
    f: [['min', 'op'], ['½ aᵀHa', 't', 'H'], ['+', 'op'], ['gᵀa', 't', 'g'], ['s.t.', 'op'], ['Ga ≤ b', 't', 'G']],
    parts: { valley: 'valley', bottom: 'bottom', wall: 'wall', ball: 'ball' },
  },
};
// words that are nouns of the figure, coloured as in the figure
const NOUN = { zh: { 球: 'cobalt', 墙: 'ochre' }, en: { ball: 'cobalt', 'ball.': 'cobalt', wall: 'ochre', 'wall.': 'ochre' } };

export const PAGE_CSS = `
.nv-page{position:absolute;font-family:${SERIF};color:${C.ink}}
.nv-kick{font:500 13px ${SANS};color:#62666d;letter-spacing:.01em}
.nv-title{font:600 28px/1.25 ${SANS};margin:10px 0 14px;letter-spacing:-.01em}
.nv-p{font-size:18px;line-height:1.8;margin:0 0 12px}
.nv-w{white-space:pre-wrap}
.nv-w.cobalt{color:${C.cobalt};font-weight:600}.nv-w.ochre{color:${C.ochre};font-weight:600}
.nv-fig{margin:6px 0 4px;position:relative}
.nv-fig svg{display:block;width:100%;height:auto;overflow:visible}
.nv-cap{font:13px ${SANS};color:#62666d;margin:2px 0 14px}
.nv-f{font:italic 21px ${SERIF};margin:2px 0 14px 18px;white-space:nowrap}
.nv-f span{display:inline-block;margin-right:.42em}
.nv-f .op{font-style:normal;font-size:.9em}
.nv-page.small .nv-title{font-size:23px;margin:8px 0 10px}
.nv-page.small .nv-p{font-size:16px;line-height:1.75;margin-bottom:8px}
.nv-page.small .nv-f{font-size:18px;margin-left:4px}
.nv-page.small .nv-cap{margin-bottom:8px}
`;

const FIG = (names) => `<svg viewBox="0 0 560 230">
  <defs><clipPath id="nv-clip"><rect x="0" y="0" width="560" height="230" rx="10"/></clipPath></defs>
  <rect x="0" y="0" width="560" height="230" rx="10" fill="#f3f1ec"/>
  <g clip-path="url(#nv-clip)">
  <g class="valley">${Array.from({ length: 7 }, (_, i) => { const k = 7 - i; return `<ellipse cx="392" cy="104" rx="${k * 25}" ry="${k * 14.5}" transform="rotate(-24 392 104)" fill="rgba(47,91,210,${(0.016 + i * 0.007).toFixed(3)})" stroke="rgba(26,27,31,${k % 3 ? 0.2 : 0.42})" stroke-width="${k % 3 ? 1 : 1.5}"/>`; }).join('')}</g>
  <g data-sel="bottom" data-name="${names.bottom}"><circle cx="392" cy="104" r="3.5" fill="#1a1b1f"/><text x="402" y="96" font-family='${SANS}' font-size="14" fill="#44464d">${names.bottom}</text></g>
  <path d="M206 -4 L320 234 L564 234 L564 -4 Z" fill="rgba(141,145,152,.13)"/>
  <g data-sel="wall" data-name="${names.wall}"><line x1="203" y1="-2" x2="317" y2="232" stroke="${C.ochre}" stroke-width="5" stroke-linecap="round"/><text x="196" y="40" text-anchor="end" font-family='${SANS}' font-weight="600" font-size="14" fill="${C.ochre}">${names.wall}</text></g>
  <g data-sel="ball" data-name="${names.ball}"><circle cx="248" cy="124" r="12" fill="${C.cobalt}"/><circle cx="244" cy="120" r="4" fill="rgba(255,255,255,.35)"/></g>
  </g>
</svg>`;

// builds the page into `host`; returns {el, sels: [{id, kind, name, el}], ref(id) → element}
export function lesson_dom(host, lang, o = {}) {
  const T = PAGE[lang], N = NOUN[lang];
  const el = document.createElement('div'); el.className = 'nv-page' + (o.small ? ' small' : '');
  const words = (s, pid) => (lang === 'zh' ? s.split('|') : s.split(/(?<= )/)).map((w, i) => {
    const key = w.trim().replace(/[，。：,.:]$/, '');
    const c = N[w.trim()] || N[key] || '';
    // the space after an English word stays outside its box, so a box is just the word
    // and a coloured noun takes its colour, not the comma after it
    const tail = w.length - w.trimEnd().length ? ' ' : '', t = w.trimEnd(), m = c ? t.match(/^(.*?)([，。：,.:]*)$/) : [t, t, ''];
    return `<span class="nv-w ${c}" data-sel="${pid}-${i}" data-kind="word" data-name="${key}">${m[1]}</span>${m[2]}${tail}`;
  }).join('');
  el.innerHTML = `<div class="nv-kick">${T.kick}</div><div class="nv-title">${T.title}</div>
    <p class="nv-p">${words(T.p1, 'a')}</p>
    <div class="nv-fig">${FIG(T.parts)}</div><div class="nv-cap">${T.cap}</div>
    <p class="nv-p">${words(T.p2, 'b')}</p>
    <div class="nv-f">${T.f.map(([t, k, id], i) => `<span class="${k}" ${k === 't' ? `data-sel="f-${id}" data-kind="term" data-name="${t}"` : ''}>${t}</span>`).join('')}</div>`;
  host.append(el);
  const sels = [...el.querySelectorAll('[data-sel]')].map((e) => ({ id: e.dataset.sel, kind: e.dataset.kind || 'part', name: e.dataset.name, el: e }));
  return { el, sels, ref: (id) => el.querySelector(`[data-sel="${id}"]`), find: (name) => sels.find((s) => s.name === name) };
}
