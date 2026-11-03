// D1 · A broad-nib pen. Any path is written by a chisel nib held at a fixed angle: the stroke is exactly the area the
// nib sweeps, so its width is w·|sin(direction − nib angle)| — thick going one way, hairline the other, as in
// calligraphy. Ink pools where the pen slows and at the ends of a stroke. Write with your finger; the pen writes
// a few curves by itself. Canvas 2D only.
// As a library primitive: Write(path) with a nib, for any path a lesson draws.
import { scheduler, fit2d } from '../lib/ui.js';

export const meta = {
  id: 'nib',
  name: { zh: '宽尖笔', en: 'A broad-nib pen' },
  means: { zh: '笔尖是一把小凿子，按固定角度握着：往一个方向走是粗笔画，往另一个方向是细线。笔慢的地方墨会积起来。', en: 'The nib is a small chisel held at a fixed angle: one direction makes a thick stroke, another a hairline. Ink pools where the pen slows.' },
  test: { zh: '在一个圆上实测笔画宽度 = w·|sin(方向 − 笔尖角)|（误差 < 1.5 像素）', en: 'Measured stroke width around a circle = w·|sin(direction − nib angle)| (within 1.5 px)' },
};

const NIB = 0.55;   // the nib's angle (about 31°), as a calligrapher holds it
function catmull(pts, n = 6) {
  // a smooth path through the points: Catmull–Rom, n samples per segment
  if (pts.length < 3) return pts.slice();
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)).concat([p1[2] + (p2[2] - p1[2]) * t])); }
  }
  out.push(pts[pts.length - 1]); return out;
}

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, w = 14;
  const strokes = [];   // each: { pts: [[x, y, t]], done }
  let auto = null, paper = null;
  function fit() {
    ({ W, H, dpr } = fit2d(canvas)); w = Math.max(10, Math.min(18, W / 60));
    // the paper's tooth, once
    paper = document.createElement('canvas'); paper.width = canvas.width; paper.height = canvas.height; const g = paper.getContext('2d'), img = g.createImageData(paper.width, paper.height);
    for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 6; img.data[i] = 251 + n; img.data[i + 1] = 250 + n; img.data[i + 2] = 247 + n; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  }
  // the nib's two corners at a point
  const corners = (p) => { const hx = Math.cos(NIB) * w / 2, hy = -Math.sin(NIB) * w / 2; return [[p[0] - hx, p[1] - hy], [p[0] + hx, p[1] + hy]]; };
  function ink(pts) {
    if (pts.length < 2) return;
    const P = catmull(pts);
    ctx.fillStyle = 'rgba(22,23,28,0.94)';
    // the swept area: for each step, the quadrilateral the nib covers (and its two triangles' union)
    ctx.beginPath();
    for (let i = 1; i < P.length; i++) {
      const [a0, a1] = corners(P[i - 1]), [b0, b1] = corners(P[i]);
      ctx.moveTo(...a0); ctx.lineTo(...a1); ctx.lineTo(...b1); ctx.lineTo(...b0); ctx.closePath();
    }
    ctx.fill('nonzero');
    // ink pools where the pen slowed, and at both ends
    for (let i = 1; i < P.length; i++) {
      const v = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]) / Math.max(1e-3, P[i][2] - P[i - 1][2]);
      const pool = Math.max(0, 1 - v / 600) * 0.06 + (i < 4 || i > P.length - 5 ? 0.05 : 0);
      if (pool > 0.01) { const [a0, a1] = corners(P[i - 1]), [b0, b1] = corners(P[i]); ctx.fillStyle = `rgba(10,10,14,${pool})`; ctx.beginPath(); ctx.moveTo(...a0); ctx.lineTo(...a1); ctx.lineTo(...b1); ctx.lineTo(...b0); ctx.fill(); }
    }
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(paper, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // faint guide rules, as on writing paper
    ctx.strokeStyle = 'rgba(26,27,31,.07)'; ctx.lineWidth = 1; for (let y = H * 0.2; y < H; y += Math.max(48, H / 7)) { ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(W - 24, y); ctx.stroke(); }
    for (const s of strokes) ink(s.pts);
    // the nib itself, where the pen is
    const cur = strokes[strokes.length - 1];
    if (cur && !cur.done && cur.pts.length) { const p = cur.pts[cur.pts.length - 1], [a, b] = corners(p); ctx.strokeStyle = 'rgba(26,27,31,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
  }
  // the pen writes a few curves by itself: a lemniscate, a spiral, a wave
  function script() {
    const cx = W / 2, cy = H / 2, s = Math.min(W, H) * 0.3, paths = [];
    paths.push(Array.from({ length: 140 }, (_, i) => { const t = i / 139 * 2 * Math.PI; const d = 1 + Math.sin(t) ** 2; return [cx - s * 0.75 + s * 0.62 * Math.cos(t) / d, cy - s * 0.15 + s * 0.62 * Math.sin(t) * Math.cos(t) / d]; }));
    paths.push(Array.from({ length: 160 }, (_, i) => { const t = i / 159 * 4.6 * Math.PI; const r = s * 0.035 * t; return [cx + s * 0.6 + r * Math.cos(t), cy - s * 0.2 + r * Math.sin(t)]; }));
    paths.push(Array.from({ length: 160 }, (_, i) => { const t = i / 159; return [cx - s * 1.3 + t * s * 2.6, cy + s * 0.75 + Math.sin(t * Math.PI * 4) * s * 0.18]; }));
    return paths;
  }
  function play() { strokes.length = 0; auto = { paths: script(), i: 0, k: 0, t: 0 }; sched.wake(); }
  const sched = scheduler((dt) => {
    if (auto) {
      const path = auto.paths[auto.i]; if (!path) { auto = null; draw(); return false; }
      if (auto.k === 0) strokes.push({ pts: [], done: false });
      const s = strokes[strokes.length - 1];
      // the pen moves at a writer's pace: slower in tight curves
      for (let n = 0; n < 3 && auto.k < path.length; n++) { auto.t += 1 / 180; s.pts.push([path[auto.k][0], path[auto.k][1], auto.t]); auto.k++; }
      if (auto.k >= path.length) { s.done = true; auto.i++; auto.k = 0; }
    }
    draw(); return !!auto;
  });
  let writing = null;
  canvas.addEventListener('pointerdown', (e) => { auto = null; const r = canvas.getBoundingClientRect(); writing = { pts: [[e.clientX - r.left, e.clientY - r.top, performance.now() / 1000]], done: false }; strokes.push(writing); canvas.setPointerCapture(e.pointerId); draw(); });
  canvas.addEventListener('pointermove', (e) => { if (!writing) return; const r = canvas.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top, performance.now() / 1000], q = writing.pts[writing.pts.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 2) { writing.pts.push(p); draw(); } });
  canvas.addEventListener('pointerup', () => { if (writing) writing.done = true; writing = null; draw(); });
  canvas.addEventListener('dblclick', play);
  fit(); play();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); play(); },
    demo: play,
    async accept() {
      // write one circle, then measure the stroke's width across it at many angles
      const keep = strokes.splice(0); const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.3;
      strokes.push({ pts: Array.from({ length: 361 }, (_, i) => { const t = i / 360 * 2 * Math.PI; return [cx + R * Math.cos(t), cy + R * Math.sin(t), i]; }), done: true });
      draw();
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data, dark = (x, y) => { const i = (Math.round(y * dpr) * canvas.width + Math.round(x * dpr)) * 4; return img[i] < 128; };
      let worst = 0;
      for (let k = 0; k < 72; k++) {
        const t = k / 72 * 2 * Math.PI, nx = Math.cos(t), ny = Math.sin(t);
        // walk outward along the radius and measure the dark run
        let run = 0; for (let d = -w; d <= w; d += 0.25) if (dark(cx + (R + d) * nx, cy + (R + d) * ny)) run += 0.25;
        // the path's direction at angle t is perpendicular to the radius; the swept width along the radius:
        const dir = t + Math.PI / 2, expected = w * Math.abs(Math.sin(dir - (-NIB))) ;
        // measured along the radius = the nib's extent along the normal, which is w·|sin(direction − nib angle)|
        worst = Math.max(worst, Math.abs(run - expected));
      }
      strokes.length = 0; keep.forEach((s) => strokes.push(s)); draw();
      return { pass: worst < 1.5, value: `${zh ? '宽度最大误差' : 'largest width error'} ${worst.toFixed(2)} px (w = ${w.toFixed(1)} px)` };
    },
  };
}
