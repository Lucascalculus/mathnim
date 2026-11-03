// D2 · Paper that folds. Drag a card's corner: the card folds along the perpendicular bisector of the corner and your
// finger, so the corner lands exactly under the finger. The flap is the reflection of that part of the card in the
// crease; it shows the card's back and casts a shadow, and the part it uncovers shows what was printed underneath.
// Let go past half way and the card folds away; otherwise it springs back. Canvas 2D only.
// As a library primitive: a reveal for any hidden content, and a picture of reflection itself.
import { scheduler } from '../../lib/gl.js';
import { Spring2, SANS, SERIF } from '../../lib/ui.js';

export const meta = {
  id: 'fold',
  name: { zh: '会折的纸', en: 'Paper that folds' },
  means: { zh: '拖动卡片的角：纸沿着角和手指的中垂线折过来，折起的部分正好是它关于折痕的镜像；底下印着答案。', en: 'Drag a card\'s corner: it folds along the perpendicular bisector of the corner and your finger, the flap is exactly its mirror image in the crease, and underneath is the answer.' },
  test: { zh: '翻折后角落正好落在手指下（误差 < 10⁻⁹）；翻起部分的面积不变', en: 'The folded corner lands exactly under the finger (< 10⁻⁹); the flap keeps its area' },
};

