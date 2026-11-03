// A thread of reasoning. The steps of an argument are beads on one thread. The thread is pinned at the top (what we
// assume), runs through every step, and the conclusion hangs at its end, held exactly at its place by the path the
// thread takes through the steps. Pull a step out and the thread above it goes slack, then runs through and the
// conclusion drops: it no longer holds. Put the step back and it catches the thread, carries it home, and the
// conclusion is lifted back to its seat. The thread is a real rope (Verlet, fixed length) sliding freely through
// each bead, so what you see is physics, not an animation.
// As a library primitive: thread(steps, conclusion) for any derivation or proof.
import { scheduler } from '../../lib/gl.js';
import { Spring, Spring2 } from '../../lib/ui.js';
import { css, canvas2d, C, SANS, SERIF } from './_nav.js';

export const meta = {
  id: 'reason',
  name: { zh: '推理是一根线', en: 'A thread of reasoning' },
  means: { zh: '论证的每一步是穿在同一根线上的珠子，结论挂在线的末端；抽掉一步，上面的线松下来，结论掉下去，不再成立；放回去，线又绷紧，把结论提回原位。', en: 'The steps of an argument are beads on one thread with the conclusion hanging at its end; pull a step out and the thread goes slack and the conclusion drops; put it back and the thread tightens and lifts it home.' },
  test: { zh: '在全部 16 种“有哪几步”的组合下：结论在原位 ⇔ 四步都在；线的总长守恒', en: 'Over all 16 combinations of steps present: the conclusion is at its seat ⇔ all four steps are there; the thread’s length is conserved' },
};

const TEXT = {
  zh: {
    given: '设 √2 = p/q，且 p/q 已是最简分数',
    steps: ['两边平方：p² = 2q²', '所以 p² 是偶数，p 也是偶数', '设 p = 2k，代入得 q² = 2k²', '所以 q 也是偶数'],
    end: 'p、q 都是偶数，与最简矛盾：√2 不是分数',
  },
  en: {
    given: 'Suppose √2 = p/q, in lowest terms',
    steps: ['Square both sides: p² = 2q²', 'So p² is even, and so is p', 'Write p = 2k: then q² = 2k²', 'So q is even too'],
    end: 'Both even, yet in lowest terms: so √2 is not a fraction',
  },
};

const CSS = `
.re-wrap{position:absolute;inset:0;background:${C.paper};overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.re-wrap canvas{position:absolute;inset:0;width:100%;height:100%}
`;

const SEG = 6, ITER = 36, GRAV = 1800, DAMP = 0.992, WMASS = 10, SUB = 1 / 240;

