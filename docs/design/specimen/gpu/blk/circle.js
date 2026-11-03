// The unit circle and its wave. Turn the angle θ: the point’s height on the circle is sin θ, carried straight across to
// the wave at the same height. The arc the point has travelled is laid flat along the wave’s axis, the same length,
// which is what a radian means: the axis is measured in radius-lengths of arc. The cosine is the point’s other shadow,
// across. Drag the point round the circle, or along the wave. As a building block: circle_wave(θ, { cos, unroll }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { num, text, sym, tint, glass_bead, drags, TICK } from '../lib/plot.js';

export const meta = {
  id: 'circle',
  name: { zh: '单位圆与波', en: 'The unit circle and its wave' },
  means: { zh: '转动角度 θ：点在圆上的高度就是 sin θ，水平地带到右边同样高度的波上。点走过的那段弧被摊平在波的横轴上，长度一样，这就是弧度的意思：横轴用半径那么长的弧来量。余弦是点的另一个影子，横着的。拖动圆上的点，或者沿着波拖。', en: 'Turn θ: the point’s height on the circle is sin θ, carried across to the wave at the same height. The arc it has travelled is laid flat along the wave’s axis, the same length, which is what a radian means. The cosine is the point’s other shadow, across. Drag round the circle or along the wave.' },
  test: { zh: '200 个角度：波上的点与圆上的点一样高（误差 < 10⁻⁹ px）；摊平的弧与圆上的弧一样长（< 10⁻⁴ px）；横轴上 π 正好在半个圆周长处', en: 'At 200 angles the wave’s point is level with the circle’s (to 10⁻⁹ px); the laid-flat arc is as long as the arc (to 10⁻⁴ px); π on the axis is exactly half a circumference along' },
  wide: true,
  aspect: '16 / 7',
};

