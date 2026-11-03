// The one sample page every interface material sits on: MPC lesson 4, "when a constraint is active". Two forms:
// lesson_page draws it on a canvas (content under glass, focus or ink); lesson_dom builds it in the DOM, so that
// every word, term and part of the figure is an element with a box the tutor can point at.
import { C, SANS, SERIF, roundrect } from './ui.js';

// ——— drawn on a canvas ———
const TEXT = {
  zh: {
    kicker: '模型预测控制 · 第 4 课',
    title: '约束起作用的时候',
    p1: [['把这颗', 0], ['球', 'cobalt'], ['放开，它会停在哪儿？代价是一座山谷，', 0], ['墙', 'ochre'], ['挡在谷底和你之间。', 0]],
    p2: '球滚下来，被墙挡住，再沿着墙滑到最低的地方停下。从正上方看，山谷变成一圈圈等高线；水从谷底涨起来，第一次碰到允许区域的地方，就是最好的计划。',
    p3: '碰到的那道墙，就是起作用的约束。它的乘子 λ 大于零；没碰到的边，λ 都是 0。',
    cap: '图 4.2　代价的等高线与墙',
    list: ['预测：三秒后卡车在哪儿', '代价：离目标多远、用力多猛', '约束：不能越过墙'],
    p4: '下一步，我们把这三件事写成一个二次规划，并让它每 0.1 秒解一次。',
  },
  en: {
    kicker: 'Model predictive control · Lesson 4',
    title: 'When a constraint is active',
    p1: [['Let go of the ', 0], ['ball', 'cobalt'], [': where will it stop? The cost is a valley, and a ', 0], ['wall', 'ochre'], [' stands between you and its bottom.', 0]],
    p2: 'The ball rolls down, meets the wall, and slides along it to the lowest point it can reach. Seen from above, the valley becomes level sets; water rising from the bottom first touches the allowed region at the best plan.',
    p3: 'The wall it touches is the active constraint. Its multiplier λ is positive; every edge it does not touch has λ = 0.',
    cap: 'Figure 4.2  Level sets of the cost, and the wall',
    list: ['Predict: where the cart is in three seconds', 'Cost: how far from the goal, how hard the push', 'Constraint: never past the wall'],
    p4: 'Next we write these three as a quadratic programme and solve it every 0.1 seconds.',
  },
};

// wrap a run of styled spans into lines of width w; returns [[{t, color}]]
function wrap(g, spans, w) {
  const lines = [[]]; let x = 0;
  for (const [t, col] of spans) {
    const units = /[　-鿿]/.test(t) ? [...t] : t.split(/(\s+)/);
    for (const u of units) {
      const uw = g.measureText(u).width;
      if (x + uw > w && x > 0 && u.trim()) { lines.push([]); x = 0; if (!u.trim()) continue; }
      lines[lines.length - 1].push({ t: u, col, x }); x += uw;
    }
  }
  return lines;
}