// the rope: particles, rest length per segment, eyelets it must pass through
function rope_make(points, n_seg) {
  // resample a polyline into n_seg + 1 particles evenly by length
  const L = points.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0), 0), l = L / n_seg;
  const P = []; let s = 0, k = 0;
  for (let i = 0; i <= n_seg; i++) {
    const d = i * l;
    while (k < points.length - 2 && s + Math.hypot(points[k + 1][0] - points[k][0], points[k + 1][1] - points[k][1]) < d) { s += Math.hypot(points[k + 1][0] - points[k][0], points[k + 1][1] - points[k][1]); k++; }
    const a = points[k], b = points[k + 1], sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = Math.min(1, (d - s) / sl);
    P.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return { x: P.map((p) => p.slice()), o: P.map((p) => p.slice()), l, n: n_seg + 1 };
}
// one substep: gravity, then constraints: length, the pin, the eyelets (each a point the rope must pass through)
function rope_step(R, h, pin, eyes, floor = 1e9) {
  const { x, o, n } = R, g = GRAV * h * h;
  // the thread itself is light (it sags only when slack); the conclusion at its end is what pulls it taut
  for (let i = 1; i < n; i++) { const vx = (x[i][0] - o[i][0]) * DAMP, vy = (x[i][1] - o[i][1]) * DAMP; o[i][0] = x[i][0]; o[i][1] = x[i][1]; x[i][0] += vx; x[i][1] += vy + g * (i === n - 1 ? 1 : 0.12); }
  const inv = (i) => (i === 0 ? 0 : i === n - 1 ? 1 / WMASS : 1);
  for (let it = 0; it < ITER; it++) {
    x[0][0] = pin[0]; x[0][1] = pin[1];
    for (let i = 0; i < n - 1; i++) {
      const a = x[i], b = x[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-9, wa = inv(i), wb = inv(i + 1), w = wa + wb; if (!w) continue;
      const c = (d - R.l) / d / w; a[0] += dx * c * wa; a[1] += dy * c * wa; b[0] -= dx * c * wb; b[1] -= dy * c * wb;
    }
    // a thread does not fold back on itself: neighbours two apart keep a little distance
    for (let i = 0; i < n - 2; i++) {
      const a = x[i], b = x[i + 2], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-9, m = 1.5 * R.l; if (d >= m) continue;
      const wa = inv(i), wb = inv(i + 2), w = wa + wb; if (!w) continue;
      const c = (d - m) / d / w * 0.5; a[0] += dx * c * wa; a[1] += dy * c * wa; b[0] -= dx * c * wb; b[1] -= dy * c * wb;
    }
    for (const e of eyes) {
      if (!e.on) continue;
      // the segment nearest the eyelet, searched near the last one so the rope slides through rather than jumping
      let best = e.seg, bd = Infinity;
      for (let j = Math.max(0, e.seg - 6); j <= Math.min(n - 2, e.seg + 6); j++) { const d = seg_dist(x[j], x[j + 1], e.p); if (d.d < bd) { bd = d.d; best = j; } }
      e.seg = best;
      const a = x[best], b = x[best + 1], { t } = seg_dist(a, b, e.p), cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t;
      const dx = e.p[0] - cx, dy = e.p[1] - cy, wa = inv(best) * (1 - t), wb = inv(best + 1) * t, s = wa * (1 - t) + wb * t; if (s < 1e-9) continue;
      a[0] += dx * wa / s; a[1] += dy * wa / s; b[0] += dx * wb / s; b[1] += dy * wb / s;
    }
    // the desk: whatever falls far enough lands on it
    for (let i = 1; i < n; i++) if (x[i][1] > floor) { x[i][1] = floor; o[i][0] = x[i][0] - (x[i][0] - o[i][0]) * 0.6; }
  }
}
function seg_dist(a, b, p) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return { t, d: Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]) };
}
const rope_len = (R) => { let s = 0; for (let i = 0; i < R.n - 1; i++) s += Math.hypot(R.x[i + 1][0] - R.x[i][0], R.x[i + 1][1] - R.x[i][1]); return s; };
const rope_energy = (R) => { let e = 0; for (let i = 1; i < R.n; i++) e += (R.x[i][0] - R.o[i][0]) ** 2 + (R.x[i][1] - R.o[i][1]) ** 2; return e; };

