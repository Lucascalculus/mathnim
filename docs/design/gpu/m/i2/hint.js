// I2 · A hint folded in layers. The hint is a strip of paper, roll-folded into a sealed packet. Its levels are
// printed on the inside, one per panel: a nudge, then the method, then a worked step. Drag the flap down and it
// unfolds along a crease that always lies on the perpendicular bisector of where the paper was and where your finger
// is, so the flap is exactly a mirror image and the paper you grabbed stays under your finger. Each unfold opens one
// panel; the opened creases stay on the paper and the packet grows longer, so the hint shows how much help was taken.
// Canvas 2D only.
import { scheduler } from '../../lib/gl.js';
import { Spring2 } from '../../lib/ui.js';
import { canvas2d, SANS, SERIF, tokens, no_start } from './_text.js';

export const meta = {
  id: 'hint',
  name: { zh: '层层折起的提示', en: 'A hint folded in layers' },
  means: { zh: '提示是一张折好的纸：往下拉开一折，多看到一层（点拨、思路、演算）；拉开的折痕留在纸上，记下你用了多少帮助。', en: 'A hint is a folded paper: pull down one fold and one more level shows (a nudge, the method, a worked step); the opened creases stay on the paper as a record of how much help you took.' },
  test: { zh: '露出的层数恰等于打开的折数（逐像素数出）；任何拖动中纸的面积守恒，翻起部分正是镜像，抓住的点留在手指下', en: 'The levels showing equal the folds opened (counted pixel by pixel); paper area is conserved through any drag, the flap is an exact mirror image, and the grabbed point stays under the finger' },
};

const TEXT = {
  zh: {
    q: '抛两枚均匀的硬币，至少一枚正面朝上的概率是多少？',
    levels: [['点拨', '反过来想：什么情况下，一枚正面都没有？'], ['思路', 'P(至少一枚正面) = 1 − P(两枚都是反面)'], ['演算', '两枚都是反面：½ × ½ = ¼，所以答案是 1 − ¼ = ¾。']],
  },
  en: {
    q: 'Toss two fair coins. What is the probability that at least one lands heads?',
    levels: [['nudge', 'Think backwards: when is there no head at all?'], ['method', 'P(at least one head) = 1 − P(both tails)'], ['worked step', 'Both tails: ½ × ½ = ¼, so the answer is 1 − ¼ = ¾.']],
  },
};

