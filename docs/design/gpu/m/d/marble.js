// D3 · Marbling. Drops of ink float on size and are combed into patterns, and every step is an exact, invertible map
// of the plane that keeps area (Jaffer & Lu, "Mathematical marbling"): a new drop of radius r at c pushes everything
// out by p ↦ c + (p − c)·√(1 + r²/|p − c|²); a comb stroke is a shear along its direction that fades with distance,
// p ↦ p + α·λ/(d + λ)·m. Outlines are kept exact under extreme stretching by subdividing edges before each map.
// Tap to drop ink; drag to comb. Canvas 2D only.
// As a library primitive: compose area-preserving maps on any shapes (flows, shears, mixing).
import { scheduler } from '../../lib/gl.js';

export const meta = {
  id: 'marble',
  name: { zh: '大理石纹', en: 'Marbling' },
  means: { zh: '每一滴墨、每一次梳，都是一个保面积的精确变换：图案再复杂，每块颜色的面积都没变。', en: 'Every drop and every stroke of the comb is an exact, area-preserving map: however intricate the pattern, no colour has gained or lost area.' },
  test: { zh: '梳过 6 次、再滴 3 滴后，每块旧颜色的面积变化 < 0.5%', en: 'After six comb strokes and three more drops, every earlier colour\'s area changes by < 0.5 %' },
  wide: true,
};

const PIGS = ['#2f5bd2', '#c8861a', '#fbfaf7', '#e3472c', '#1a1b1f', '#11899e', '#fbfaf7', '#6a4ec4'];
const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, drops = [], ci = 0, grain = null;
  function fit() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height;
    grain = document.createElement('canvas'); grain.width = canvas.width; grain.height = canvas.height; const g = grain.getContext('2d'), img = g.createImageData(grain.width, grain.height);
    for (let i = 0; i < img.data.length; i += 4) { const n = Math.random() * 18; img.data[i] = img.data[i + 1] = img.data[i + 2] = 128; img.data[i + 3] = n; }
    g.putImageData(img, 0, 0);
  }
  // apply a map to every outline, inserting points first wherever the map would stretch an edge beyond 2 px
  function apply(f) {
    for (const d of drops) {
      let P = d.pts;
      for (let pass_ = 0; pass_ < 4; pass_++) {
        const out = []; let added = 0;
        for (let i = 0; i < P.length; i++) {
          const a = P[i], b = P[(i + 1) % P.length]; out.push(a);
          const fa = f(a), fb = f(b);
          if (Math.hypot(fa[0] - fb[0], fa[1] - fb[1]) > 2.2) { out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); added++; }
        }
        P = out; if (!added) break;
      }
      d.pts = P.map(f);
    }
  }
  function drop(c, r, color) {
    apply((p) => { const dx = p[0] - c[0], dy = p[1] - c[1], s = Math.sqrt(1 + (r * r) / Math.max(1e-9, dx * dx + dy * dy)); return [c[0] + dx * s, c[1] + dy * s]; });
    const n = Math.max(48, Math.round(2 * Math.PI * r / 2));
    drops.push({ color, pts: Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos(i / n * 2 * Math.PI), c[1] + r * Math.sin(i / n * 2 * Math.PI)]) });
  }
  // a comb tine through b along unit m, strength α, falloff λ
  function tine(b, m, alpha, lambda = 22) {
    const nx = -m[1], ny = m[0];
    apply((p) => { const d = Math.abs((p[0] - b[0]) * nx + (p[1] - b[1]) * ny), k = alpha * lambda / (d + lambda); return [p[0] + k * m[0], p[1] + k * m[1]]; });
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e9ecea'; ctx.fillRect(0, 0, W, H);   // the size bath, pale
    for (const d of drops) { ctx.beginPath(); d.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = d.color; ctx.globalAlpha = 0.93; ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grain, 0, 0); ctx.globalCompositeOperation = 'source-over';
    const nv = drops.reduce((a, d) => a + d.pts.length, 0); hud.innerHTML = `${drops.length} ${zh ? '滴' : 'drops'} · ${nv} ${zh ? '个点' : 'points'}`;
  }
  // the traditional way: a stone ground of drops thrown over the whole tray, a gel-git comb back and forth, then a
  // fine nonpareil comb across
  function classic() {
    drops = []; ci = 0; const R = Math.min(W, H);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const cols = ['#2f5bd2', '#fbfaf7', '#c8861a', '#1a1b1f', '#fbfaf7', '#11899e', '#e3472c', '#fbfaf7'];
    for (let k = 0; k < 120; k++) drop([rnd() * W, rnd() * H], R * (0.06 + rnd() * 0.06), cols[k % cols.length]);
    for (let i = 0, x = W / 28; x < W; x += W / 14, i++) tine([x, 0], [0, i % 2 ? 1 : -1], H * 0.16, 10);
    for (let y = H / 40; y < H; y += H / 20) tine([0, y], [1, 0], W * 0.035, 6);
    draw();
  }
  const sched = scheduler(() => { draw(); return false; });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(); drag = { p: [e.clientX - r.left, e.clientY - r.top], moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return; const r = canvas.getBoundingClientRect(), q = [e.clientX - r.left, e.clientY - r.top], dx = q[0] - drag.p[0], dy = q[1] - drag.p[1], L = Math.hypot(dx, dy);
    if (L < 6) return; drag.moved = true; tine(drag.p, [dx / L, dy / L], L * 0.9); drag.p = q; sched.wake();
  });
  canvas.addEventListener('pointerup', () => { if (drag && !drag.moved) { drop(drag.p, Math.min(W, H) * (0.04 + Math.random() * 0.04), PIGS[ci++ % PIGS.length]); sched.wake(); } drag = null; });
  canvas.addEventListener('dblclick', classic);
  fit(); classic();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); classic(); },
    demo: classic,
    async accept() {
      // combing is a shear: every outline keeps its area
      const before = drops.map((d) => area(d.pts));
      for (let k = 0; k < 6; k++) tine([W * (0.1 + k * 0.15), 0], [Math.cos(1 + k), Math.sin(1 + k)], 40, 20);
      let worst = 0; drops.forEach((d, i) => { worst = Math.max(worst, Math.abs(area(d.pts) / before[i] - 1)); });
      // a new drop of area πr² grows every outline that encloses it by exactly πr² and leaves the others alone
      const inside = (P, c) => { let k = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > c[1]) !== (b[1] > c[1]) && c[0] < (b[0] - a[0]) * (c[1] - a[1]) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
      for (let k = 0; k < 3; k++) {
        const c = [W * (0.3 + k * 0.2), H * 0.5], r = 30, pre = drops.map((d) => [area(d.pts), inside(d.pts, c)]), n0 = drops.length;
        drop(c, r, PIGS[k]);
        for (let i = 0; i < n0; i++) { const expect = pre[i][0] + (pre[i][1] ? Math.PI * r * r : 0); worst = Math.max(worst, Math.abs(area(drops[i].pts) / expect - 1)); }
      }
      draw();
      return { pass: worst < 0.005, value: `${zh ? '面积最大变化' : 'largest area change'} ${(worst * 100).toFixed(3)}%` };
    },
  };
}