// a lesson page, w × h device pixels, scale = device pixels per CSS pixel
export function lesson_page(w, h, lang = 'zh', o = {}) {
  const T = TEXT[lang], cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), s = o.scale || 1, pad = Math.max(24 * s, w * 0.07), col = Math.min(w - 2 * pad, 640 * s);
  g.fillStyle = C.paper; g.fillRect(0, 0, w, h);
  let y = (w / s < 600 ? 92 : 56) * s;
  const x0 = o.center ? (w - col) / 2 : pad;
  g.textBaseline = 'alphabetic';
  g.font = `500 ${13 * s}px ${SANS}`; g.fillStyle = C.graphite; g.fillText(T.kicker, x0, y); y += 40 * s;
  g.font = `600 ${32 * s}px ${SANS}`; g.fillStyle = C.ink; g.fillText(T.title, x0, y); y += 40 * s;
  const para = (spans, size = 18, lh = 1.75, color = C.ink) => {
    g.font = `${size * s}px ${SERIF}`;
    for (const line of wrap(g, typeof spans === 'string' ? [[spans, 0]] : spans, col)) {
      for (const u of line) { g.fillStyle = u.col ? C[u.col] : color; if (u.col) g.font = `600 ${size * s}px ${SERIF}`; else g.font = `${size * s}px ${SERIF}`; g.fillText(u.t, x0 + u.x, y); }
      y += size * lh * s;
    }
    y += 10 * s;
  };
  para(T.p1);
  // the figure: level sets, the wall, the ball
  const fh = Math.min(300 * s, col * 0.55), fx = x0, fy = y;
  g.fillStyle = '#f3f1ec'; roundrect(g, fx, fy, col, fh, 10 * s); g.fill();
  g.save(); g.beginPath(); roundrect(g, fx, fy, col, fh, 10 * s); g.clip();
  const cx = fx + col * 0.68, cy = fy + fh * 0.42;
  for (let k = 9; k >= 1; k--) {
    g.beginPath(); g.ellipse(cx, cy, k * col * 0.055, k * col * 0.032, -0.45, 0, Math.PI * 2);
    g.fillStyle = `rgba(47,91,210,${0.018 + (10 - k) * 0.006})`; g.fill();
    g.strokeStyle = k % 3 ? 'rgba(26,27,31,.22)' : 'rgba(26,27,31,.5)'; g.lineWidth = (k % 3 ? 1 : 1.6) * s; g.stroke();
  }
  g.beginPath(); g.moveTo(fx + col * 0.30, fy - 4); g.lineTo(fx + col * 0.62, fy + fh + 4); g.strokeStyle = C.ochre; g.lineWidth = 5 * s; g.stroke();
  g.fillStyle = 'rgba(141,145,152,.18)'; g.beginPath(); g.moveTo(fx + col * 0.30 + 3 * s, fy - 4); g.lineTo(fx + col, fy - 4); g.lineTo(fx + col, fy + fh + 4); g.lineTo(fx + col * 0.62 + 3 * s, fy + fh + 4); g.fill();
  const bx = fx + col * 0.465, by = fy + fh * 0.52;
  const grd = g.createRadialGradient(bx - 4 * s, by - 5 * s, 1, bx, by, 12 * s); grd.addColorStop(0, '#7f9ff0'); grd.addColorStop(1, C.cobalt);
  g.beginPath(); g.arc(bx, by, 11 * s, 0, Math.PI * 2); g.fillStyle = grd; g.fill();
  g.font = `600 ${13 * s}px ${SANS}`; g.fillStyle = C.ochre; g.fillText(lang === 'zh' ? '墙' : 'wall', fx + col * 0.42, fy + fh * 0.2);
  g.fillStyle = C.ink2; g.fillText(lang === 'zh' ? '谷底' : 'bottom', cx - 14 * s, cy - 10 * s);
  g.restore();
  y = fy + fh + 26 * s;
  g.font = `${13 * s}px ${SANS}`; g.fillStyle = C.graphite; g.fillText(T.cap, x0, y); y += 34 * s;
  para(T.p2);
  // the formula
  g.font = `italic ${22 * s}px ${SERIF}`; g.fillStyle = C.ink;
  const f = lang === 'zh' ? 'min  ½ aᵀHa + gᵀa    使得  Ga ≤ b' : 'min  ½ aᵀHa + gᵀa    s.t.  Ga ≤ b';
  g.fillText(f, x0 + 24 * s, y + 6 * s); y += 46 * s;
  para(T.p3);
  g.font = `${17 * s}px ${SANS}`;
  T.list.forEach((t, i) => { g.fillStyle = [C.cobalt, C.viridian, C.ochre][i]; g.beginPath(); g.arc(x0 + 6 * s, y - 6 * s, 4 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = C.ink; g.fillText(t, x0 + 22 * s, y); y += 32 * s; });
  y += 14 * s;
  para(T.p4);
  // keep going down the page with more of the same rhythm, so long pages scroll
  while (y < h - 80 * s) { para(T.p2, 18, 1.75, C.ink2); if (y < h - 200 * s) para(T.p3, 18, 1.75, C.ink2); }
  return cv;
}

// ——— built in the DOM, every selectable piece an element ———
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
