// D5 · A thread between two things. A phrase in the text and its note are tied by a two-ply cord of fixed length
// (Verlet integration with length constraints). Slack, it hangs as a catenary; pull the note too far and the cord
// goes taut and holds it back, so a connection is something you can feel. Drag the note. Canvas 2D only.
// As a library primitive: tie(a, b) between any two objects on a page.
import { scheduler, SANS, SERIF, fit2d } from '../lib/ui.js';

export const meta = {
  id: 'thread',
  name: { zh: '一根线', en: 'A thread' },
  means: { zh: '一句话和它的注释之间系着一根线：松时自然下垂，拉远了就绷直，把注释拽住。', en: 'A sentence and its note are tied by a thread: slack, it hangs; pulled too far, it goes taut and holds the note back.' },
  test: { zh: '线长守恒（± 1%）；静止松弛时形状是悬链线（均方差 < 2 像素）', en: 'Length conserved (± 1 %); hanging slack, its shape is a catenary (RMS < 2 px)' },
};

const NP = 44;
const T = {
  zh: { text: ['碰到的那道墙，', '就是', '起作用的约束', '。'], note: '它的乘子 λ 大于零', sub: '其余的 λ 都是 0' },
  en: { text: ['The wall it touches is ', 'the', ' active constraint', '.'], note: 'its multiplier λ is positive', sub: 'every other λ is 0' },
};

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d'), L = T[lang];
  let W = 0, H = 0, dpr = 1, len = 0;
  const P = [], Q = [];   // positions and previous positions
  const card = { x: 0, y: 0, w: 230, h: 76, vx: 0, vy: 0, tx: 0, ty: 0 };
  let anchor = [0, 0], drag = null, still = 0;
  const text = document.createElement('div');
  text.style.cssText = `position:absolute;left:0;top:0;font-family:${SERIF};color:#1a1b1f;pointer-events:none;white-space:nowrap`;
  text.innerHTML = `${L.text[0]}${L.text[1]}<span class="hl" style="background:rgba(17,137,158,.18);border-radius:4px;padding:0 3px">${L.text[2]}</span>${L.text[3]}`;
  stage.append(text);
  const note = document.createElement('div');
  note.style.cssText = `position:absolute;left:0;top:0;width:${card.w}px;padding:14px 16px;border-radius:12px;background:#fff;font-family:${SANS};box-shadow:0 0 0 .75px rgba(26,27,31,.12),0 10px 24px rgba(26,27,31,.12);cursor:grab;touch-action:none`;
  note.innerHTML = `<div style="font-size:16px;font-weight:600;color:#1a1b1f">${L.note}</div><div style="font-size:13px;color:#62666d;margin-top:4px">${L.sub}</div>`;
  stage.append(note);
  // the cord lies on top of things, so its layer is above the note (and lets touches through to it)
  canvas.style.zIndex = '2'; canvas.style.pointerEvents = 'none'; note.style.zIndex = '1';
  canvas.style.background = 'transparent'; stage.style.background = '#fbfaf7';
  function fit() {
    ({ W, H, dpr } = fit2d(canvas));
    narrow = W < 560; text.style.fontSize = (narrow ? 19 : 24) + 'px';
    text.style.left = (narrow ? 20 : W * 0.1) + 'px'; text.style.top = (H * 0.2) + 'px';
    const hl = text.querySelector('.hl').getBoundingClientRect(), sr = stage.getBoundingClientRect();
    anchor = [hl.left - sr.left + hl.width / 2, hl.bottom - sr.top + 2];
    card.w = note.offsetWidth; card.h = note.offsetHeight;
    card.x = card.tx = narrow ? 16 : W * 0.58; card.y = card.ty = narrow ? H * 0.5 : H * 0.56;
    { const [ox, oy] = tie(); len = Math.hypot(card.x + ox - anchor[0], card.y + oy - anchor[1]) * 1.3; }
    for (let i = 0; i < NP; i++) { const t = i / (NP - 1); P[i] = [anchor[0] + (card.x + card.w / 2 - anchor[0]) * t, anchor[1] + (card.y - anchor[1]) * t + Math.sin(t * Math.PI) * 40]; Q[i] = P[i].slice(); }
  }
  // the cord is tied to the side of the note nearer the phrase
  let narrow = false;
  const end = () => narrow ? [card.x + card.w / 2, card.y] : [card.x + card.w / 2 < anchor[0] ? card.x + card.w : card.x, card.y + card.h / 2];
  const tie = () => { const e = end(); return [e[0] - card.x, e[1] - card.y]; };
  function physics(dt) {
    const g = 1400, seg = len / (NP - 1);
    for (let i = 1; i < NP - 1; i++) { const p = P[i], q = Q[i], vx = (p[0] - q[0]) * 0.985, vy = (p[1] - q[1]) * 0.985; Q[i] = p.slice(); p[0] += vx; p[1] += vy + g * dt * dt; }
    // the note follows the hand, but the cord will not stretch: if the hand pulls past its length, the note stops
    const [ox, oy] = tie(), dx = card.tx + ox - anchor[0], dy = card.ty + oy - anchor[1], d = Math.hypot(dx, dy);
    const k = d > len * 0.995 ? len * 0.995 / d : 1, gx = anchor[0] + dx * k - ox, gy = anchor[1] + dy * k - oy;
    card.x += (gx - card.x) * Math.min(1, dt * 18); card.y += (gy - card.y) * Math.min(1, dt * 18);
    P[0] = anchor.slice(); P[NP - 1] = end();
    for (let it = 0; it < 40; it++) {
      for (let i = 0; i < NP - 1; i++) {
        const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-9, diff = (d - seg) / d;
        const wa = i === 0 ? 0 : 0.5, wb = i + 1 === NP - 1 ? 0 : 0.5, s = wa + wb || 1;
        a[0] += dx * diff * wa / s; a[1] += dy * diff * wa / s; b[0] -= dx * diff * wb / s; b[1] -= dy * diff * wb / s;
      }
      P[0] = anchor.slice(); P[NP - 1] = end();
      // the cord cannot pass through the note: it drapes over its top edge
      for (let i = 1; i < NP - 3; i++) { const p = P[i]; if (p[0] > card.x - 2 && p[0] < card.x + card.w + 2 && p[1] > card.y - 3 && p[1] < card.y + card.h) p[1] = card.y - 3; }
    }
  }
  function cord(pts, shadow) {
    // a two-ply cord: a soft body, and short slanted strands along it that catch the light alternately
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
    if (shadow) { ctx.translate(3, 7); for (const [w, a] of [[9, 0.035], [6, 0.05], [3.5, 0.07]]) { path(); ctx.strokeStyle = `rgba(26,27,31,${a})`; ctx.lineWidth = w; ctx.stroke(); } ctx.restore(); return; }
    path(); ctx.strokeStyle = '#5f5141'; ctx.lineWidth = 4.4; ctx.stroke();
    path(); ctx.strokeStyle = '#94806a'; ctx.lineWidth = 3; ctx.stroke();
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
      for (let s = acc; s < d; s += 3.6) { const t = s / d, x = a[0] + dx * t, y = a[1] + dy * t, ux = dx / d, uy = dy / d, nx = -uy, ny = ux; ctx.strokeStyle = 'rgba(255,248,235,.5)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x - nx * 1.4 - ux * 0.9, y - ny * 1.4 - uy * 0.9); ctx.lineTo(x + nx * 1.4 + ux * 0.9, y + ny * 1.4 + uy * 0.9); ctx.stroke(); }
      acc = (acc - d) % 3.6; if (acc < 0) acc += 3.6;
    }
    ctx.restore();
  }
  function smooth(pts) { const out = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; out.push(a, [(a[0] * 3 + b[0]) / 4, (a[1] * 3 + b[1]) / 4], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [(a[0] + b[0] * 3) / 4, (a[1] + b[1] * 3) / 4]); } out.push(pts[pts.length - 1]); return out; }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const S = smooth(P); cord(S, true); cord(S, false);
    // the knots: a small loop at each end
    for (const p of [P[0], P[NP - 1]]) { ctx.fillStyle = '#7b6a55'; ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2); ctx.fill(); }
    note.style.transform = `translate(${card.x}px, ${card.y}px)`;
    const used = P.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0), taut = Math.hypot(end()[0] - anchor[0], end()[1] - anchor[1]) / len;
    hud.innerHTML = taut > 0.97 ? (zh ? '<b>绷直了</b>' : '<b>taut</b>') : (zh ? '松着' : 'slack');
  }
  const sched = scheduler((dt) => { for (let i = 0; i < 2; i++) physics(1 / 120); draw(); const mv = P.reduce((a, p, i) => a + Math.hypot(p[0] - Q[i][0], p[1] - Q[i][1]), 0); still = mv < 0.05 ? still + 1 : 0; return still < 30 || !!drag; });
  note.addEventListener('pointerdown', (e) => { drag = { x: e.clientX - card.tx, y: e.clientY - card.ty }; note.setPointerCapture(e.pointerId); note.style.cursor = 'grabbing'; sched.wake(); });
  note.addEventListener('pointermove', (e) => { if (!drag) return; card.tx = e.clientX - drag.x; card.ty = e.clientY - drag.y; sched.wake(); });
  note.addEventListener('pointerup', () => { drag = null; note.style.cursor = 'grab'; sched.wake(1500); });
  fit(); for (let i = 0; i < 600; i++) physics(1 / 120); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); for (let i = 0; i < 600; i++) physics(1 / 120); draw(); },
    demo() { card.tx = W * 0.85; card.ty = H * 0.25; sched.wake(2500); },
    pull(fx, fy) { card.tx = W * fx; card.ty = H * fy; for (let i = 0; i < 900; i++) physics(1 / 120); draw(); },
    async accept() {
      // settle slack, then compare with the catenary through both ends of the same length
      // a known placement: the note below and to the side of the phrase, well short of the cord's length
      // tied at the side and placed beside the phrase, the cord hangs free of the note (no contact)
      const keep_narrow = narrow; narrow = false;
      const keep_w = card.w; if (W < 560) { note.style.width = '140px'; card.w = note.offsetWidth; card.h = note.offsetHeight; }
      const right = W - anchor[0] > anchor[0], room = right ? W - 8 - card.w - anchor[0] : anchor[0] - 8 - card.w;
      const dx = Math.max(40, Math.min(len * 0.6, room)), dy = Math.sqrt(Math.max(0, (len * 0.75) ** 2 - dx * dx));
      card.tx = right ? anchor[0] + dx : anchor[0] - dx - card.w; card.ty = anchor[1] + dy - card.h / 2;
      for (let i = 0; i < 4000; i++) physics(1 / 120);
      const used = P.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0), lerr = Math.abs(used / len - 1);
      // catenary y = a·cosh((x − x0)/a) + c through both ends with arc length len: solve for a, x0, c
      let [x1, y1] = P[0], [x2, y2] = P[NP - 1]; if (x2 < x1) [x1, y1, x2, y2] = [x2, y2, x1, y1];
      const h = x2 - x1, v = y2 - y1;
      let lo = 1, hi = 1e5; for (let i = 0; i < 200; i++) { const a = Math.sqrt(lo * hi), f = 2 * a * Math.sinh(h / (2 * a)) - Math.sqrt(len * len - v * v); if (f > 0) lo = a; else hi = a; }
      // in "up" coordinates (Y = −y) the hanging cord is Y = a·cosh((x − xm)/a) + c
      const a = Math.sqrt(lo * hi), xm = x1 + h / 2 - a * Math.atanh(-v / len), c = -y1 - a * Math.cosh((x1 - xm) / a);
      let se = 0; for (const p of P) { const yc = -(c + a * Math.cosh((p[0] - xm) / a)); se += (p[1] - yc) ** 2; }
      const rms = Math.sqrt(se / NP); narrow = keep_narrow; note.style.width = keep_w + 'px'; fit(); for (let i = 0; i < 600; i++) physics(1 / 120); draw();
      return { pass: lerr < 0.01 && rms < 2, value: `${zh ? '长度误差' : 'length error'} ${(lerr * 100).toFixed(2)}%; ${zh ? '与悬链线均方差' : 'RMS from the catenary'} ${rms.toFixed(2)} px` };
    },
  };
}