const T = {
  zh: { q: '这个三角形的面积是多少？', a: '6 × 4 ÷ 2', r: '12', back: '答案在下面' },
  en: { q: 'What is the area of this triangle?', a: '6 × 4 ÷ 2', r: '12', back: 'the answer is underneath' },
};
// clip a polygon by the half-plane (x − m)·n ≤ 0 (Sutherland–Hodgman)
function clip(poly, m, n, keep_inside = true) {
  const s = (p) => ((p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1]) * (keep_inside ? 1 : -1), out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = s(a), sb = s(b);
    if (sa <= 0) out.push(a);
    if ((sa < 0) !== (sb < 0) && sa !== sb) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
const reflect = (p, m, n) => { const d = (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1]; return [p[0] - 2 * d * n[0], p[1] - 2 * d * n[1]]; };
const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
function rounded_rect(x, y, w, h, r, n = 8) {
  const P = [], c = [[x + w - r, y + h - r, 0], [x + r, y + h - r, 0.5], [x + r, y + r, 1], [x + w - r, y + r, 1.5]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= n; i++) { const a = (a0 + i / n * 0.5) * Math.PI; P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return P;
}

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d'), L = T[lang];
  let W = 0, H = 0, dpr = 1, card = null, rest = null;
  const S = { p: new Spring2(0, 0, 0.38, 0.8), dragging: false, folded: false };
  function fit() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height;
    const cw = Math.min(W - 48, 560), ch = Math.min(H - 80, cw * 0.62); card = { x: (W - cw) / 2, y: (H - ch) / 2, w: cw, h: ch };
    rest = [card.x + card.w, card.y + card.h]; S.p.a.snap(rest[0] - 0.01); S.p.b.snap(rest[1] - 0.01);
  }
  function front(g) {
    const { x, y, w, h } = card;
    g.fillStyle = '#1a1b1f'; g.font = `600 ${Math.max(17, w / 26)}px ${SANS}`; g.fillText(L.q, x + 28, y + 46);
    // the triangle, base 6 and height 4 on a faint grid
    const u = Math.min(w / 11, h / 6.5), ox = x + 40, oy = y + h - 34;
    g.strokeStyle = 'rgba(26,27,31,.1)'; g.lineWidth = 1; for (let i = 0; i <= 7; i++) { g.beginPath(); g.moveTo(ox + i * u, oy); g.lineTo(ox + i * u, oy - 4.5 * u); g.stroke(); } for (let j = 0; j <= 4; j++) { g.beginPath(); g.moveTo(ox, oy - j * u); g.lineTo(ox + 7 * u, oy - j * u); g.stroke(); }
    g.fillStyle = 'rgba(47,91,210,.16)'; g.strokeStyle = '#2f5bd2'; g.lineWidth = 2; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + 6 * u, oy); g.lineTo(ox + 2 * u, oy - 4 * u); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#44464d'; g.font = `14px ${SANS}`; g.fillText('6', ox + 3 * u - 4, oy + 18); g.fillText('4', ox + 2 * u + 8, oy - 2 * u);
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#efede8'; ctx.fillRect(0, 0, W, H);
    const R = rounded_rect(card.x, card.y, card.w, card.h, 14);
    // underneath the card: the answer, printed on the desk
    ctx.textAlign = 'right'; ctx.fillStyle = '#44464d'; ctx.font = `${Math.max(14, card.w / 34)}px ${SERIF}`; ctx.fillText(L.a, card.x + card.w - 24, card.y + card.h - Math.max(54, card.w / 9.5)); ctx.fillStyle = '#1a1b1f'; ctx.font = `600 ${Math.max(28, card.w / 14)}px ${SERIF}`; ctx.fillText(L.r, card.x + card.w - 24, card.y + card.h - 22); ctx.textAlign = 'left';
    const C = rest, P = [S.p.x, S.p.y], dx = C[0] - P[0], dy = C[1] - P[1], d = Math.hypot(dx, dy);
    let flat = R, flap = null, M = null, n = null;
    if (d > 0.5) {
      M = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2]; n = [dx / d, dy / d];
      flat = clip(R, M, n, true);                 // the part that stays
      const lifted = clip(R, M, n, false);        // the part that folds
      flap = lifted.map((p) => reflect(p, M, n));
    }
    const path = (P) => { ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); };
    // the card, with its soft shadow on the desk
    ctx.save(); ctx.shadowColor = 'rgba(26,27,31,.16)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; path(flat); ctx.fillStyle = '#fbfaf7'; ctx.fill(); ctx.restore();
    ctx.save(); path(flat); ctx.clip(); front(ctx);
    // the flap's shadow falls on the card near the crease
    if (flap) { ctx.shadowColor = 'rgba(26,27,31,.28)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = -n[0] * 4; ctx.shadowOffsetY = -n[1] * 4 + 3; path(flap); ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.globalCompositeOperation = 'source-atop'; ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
    if (flap && flap.length > 2) {
      // the back of the card: plain stock, lit brighter far from the crease (the paper curves near it)
      const far = reflect(C, M, n), g = ctx.createLinearGradient(M[0], M[1], far[0], far[1]);
      g.addColorStop(0, '#dedbd4'); g.addColorStop(0.25, '#f1efea'); g.addColorStop(1, '#f7f6f2');
      ctx.save(); ctx.shadowColor = 'rgba(26,27,31,.2)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; path(flap); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(26,27,31,.12)'; ctx.lineWidth = 0.75; path(flap); ctx.stroke();
      // the crease itself
      const ends = flap.filter((p) => Math.abs((p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1]) < 1e-6);
      if (ends.length >= 2) { ctx.strokeStyle = 'rgba(26,27,31,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...ends[0]); ctx.lineTo(...ends[ends.length - 1]); ctx.stroke(); }
    }
    G.flap = flap; G.M = M; G.n = n;
  }
  const G = {};
  const sched = scheduler((dt) => { const b = S.p.step(dt); draw(); return b || S.dragging; });
  canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; if (Math.hypot(x - S.p.x, y - S.p.y) < 60 || (x > card.x + card.w - 90 && y > card.y + card.h - 90)) { S.dragging = true; canvas.setPointerCapture(e.pointerId); S.p.to(x, y); sched.wake(); } });
  canvas.addEventListener('pointermove', (e) => { if (!S.dragging) return; const r = canvas.getBoundingClientRect(); S.p.to(e.clientX - r.left, e.clientY - r.top); sched.wake(); });
  canvas.addEventListener('pointerup', () => {
    if (!S.dragging) return; S.dragging = false;
    // past half way, the card folds right over to the opposite corner; otherwise it springs back
    const far = Math.hypot(S.p.x - rest[0], S.p.y - rest[1]) > Math.hypot(card.w, card.h) * 0.45;
    if (far) S.p.to(card.x, card.y); else S.p.to(rest[0] - 0.01, rest[1] - 0.01);
    sched.wake(1500);
  });
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { S.p.to(card.x + card.w * 0.52, card.y + card.h * 0.35); sched.wake(1500); },
    to(fx, fy) { S.p.a.snap(card.x + card.w * fx); S.p.b.snap(card.y + card.h * fy); draw(); },
    async accept() {
      let worst = 0, aerr = 0;
      for (const [fx, fy] of [[0.7, 0.6], [0.4, 0.3], [0.9, 0.2], [0.55, 0.85]]) {
        S.p.a.snap(card.x + card.w * fx); S.p.b.snap(card.y + card.h * fy); draw();
        const img = reflect(rest, G.M, G.n); worst = Math.max(worst, Math.hypot(img[0] - S.p.x, img[1] - S.p.y));
        const lifted = clip(rounded_rect(card.x, card.y, card.w, card.h, 14), G.M, G.n, false); aerr = Math.max(aerr, Math.abs(area(lifted) - area(G.flap)) / area(lifted));
      }
      S.p.a.snap(rest[0] - 0.01); S.p.b.snap(rest[1] - 0.01); draw();
      return { pass: worst < 1e-9 && aerr < 1e-9, value: `${zh ? '角落误差' : 'corner error'} ${worst.toExponential(1)} px; ${zh ? '面积误差' : 'area error'} ${aerr.toExponential(1)}` };
    },
  };
}