const TAU = Math.PI * 2;

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const th = new Spring(1.0, 0.45, 0.9), lift = new Spring(0);
  // one length for both: the radius in px is one unit on the wave's axis too
  const geo = () => { const { W, H } = cv, r = Math.min((H - 80) / 2.4, (W - 80) / (2.4 + TAU + 0.6)); return { r, cx: 30 + 1.2 * r, cy: H / 2 + 8, x0: 30 + 2.4 * r + 0.45 * r }; };
  const wave_x = (G, t) => G.x0 + t * G.r;

  function draw() {
    const { W, H } = cv, G = geo(), t = ((th.x % TAU) + TAU) % TAU, px = G.cx + Math.cos(t) * G.r, py = G.cy - Math.sin(t) * G.r;
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the circle and its axes (scaffolding)
    g.strokeStyle = GR(0.45); g.lineWidth = 1;
    g.beginPath(); g.moveTo(G.cx - 1.2 * G.r, G.cy); g.lineTo(G.x0 + TAU * G.r + 14, G.cy); g.moveTo(G.cx, G.cy - 1.2 * G.r); g.lineTo(G.cx, G.cy + 1.2 * G.r); g.moveTo(G.x0, G.cy - 1.2 * G.r); g.lineTo(G.x0, G.cy + 1.2 * G.r); g.stroke();
    g.strokeStyle = GR(0.6); g.beginPath(); g.arc(G.cx, G.cy, G.r, 0, TAU); g.stroke();
    // the arc travelled, and the same length laid flat along the wave's axis
    g.strokeStyle = C.cobalt; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.arc(G.cx, G.cy, G.r, 0, -t, true); g.stroke();
    g.beginPath(); g.moveTo(G.x0, G.cy); g.lineTo(wave_x(G, t), G.cy); g.stroke();
    // π/2 marks along the axis
    for (let k = 1; k <= 4; k++) { const x = wave_x(G, k * Math.PI / 2); g.strokeStyle = GR(0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(x, G.cy); g.lineTo(x, G.cy + 5); g.stroke(); text(g, ['π/2', 'π', '3π/2', '2π'][k - 1], x, G.cy + 19, { size: 12, color: TICK, align: 'center', font: 'serif', italic: true, halo: 3 }); }
    // the wave: drawn as far as θ, faint beyond
    for (const [a, b, col, w] of [[t, TAU, tint(C.teal, 0.35), 1.4], [0, t, C.teal, 2.2]]) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      const n = Math.max(2, Math.ceil((b - a) * 40)); for (let i = 0; i <= n; i++) { const u = a + (b - a) * i / n, q = [wave_x(G, u), G.cy - Math.sin(u) * G.r]; i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
      g.stroke();
    }
    // the two shadows: sin straight down, cos across; the height carried to the wave
    g.lineCap = 'butt';
    g.strokeStyle = C.teal; g.lineWidth = 2.4; g.beginPath(); g.moveTo(px, G.cy); g.lineTo(px, py); g.stroke();
    g.strokeStyle = C.violet; g.lineWidth = 2.4; g.beginPath(); g.moveTo(G.cx, G.cy); g.lineTo(px, G.cy); g.stroke();
    g.strokeStyle = GR(0.5); g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(px, py); g.lineTo(wave_x(G, t), py); g.stroke(); g.setLineDash([]);
    g.strokeStyle = GR(0.45); g.beginPath(); g.moveTo(G.cx, G.cy); g.lineTo(px, py); g.stroke();
    const wx = wave_x(G, t); g.fillStyle = C.teal; g.beginPath(); g.arc(wx, py, 4.2, 0, TAU); g.fill();
    glass_bead(g, px, py, 11, lift.x, { dir: -t + Math.PI / 2, core: C.cobalt });
    // the numbers
    let tx = 22; const ty = 36;
    tx += sym(g, 'θ', tx, ty, { size: 18 }); tx += text(g, ' = ' + num(t, 2) + '    ', tx, ty, { size: 15, tabular: true });
    tx += text(g, 'sin', tx, ty, { size: 15, color: C.teal, font: 'serif' }); tx += sym(g, ' θ', tx, ty, { size: 17, color: C.teal }); tx += text(g, ' = ' + num(Math.sin(t), 2) + '    ', tx, ty, { size: 15, tabular: true, color: C.teal, weight: 600 });
    tx += text(g, 'cos', tx, ty, { size: 15, color: C.violet, font: 'serif' }); tx += sym(g, ' θ', tx, ty, { size: 17, color: C.violet }); text(g, ' = ' + num(Math.cos(t), 2), tx, ty, { size: 15, tabular: true, color: C.violet, weight: 600 });
  }

  const hold = drags(canvas, () => {
    const G = geo(), t = ((th.x % TAU) + TAU) % TAU, px = G.cx + Math.cos(t) * G.r, py = G.cy - Math.sin(t) * G.r, wx = wave_x(G, t), wy = G.cy - Math.sin(t) * G.r;
    const set = (v) => th.snap(Math.max(0, Math.min(TAU - 1e-9, v)));
    return [
      { hit: (x, y) => { const d = Math.hypot(x - px, y - py); return d < 24 ? d : Infinity; }, down() { lift.to(1); }, up() { lift.to(0); }, move: (x, y) => { const a = Math.atan2(G.cy - y, x - G.cx); set(a < 0 ? a + TAU : a); } },
      { hit: (x, y) => { const d = Math.hypot(x - wx, y - wy); return d < 18 ? d : Math.abs(y - G.cy) < 1.2 * G.r && x > G.x0 && x < G.x0 + TAU * G.r ? 60 : Infinity; }, down: (x) => set((x - G.x0) / G.r), move: (x) => set((x - G.x0) / G.r) },
    ];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [th.step(dt), lift.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { th.to(TAU - 0.01); sched.wake(3000); },
    async accept() {
      const G = geo(); let level = 0, arc = 0;
      for (let i = 0; i < 200; i++) {
        const t = i / 200 * TAU, cy = G.cy - Math.sin(t) * G.r, wy = G.cy - Math.sin((wave_x(G, t) - G.x0) / G.r) * G.r;
        level = Math.max(level, Math.abs(cy - wy));
        // the arc's length in px (summed along the circle) against the flat segment's
        let L = 0; const n = 20000; for (let k = 0; k < n; k++) { const a = t * k / n, b = t * (k + 1) / n; L += Math.hypot(Math.cos(b) - Math.cos(a), Math.sin(b) - Math.sin(a)) * G.r; }
        arc = Math.max(arc, Math.abs(L - (wave_x(G, t) - G.x0)));
      }
      const pi_at = wave_x(G, Math.PI) - G.x0, half = Math.PI * G.r;
      const pass = level < 1e-9 && arc < 1e-4 && Math.abs(pi_at - half) < 1e-9;
      return { pass, value: zh ? `高度误差 ${level.toExponential(1)} px；弧长误差 ${arc.toExponential(1)} px；π 处 = 半个圆周 ${Math.abs(pi_at - half) < 1e-9 ? '✓' : '✗'}` : `height error ${level.toExponential(1)} px; arc length error ${arc.toExponential(1)} px; π at half a circumference ${Math.abs(pi_at - half) < 1e-9 ? '✓' : '✗'}` };
    },
  };
}