export function make({ stage, canvas, hud, lang }) {
  canvas.style.display = 'none';
  css('re-css', CSS);
  const T = TEXT[lang], zh = lang === 'zh';
  const wrap = document.createElement('div'); wrap.className = 're-wrap'; stage.append(wrap);
  const cv = document.createElement('canvas'); wrap.append(cv);
  const G = canvas2d(cv);

  let L = null, R = null, seat = [0, 0], rest_len = 0;
  const beads = T.steps.map((t, k) => ({ k, t, on: true, pos: new Spring2(0, 0, 0.42, 0.8), lift: new Spring(0, 0.3, 0.8), seg: 0, p: [0, 0], phase: 'in' }));
  const held = new Spring(1, 0.35, 1);

  // geometry: the thread's column at the left, the text to its right; on a phone both are narrower
  function geo() {
    const W = G.W, H = G.H, narrow = W < 600;
    const top = narrow ? 70 : Math.max(64, H * 0.1), gap = narrow ? Math.min(96, (H - 300) / 5.6) : Math.min(104, (H - 230) / 5.6);
    const ax = narrow ? 68 : Math.max(150, W * 0.5 - 250), d = narrow ? 34 : 48;
    const rows = [top, ...T.steps.map((_, k) => top + (k + 1) * gap)], seat_y = top + 5 * gap;
    return { narrow, W, H, ax, d, top, gap, rows, seat_y, tx: ax + d + (narrow ? 34 : 64), pin: [ax + d, top], floor: H - 30, slot: (k) => [ax + (k % 2 ? d : -d), rows[k + 1]], aside: (k) => [ax + d + (narrow ? 34 : 64) + (narrow ? 12 : 14), rows[k + 1]] };
  }
  function build() {
    L = geo();
    const pts = [L.pin, ...beads.map((b) => L.slot(b.k)), [L.slot(3)[0], L.seat_y]];
    const len = pts.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    R = rope_make(pts, Math.round(len / SEG));
    for (const b of beads) { const s = L.slot(b.k); b.on = true; b.phase = 'in'; b.pos.a.snap(s[0]); b.pos.b.snap(s[1]); b.lift.snap(0); b.p = s.slice(); }
    // the eyelets start on the segments they lie on
    for (const b of beads) { let best = 0, bd = Infinity; for (let j = 0; j < R.n - 1; j++) { const d = seg_dist(R.x[j], R.x[j + 1], b.p).d; if (d < bd) { bd = d; best = j; } } b.seg = best; }
    for (let i = 0; i < 400; i++) rope_step(R, SUB, L.pin, beads, L.floor);
    for (let i = 0; i < R.n; i++) R.o[i] = R.x[i].slice();
    seat = R.x[R.n - 1].slice(); rest_len = (R.n - 1) * R.l; held.snap(1);
  }
  const weight = () => R.x[R.n - 1];
  const holds = () => Math.hypot(weight()[0] - seat[0], weight()[1] - seat[1]) < 3;

  function draw() {
    const g = G.ctx, W = G.W, H = G.H; g.clearRect(0, 0, W, H); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const f = L.narrow ? 15 : 18, lh = f * 1.45, maxw = W - L.tx - (L.narrow ? 14 : 40);
    // the pin: what we assume
    g.fillStyle = C.ink; g.fillRect(L.pin[0] - 22, L.top - 3, 44, 3);
    // the seat: where the conclusion belongs
    const hk = Math.max(0, Math.min(1, held.x));
    g.setLineDash([3, 3]); g.strokeStyle = `rgba(26,27,31,${(0.5 * (1 - hk)).toFixed(3)})`; g.lineWidth = 1.4; g.beginPath(); g.arc(seat[0], seat[1], 15, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // the thread
    g.strokeStyle = C.ink; g.lineWidth = 1.5; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
    const X = R.x; g.moveTo(X[0][0], X[0][1]);
    for (let i = 1; i < R.n - 1; i++) { const mx = (X[i][0] + X[i + 1][0]) / 2, my = (X[i][1] + X[i + 1][1]) / 2; g.quadraticCurveTo(X[i][0], X[i][1], mx, my); }
    g.lineTo(X[R.n - 1][0], X[R.n - 1][1] - 15); g.stroke();
    // the beads
    for (const b of beads) {
      const l = Math.max(0, b.lift.x), r = L.narrow ? 12 : 14, [x, y] = [b.pos.x, b.pos.y - 3 * l];
      g.save();
      g.shadowColor = `rgba(26,27,31,${(0.10 + 0.16 * l).toFixed(3)})`; g.shadowBlur = 3 + 14 * l; g.shadowOffsetY = 1 + 7 * l;
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#ebe8e2');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore();
      g.strokeStyle = 'rgba(26,27,31,.42)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      // the hole the thread runs through, and the thread in it
      // a bead on the thread shows its hole; one taken off shows which step it is
      if (b.on) { g.fillStyle = C.ink; g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); continue; }
      g.fillStyle = C.ink2; g.font = `600 ${L.narrow ? 10 : 11}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(b.k + 1), x, y + 0.5); g.textAlign = 'left';
    }
    // the conclusion: solid while it holds, a hollow ring when it hangs without support
    const [wx, wy] = weight();
    g.fillStyle = C.paper; g.beginPath(); g.arc(wx, wy, 15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.arc(wx, wy, 15 - 1, 0, Math.PI * 2); g.stroke();
    if (hk > 0.01) { g.fillStyle = C.ink; g.beginPath(); g.arc(wx, wy, 15, 0, Math.PI * 2); g.arc(wx, wy, 15 * (1 - hk), 0, Math.PI * 2, true); g.fill(); }
    g.fillStyle = hk > 0.5 ? '#fff' : C.ink; g.font = `600 ${L.narrow ? 12 : 13}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('∴', wx, wy + 1); g.textAlign = 'left';
    // the text: each row level with its bead; a missing step is a dashed gap; the conclusion's words hang with it
    g.textBaseline = 'middle';
    const line = (t, x, y, alpha, weight_ = 400, dashed = false) => {
      g.font = `${weight_} ${f}px ${SERIF}`;
      const lines = wrap_text(g, t, maxw);
      const y0 = y - (lines.length - 1) * lh / 2;
      lines.forEach((s, i) => { g.globalAlpha = alpha; g.fillStyle = C.ink; g.fillText(s, x, y0 + i * lh); });
      if (dashed) { g.globalAlpha = 0.55; g.setLineDash([3, 4]); g.strokeStyle = C.ink2; g.lineWidth = 1; for (let i = 0; i < lines.length; i++) { const w = g.measureText(lines[i]).width; g.beginPath(); g.moveTo(x, y0 + i * lh + f * 0.62); g.lineTo(x + w, y0 + i * lh + f * 0.62); g.stroke(); } g.setLineDash([]); }
      g.globalAlpha = 1;
    };
    line(T.given, L.tx, L.top, 1, 400);
    // a step taken off the thread sits at the start of its own line, and the line makes room for it
    for (const b of beads) { const out = Math.max(0, Math.min(1, b.on ? 0 : 1 - Math.hypot(b.pos.x - L.aside(b.k)[0], b.pos.y - L.aside(b.k)[1]) / 120)); line(b.t, L.tx + out * (L.narrow ? 34 : 40), L.rows[b.k + 1], b.on ? 1 : 0.34, 400, !b.on); }
    line(T.end, Math.max(L.tx, wx + 30), wy, 0.4 + 0.6 * hk, 600);
  }
  function wrap_text(g, t, w) {
    const units = zh ? [...t] : t.split(/(?<= )/), out = [''];
    for (const u of units) { if (g.measureText(out[out.length - 1] + u).width > w && out[out.length - 1]) out.push(u.trimStart()); else out[out.length - 1] += u; }
    return out;
  }

  let quiet = 0;
  const sched = scheduler((dt) => {
    let busy = false;
    for (const b of beads) {
      busy = b.pos.step(dt) || busy; busy = b.lift.step(dt) || busy;
      // a bead going home slides under the thread, catches it at its own row, then carries it to its slot
      if (b.phase === 'catch' && !b.pos.a.busy() && !b.pos.b.busy()) { b.on = true; b.seg = nearest_seg(b.pos.x, b.pos.y); const s = L.slot(b.k); b.pos.to(s[0], s[1]); b.lift.to(0); b.phase = 'in'; busy = true; }
      b.p[0] = b.pos.x; b.p[1] = b.pos.y;
    }
    const n = Math.max(1, Math.round(dt / SUB));
    for (let i = 0; i < n; i++) rope_step(R, SUB, L.pin, beads, L.floor);
    held.to(holds() && beads.every((b) => b.on && b.phase === 'in') ? 1 : 0); busy = held.step(dt) || busy;
    const moving = rope_energy(R) > 1e-6;
    quiet = moving || busy ? 0 : quiet + 1;
    draw();
    return quiet < 3;
  });
  function nearest_seg(x, y) { let best = 0, bd = Infinity; for (let j = 0; j < R.n - 1; j++) { const d = seg_dist(R.x[j], R.x[j + 1], [x, y]).d; if (d < bd) { bd = d; best = j; } } return best; }
  function pull(k, to) {
    const b = beads[k]; if (!b.on && b.phase !== 'catch') return;
    b.on = false; b.phase = 'out'; b.lift.to(1);
    const a = to || L.aside(k); b.pos.to(a[0], a[1]); setTimeout(() => { if (b.phase === 'out' && !drag) { b.lift.to(0); sched.wake(); } }, 420);
    sched.wake(3000);
  }
  function put(k) {
    const b = beads[k]; if (b.on) return;
    // first to the thread at this row (above the paper, so it does not snag), then it catches it
    const y = L.rows[k + 1]; let bx = L.ax, by_ = y, bd = Infinity;
    for (let i = 0; i < R.n; i++) { const d = Math.abs(R.x[i][1] - y); if (d < bd) { bd = d; bx = R.x[i][0]; by_ = R.x[i][1]; } }
    b.phase = 'catch'; b.lift.to(1); b.pos.to(bx, by_); sched.wake(3000);
  }

  // input: drag a bead (or its line) out; drop it near home and it goes back in; a tap toggles
  let drag = null;
  const local = (e) => { const r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function pick(x, y) {
    for (const b of beads) if (Math.hypot(x - b.pos.x, y - b.pos.y) < 26) return b;
    for (const b of beads) if (x > L.tx - 20 && Math.abs(y - L.rows[b.k + 1]) < L.gap * 0.4) return b;
    return null;
  }
  wrap.addEventListener('pointerdown', (e) => {
    const [x, y] = local(e), b = pick(x, y); if (!b) return;
    wrap.setPointerCapture(e.pointerId); drag = { b, x0: x, y0: y, moved: false, on_bead: Math.hypot(x - b.pos.x, y - b.pos.y) < 26 };
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return; const [x, y] = local(e);
    if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) > 6 && drag.on_bead) { drag.moved = true; if (drag.b.on) { drag.b.on = false; drag.b.phase = 'out'; } drag.b.lift.to(1); drag.b.pos.set(0.12, 0.9); }
    if (drag.moved) { drag.b.pos.to(x, y); sched.wake(); }
  });
  wrap.addEventListener('pointerup', () => {
    if (!drag) return; const b = drag.b; b.pos.set(0.42, 0.8);
    if (!drag.moved) { if (b.on) pull(b.k); else put(b.k); }
    else { const s = L.slot(b.k); if (Math.hypot(b.pos.a.target - s[0], b.pos.b.target - s[1]) < 70 || Math.abs(b.pos.b.target - s[1]) < 30 && Math.abs(b.pos.a.target - L.ax) < L.d * 2.5) put(b.k); else { b.lift.to(0); sched.wake(); } }
    drag = null;
  });

  // the test: every combination of steps, settled offline on a copy of the rope
  function settle(mask) {
    const R2 = { x: R.x.map((p) => p.slice()), o: R.x.map((p) => p.slice()), l: R.l, n: R.n };
    // start from the full, seated rope; take away the missing steps and let it come to rest
    const R0 = rope_make([L.pin, ...beads.map((b) => L.slot(b.k)), [L.slot(3)[0], L.seat_y]], R.n - 1);
    R2.x = R0.x; R2.o = R0.x.map((p) => p.slice());
    const eyes = beads.map((b) => ({ on: true, p: L.slot(b.k), seg: 0 }));
    for (const e of eyes) e.seg = (() => { let best = 0, bd = Infinity; for (let j = 0; j < R2.n - 1; j++) { const d = seg_dist(R2.x[j], R2.x[j + 1], e.p).d; if (d < bd) { bd = d; best = j; } } return best; })();
    for (let i = 0; i < 300; i++) rope_step(R2, SUB, L.pin, eyes, L.floor);
    eyes.forEach((e, k) => { e.on = !!(mask & (1 << k)); });
    let steps = 0;
    for (; steps < 6000; steps++) { rope_step(R2, SUB, L.pin, eyes, L.floor); if (steps > 400 && steps % 50 === 0 && rope_energy(R2) < 1e-7) break; }
    const w = R2.x[R2.n - 1];
    return { at_seat: Math.hypot(w[0] - seat[0], w[1] - seat[1]) < 3, drop: w[1] - seat[1], len: rope_len(R2) };
  }

  function layout() { G.fit(); build(); draw(); }
  layout();
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { layout(); },
    demo: () => { pull(1); setTimeout(() => put(1), 2600); },
    pull, put,
    async accept() {
      let logic = 0, worst = 0, minDrop = Infinity;
      for (let m = 0; m < 16; m++) {
        const r = settle(m), all = m === 15;
        if (r.at_seat === all) logic++;
        if (!all) minDrop = Math.min(minDrop, r.drop);
        worst = Math.max(worst, Math.abs(r.len - rest_len) / rest_len);
      }
      const pass = logic === 16 && worst < 0.01;
      return { pass, value: zh ? `16 种组合中“结论在原位 ⇔ 四步都在”成立 ${logic}/16（少一步至少掉 ${minDrop.toFixed(0)} px）；线长最大偏差 ${(worst * 100).toFixed(2)} %` : `“at its seat ⇔ all four steps” holds in ${logic}/16 combinations (one step missing drops it ≥ ${minDrop.toFixed(0)} px); thread length off by at most ${(worst * 100).toFixed(2)} %` };
    },
  };
}