// geometry in paper coordinates: x across, s down the strip; panels are [j h, (j + 1) h]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
function clip(poly, m, n, keep_front) {
  // keep the part with (p − m)·n ≥ 0 (front) or ≤ 0
  const sg = keep_front ? 1 : -1, s = (p) => sg * ((p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1]), out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = s(a), sb = s(b);
    if (sa >= 0) out.push(a);
    if ((sa < 0) !== (sb < 0) && sa !== sb) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
const reflect = (p, m, n) => { const d = (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1]; return [p[0] - 2 * d * n[0], p[1] - 2 * d * n[1]]; };
const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

const FRONT = ['#fbfaf7', '#f7f5f0'], BACK = '#ece9e2', INK = '#1a1b1f', INK2 = '#44464d';

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', L = TEXT[lang], c2 = canvas2d(canvas), ctx = c2.ctx;
  let w = 400, h = 104, ox = 0, oy = 0, qy = 0, fs = 18, narrow = false;
  // state: k levels showing; a drag holds the grabbed paper point q and the finger f (a spring, so a release glides)
  const S = { k: 0, q: null, f: new Spring2(0, 0, 0.36, 0.86), dragging: false, done: null };
  const N = 3;   // levels; the strip has N + 1 panels (the last is the blank tail that seals it)

  function fit() {
    c2.fit(); const W = c2.W, H = c2.H; narrow = W < 560;
    w = Math.min(narrow ? W - 40 : 500, W - 40); fs = narrow ? 17 : 19;
    h = narrow ? 112 : 112;
    ox = Math.round((W - w) / 2);
    qy = narrow ? Math.round(H * 0.07) : Math.round(Math.max(40, (H - (N + 1) * h - 120) / 2));
    oy = qy + (narrow ? 104 : 92);
    rest();
  }
  // the flap at rest: the crease on the boundary of panels k and k + 1, the finger on the folded free edge
  function rest() { if (S.k >= N) { S.q = null; return; } const s = (S.k + 2) * h; S.q = [w / 2, s]; const r = [w / 2, S.k * h]; S.f.a.snap(r[0]); S.f.b.snap(r[1]); }
  // the crease of the current drag: the perpendicular bisector of q and f, kept inside the flap's own panel
  function crease(f) {
    const k = S.k, q = S.q, lo = (k + 1) * h, hi = (k + 2) * h;
    let fx = f[0], fy = Math.max(k * h, Math.min(2 * hi - q[1], f[1]));
    for (let it = 0; it < 40; it++) {
      const n0 = [q[0] - fx, q[1] - fy], L0 = Math.hypot(n0[0], n0[1]);
      if (L0 < 1e-9) break;
      const n = [n0[0] / L0, n0[1] / L0], m = [(q[0] + fx) / 2, (q[1] + fy) / 2];
      const sat = (x) => m[1] - (x - m[0]) * n[0] / n[1];
      if (n[1] > 0.2 && sat(0) >= lo - 1e-9 && sat(0) <= hi + 1e-9 && sat(w) >= lo - 1e-9 && sat(w) <= hi + 1e-9) return { m, n, f: [fx, fy] };
      fx = q[0] + (fx - q[0]) * 0.8;                     // too steep: straighten it
      if (it > 30) { fx = q[0]; }
    }
    const m = [(q[0] + fx) / 2, (q[1] + fy) / 2]; return { m, n: [0, 1], f: [q[0], fy] };
  }
  // every piece of paper that shows, bottom to top: [polygon in paper coords, kind, panel]
  function pieces() {
    const k = S.k, out = [];
    if (k >= N) { for (let j = 0; j <= N; j++) out.push([rect(0, j * h, w, (j + 1) * h), 'front', j]); return { out, cr: null }; }
    for (let j = 0; j <= k; j++) out.push([rect(0, j * h, w, (j + 1) * h), 'front', j]);
    const cr = crease([S.f.x, S.f.y]), B = rect(0, (k + 1) * h, w, (k + 2) * h);
    const flat = clip(B, cr.m, cr.n, false), flap = clip(B, cr.m, cr.n, true).map((p) => reflect(p, cr.m, cr.n));
    // the flat part of the flap's panel carries the next fold on it (the back of the panel after), or, on the tail, its front
    if (flat.length > 2) out.push([flat, k + 2 <= N ? 'back' : 'front', k + 1]);
    if (flap.length > 2) out.push([flap, 'flap', k + 1]);
    return { out, cr, flat, flap };
  }

  const P = (p) => [ox + p[0], oy + p[1]];
  const path = (poly) => { ctx.beginPath(); poly.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };
  // what is printed on a panel's front, in paper coordinates
  function print(j) {
    if (j >= N) {   // the tail: a small end mark
      ctx.fillStyle = 'rgba(26,27,31,.55)'; const [x, y] = P([w / 2, j * h + h / 2]); ctx.fillRect(x - 6, y - 0.75, 12, 1.5); return;
    }
    const [lab, txt] = L.levels[j], [x0, y0] = P([22, j * h]);
    ctx.font = `600 12.5px ${SANS}`; ctx.fillStyle = INK2; ctx.textBaseline = 'alphabetic';
    // the level's mark: as many small bars as its depth
    for (let i = 0; i <= j; i++) ctx.fillRect(x0 + i * 6, y0 + 22, 3, 10);
    ctx.fillText(lab, x0 + (j + 1) * 6 + 6, y0 + 32);
    ctx.font = `${fs}px ${SERIF}`; ctx.fillStyle = INK;
    wrap_text(txt, x0, y0 + 32 + fs * 1.7, w - 44, fs * 1.6);
  }
  function wrap_text(t, x, y, mw, lh) {
    const tk = tokens(t); let line = '', lw = 0, yy = y;
    const sp = ctx.measureText(' ').width;
    for (let i = 0; i < tk.length; i++) {
      const u = tk[i].t, uw = ctx.measureText(u).width, add = (tk[i - 1]?.sp ? sp : 0);
      if (lw + add + uw > mw && line && !no_start(u)) { ctx.fillText(line, x, yy); yy += lh; line = ''; lw = 0; }
      else if (line) { line += tk[i - 1]?.sp ? ' ' : ''; lw += add; }
      line += u; lw += uw;
    }
    if (line) ctx.fillText(line, x, yy);
  }
  function draw() {
    ctx.setTransform(c2.dpr, 0, 0, c2.dpr, 0, 0);
    ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, c2.W, c2.H);
    // the problem
    ctx.font = `500 ${narrow ? 19 : 21}px ${SERIF}`; ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
    wrap_text(L.q, ox, qy + 28, w, (narrow ? 19 : 21) * 1.6);
    const { out, cr, flap } = pieces();
    // the strip lies on the desk: one soft shadow under all the paper that is flat
    ctx.save(); ctx.shadowColor = 'rgba(26,27,31,.10)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3; ctx.beginPath();
    for (const [poly, kind] of out) if (kind !== 'flap') poly.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.fillStyle = '#fbfaf7'; ctx.fill('nonzero'); ctx.restore();
    for (const [poly, kind, j] of out) {
      if (kind === 'flap') continue;
      ctx.save(); path(poly); ctx.clip();
      ctx.fillStyle = kind === 'back' ? BACK : FRONT[j % 2]; ctx.fill();
      if (kind === 'front') print(j);
      ctx.restore();
    }
    // the creases already opened: a valley or a mountain, by turns, each a fine line with its shade on the far side
    const open = S.k >= N ? N : S.k + 1;
    for (let j = 1; j <= open; j++) {
      const s = j * h;
      ctx.save(); ctx.beginPath(); for (const [poly, kind] of out) if (kind !== 'flap') { poly.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); } ctx.clip();
      const [x0, y] = P([0, s]), valley = j % 2 === 1, g = ctx.createLinearGradient(0, y - 3, 0, y + 3);
      g.addColorStop(0, valley ? 'rgba(26,27,31,0)' : 'rgba(26,27,31,.035)'); g.addColorStop(0.5, 'rgba(26,27,31,.04)'); g.addColorStop(1, valley ? 'rgba(26,27,31,.035)' : 'rgba(26,27,31,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, y - 3, w, 6);
      ctx.fillStyle = valley ? 'rgba(26,27,31,.14)' : 'rgba(255,255,255,.9)'; ctx.fillRect(x0, y - 0.5, w, 1);
      ctx.fillStyle = valley ? 'rgba(255,255,255,.8)' : 'rgba(26,27,31,.12)'; ctx.fillRect(x0, y + 0.5, w, 1);
      ctx.restore();
    }
    // the flap: the panel's back, mirrored; it casts a shadow on what it covers, and is a little darker toward its crease
    if (flap && flap.length > 2) {
      ctx.save(); ctx.shadowColor = 'rgba(26,27,31,.16)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; path(flap); ctx.fillStyle = BACK; ctx.fill(); ctx.restore();
      ctx.save(); path(flap); ctx.clip();
      const [mx, my] = P(cr.m), g = ctx.createLinearGradient(mx, my, mx - cr.n[0] * 40, my - cr.n[1] * 40);
      g.addColorStop(0, 'rgba(26,27,31,.07)'); g.addColorStop(1, 'rgba(26,27,31,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, c2.W, c2.H);
      ctx.restore();
      path(flap); ctx.strokeStyle = 'rgba(26,27,31,.12)'; ctx.lineWidth = 1; ctx.stroke();
      // the folded edge shows the layers still inside: one fine edge per fold not yet opened
      const t = [-cr.n[1], cr.n[0]], ends = [0, w].map((x) => [x, cr.m[1] - (x - cr.m[0]) * cr.n[0] / cr.n[1]]);
      for (let i = 1; i < N - S.k; i++) {
        const o = 1.7 * i, [ax, ay] = P([ends[0][0] - cr.n[0] * o, ends[0][1] + cr.n[1] * 0 + o]), [bx, by] = P([ends[1][0] - cr.n[0] * o, ends[1][1] + o]);
        ctx.beginPath(); ctx.moveTo(ax + i * 0.8, ay); ctx.lineTo(bx - i * 0.8, by); ctx.strokeStyle = `rgba(26,27,31,${0.2 - i * 0.04})`; ctx.lineWidth = 1; ctx.stroke();
      }
      // the free edge (the far edge of the flap's panel, mirrored) carries a thumb cut where the hand goes
      // the thumb cut: a half-moon taken out of the free edge, showing the paper beneath
      const fe = reflect([S.q[0], (S.k + 2) * h], cr.m, cr.n), [ex, ey] = P(fe), a = Math.atan2(cr.n[1], cr.n[0]);
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.arc(ex, ey, 10, a - Math.PI / 2, a + Math.PI / 2); ctx.closePath(); ctx.fillStyle = FRONT[S.k % 2]; ctx.fill();
      ctx.beginPath(); ctx.arc(ex, ey, 10, a - Math.PI / 2, a + Math.PI / 2); ctx.strokeStyle = 'rgba(26,27,31,.2)'; ctx.lineWidth = 1; ctx.stroke();
    }
    hud.innerHTML = `<b>${S.k}</b> / ${N}`;
  }

  const sched = scheduler((dt) => {
    const b = S.f.step(dt);
    // a release glides to one of the two rests; reaching the open one opens the panel
    if (!S.dragging && S.done != null && !b) { if (S.done) { S.k++; rest(); } S.done = null; }
    draw(); return b || S.done != null;
  });
  // input: grab the flap anywhere; the paper point under the hand is q, and it stays under the hand
  const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  canvas.addEventListener('pointerdown', (e) => {
    if (S.k >= N) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left - ox, y = e.clientY - r.top - oy, { flap, cr } = pieces();
    if (!flap || !(inside(flap, x, y) || (Math.abs(y - S.k * h) < 22 && x > -10 && x < w + 10))) return;
    // the paper point under the finger, found by unfolding the finger's position through the current crease
    S.q = reflect([x, y], cr.m, cr.n); S.f.a.snap(x); S.f.b.snap(y); S.dragging = true; S.done = null;
    canvas.setPointerCapture(e.pointerId); sched.wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!S.dragging) return; const r = canvas.getBoundingClientRect();
    const c = crease([e.clientX - r.left - ox, e.clientY - r.top - oy]); S.f.to(c.f[0], c.f[1]); sched.wake();
  });
  const up = () => {
    if (!S.dragging) return; S.dragging = false;
    const cr = crease([S.f.x, S.f.y]), sc = cr.m[1] - (w / 2 - cr.m[0]) * cr.n[0] / cr.n[1];
    if (sc > (S.k + 1.38) * h) finish(); else { S.done = false; const s = (S.k + 1) * h; S.f.to(S.q[0], 2 * s - S.q[1]); }
    sched.wake(2000);
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.style.touchAction = 'none'; canvas.style.cursor = 'grab';
  // complete an unfold: the finger glides to where the grabbed point lies when the panel is flat
  function finish() { S.done = true; S.q = [S.q[0], S.q[1]]; S.f.to(S.q[0], 2 * (S.k + 2) * h - S.q[1]); sched.wake(2500); }
  fit(); draw();

  // a pick buffer: each panel's front in its own colour, drawn with the same pieces; counts what really shows
  function levels_showing() {
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w) + 2; cv.height = Math.ceil((N + 1) * h) + 2;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
    const { out } = pieces(), id = (j, kind) => kind === 'front' ? `rgb(${10 + j * 40},200,0)` : 'rgb(0,0,255)';
    for (const [poly, kind, j] of out) { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = id(j, kind); g.fill(); }
    const d = g.getImageData(0, 0, cv.width, cv.height).data, cnt = new Array(N + 1).fill(0);
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] === 200 && d[i + 2] === 0) { const j = Math.round((d[i] - 10) / 40); if (j >= 0 && j <= N) cnt[j]++; }
    let n = 0; for (let j = 0; j < N; j++) if (cnt[j] >= 0.98 * w * h) n++;
    return n;
  }
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { fit(); draw(); },
    demo() {
      // pull the first flap down by hand, a little to the side, and let it go past half way
      if (S.k >= N) return;
      const cr = pieces().cr, grab = [w * 0.62, S.k * h + 4]; S.q = reflect(grab, cr.m, cr.n); S.f.a.snap(grab[0]); S.f.b.snap(grab[1]);
      S.dragging = true; const end = [w * 0.66, S.k * h + 1.6 * h]; const c = crease(end); S.f.set(0.9, 1).to(c.f[0], c.f[1]); sched.wake(3000);
      setTimeout(() => { S.f.set(0.36, 0.86); up(); }, 900);
    },
    set(k, t = 0, dx = 0) {
      // k levels open and the next flap pulled a fraction t of the way, its finger dx to the side (for pictures)
      S.k = k; S.dragging = false; S.done = null; rest(); if (k < N && t > 0) { const f = [S.q[0] + dx, k * h + 2 * h * t]; const c = crease(f); S.f.a.snap(c.f[0]); S.f.b.snap(c.f[1]); } sched.wake(); draw();
    },
    async accept() {
      const k0 = S.k, rng = ((a) => () => (a = (a * 16807) % 2147483647) / 2147483647)(7);
      // area and mirror: random drags at every state, tilted or not
      let darea = 0, dfinger = 0, cases = 0;
      for (let k = 0; k < N; k++) for (let i = 0; i < 60; i++) {
        S.k = k; rest(); S.q = [w * (0.1 + 0.8 * rng()), (k + 1) * h + h * (0.3 + 0.7 * rng())];
        const f = [S.q[0] + (rng() - 0.5) * w * 0.5, k * h + rng() * 2 * h], c = crease(f); S.f.a.snap(c.f[0]); S.f.b.snap(c.f[1]);
        const { out, cr } = pieces(); const total = out.reduce((a, [p]) => a + area(p), 0);
        darea = Math.max(darea, Math.abs(total - w * (k + 2) * h) / (w * (k + 2) * h));
        dfinger = Math.max(dfinger, Math.hypot(...[0, 1].map((q) => reflect(S.q, cr.m, cr.n)[q] - c.f[q])));
        cases++;
      }
      // levels showing, counted in a pick buffer, at rest in every state and mid-way through each unfold
      const seen = [], mids = [];
      for (let k = 0; k <= N; k++) { S.k = k; rest(); seen.push(levels_showing()); if (k < N) { const s = (k + 2) * h; S.q = [w / 2, s]; const c = crease([w / 2, k * h + h * 0.8]); S.f.a.snap(c.f[0]); S.f.b.snap(c.f[1]); mids.push(levels_showing()); } }
      S.k = k0; rest(); draw();
      const levels_ok = seen.every((n, k) => n === k) && mids.every((n, k) => n === k);
      const pass = darea < 1e-9 && dfinger < 1e-9 && levels_ok;
      return { pass, value: zh ? `露出层数 ${seen.join(' → ')}（对 0 → 3 折）；${cases} 次拖动中面积误差 ${darea.toExponential(1)}，手指误差 ${dfinger.toExponential(1)} px` : `levels showing ${seen.join(' → ')} for folds 0 → 3; over ${cases} drags, area error ${darea.toExponential(1)}, finger error ${dfinger.toExponential(1)} px` };
    },
  };
}
