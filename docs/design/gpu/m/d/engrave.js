// D4 · Engraving. A sphere drawn only with lines, as on a banknote: hatching follows the circles of latitude around a
// tilted axis, and each line is as wide as its share of darkness, so the ink covering any small area is exactly
// 1 − I, where I is the true Lambert brightness under the one light (line width = (1 − I) × the local spacing between
// lines, which narrows toward the limb). In deep shade a second family of lines crosses the first. Its shadow on the
// table is engraved too. Drag to move the light. Canvas 2D only.
// As a library primitive: an engraved shading style for any 3D form a lesson shows in 2D.
import { scheduler } from '../../lib/gl.js';

export const meta = {
  id: 'engrave',
  name: { zh: '铜版雕刻', en: 'Engraving' },
  means: { zh: '只用线画出明暗：每条线的粗细恰好是那里的暗度，所以一小块里墨的比例 = 1 − 亮度。', en: 'Light and shade from lines alone: each line is as thick as the darkness there, so the ink in any small area = 1 − brightness.' },
  test: { zh: '球面上小窗口里的墨覆盖率 = 1 − 朗伯亮度（误差 < 6%）', en: 'Ink coverage in small windows on the sphere = 1 − Lambert brightness (within 6 %)' },
};

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, dpr = 1;
  const S = { lx: -0.55, ly: -0.62 };
  // (each family covers c of its own area; crossing families of parallel lines leave (1 − c₁)(1 − c₂) uncovered)
  function fit() { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height; }
  const geo = () => { const R = Math.min(W, H) * 0.3; return { cx: W * 0.47, cy: H * 0.44, R }; };
  const light = () => { const z = Math.sqrt(Math.max(0.05, 1 - S.lx * S.lx - S.ly * S.ly)); return [S.lx, S.ly, z]; };
  // the brightness of the sphere at a unit normal (screen y down, z toward the viewer)
  const bright = (n, L) => Math.min(1, Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) * 0.92 + 0.06);
  // the hatching axes lie in the picture plane, so their poles sit on the outline (no whorl on the face)
  const AX = (() => { const a = [0.42, -0.91, 0], l = Math.hypot(...a); return a.map((v) => v / l); })();
  const basis = (a) => { const t = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; let u = [a[1] * t[2] - a[2] * t[1], a[2] * t[0] - a[0] * t[2], a[0] * t[1] - a[1] * t[0]]; const lu = Math.hypot(...u); u = u.map((v) => v / lu); const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]]; return [u, v]; };
  // one family of hatching: circles around axis a, nLines of them; coverage fn gives each family's share
  function family(g, a, nLines, cov) {
    const [u, v] = basis(a), L = light();
    const pt = (phi, t) => { const c = Math.cos(phi), s = Math.sin(phi); return [s * a[0] + c * (Math.cos(t) * u[0] + Math.sin(t) * v[0]), s * a[1] + c * (Math.cos(t) * u[1] + Math.sin(t) * v[1]), s * a[2] + c * (Math.cos(t) * u[2] + Math.sin(t) * v[2])]; };
    const dphi = Math.PI / nLines;
    ctx.strokeStyle = '#1a1b1f'; ctx.lineCap = 'butt';
    for (let k = 0; k < nLines; k++) {
      const phi = -Math.PI / 2 + (k + 0.5) * dphi, steps = Math.max(24, Math.round(Math.cos(phi) * 260));
      let prev = null;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps * 2 * Math.PI, n = pt(phi, t);
        if (n[2] <= 0) { prev = null; continue; }
        const P = [g.cx + n[0] * g.R, g.cy + n[1] * g.R];
        if (prev) {
          // the local spacing between this line and the next, on the screen
          const m = pt(phi + dphi, t), Q = [g.cx + m[0] * g.R, g.cy + m[1] * g.R], tx = P[0] - prev[0], ty = P[1] - prev[1], tl = Math.hypot(tx, ty) || 1;
          const sp = Math.abs((Q[0] - P[0]) * (-ty / tl) + (Q[1] - P[1]) * (tx / tl));
          const w = cov(bright(n, L)) * sp;
          if (w > 0.08) { ctx.lineWidth = Math.min(w, sp); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(P[0], P[1]); ctx.stroke(); }
        }
        prev = P;
      }
    }
  }
  function draw() {
    const g = geo(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    const L = light();
    // the table: light horizontal rules, and the sphere's shadow engraved denser
    const sx = g.cx - L[0] / Math.max(0.15, L[2]) * g.R * 0.55, sy = g.cy + g.R * 1.02, rx = g.R * (1.05 + Math.abs(L[0]) * 0.6), ry = g.R * 0.24;
    ctx.strokeStyle = '#1a1b1f';
    for (let y = sy - ry * 2.2; y < Math.min(H - 20, sy + ry * 2.6); y += 4.2) {
      const dy = (y - sy) / ry, half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      // the table's rules fade toward the edges of an oval, as an engraver vignettes a ground
      const ty = (y - (sy + ry * 0.2)) / (ry * 2.6), tl = g.R * 2.3 * Math.sqrt(Math.max(0, 1 - ty * ty));
      for (let k = 0; k < 6; k++) { const a0 = k / 6, a1 = (k + 1) / 6, wv = 0.5 * (1 - Math.abs(a0 + a1 - 1)); ctx.lineWidth = 0.15 + 0.5 * wv; ctx.beginPath(); ctx.moveTo(g.cx - tl + 2 * tl * a0, y); ctx.lineTo(g.cx - tl + 2 * tl * a1, y); ctx.stroke(); }
      if (half > 0) { const dark = 0.55 * (1 - dy * dy); ctx.lineWidth = 0.45 + dark * 4.2; ctx.beginPath(); ctx.moveTo(sx - half, y); ctx.lineTo(sx + half, y); ctx.stroke(); }
    }
    // the sphere: paper inside its outline, then two families of hatching; each family covers 1 − √I, so together
    // (crossing at random) they cover 1 − I
    ctx.fillStyle = '#fbfaf7'; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, Math.PI * 2); ctx.fill();
    const n1 = Math.round(g.R / 3.1);
    // as an engraver works: one family of lines carries the tone up to 55 % dark, the crossing family only enters the
    // shade; together they still cover 1 − (1 − c₁)(1 − c₂) = 1 − I exactly
    const c1 = (I) => Math.min(1 - I, 0.55), c2 = (I) => Math.max(0, 1 - I / (1 - c1(I)));
    family(g, AX, n1, c1);
    family(g, [-AX[1], AX[0], 0], n1, c2);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(26,27,31,.7)'; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, Math.PI * 2); ctx.stroke();
  }
  const sched = scheduler(() => { draw(); return false; });
  canvas.addEventListener('pointermove', (e) => { if (!(e.buttons & 1)) return; const r = canvas.getBoundingClientRect(), g = geo(); let x = (e.clientX - r.left - g.cx) / (g.R * 1.6), y = (e.clientY - r.top - g.cy) / (g.R * 1.6); const l = Math.hypot(x, y); if (l > 0.95) { x *= 0.95 / l; y *= 0.95 / l; } S.lx = x; S.ly = y; sched.wake(); });
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { S.lx = 0.5; S.ly = -0.5; draw(); },
    async accept() {
      draw(); const g = geo(), L = light(), img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      // windows of about three line spacings, at points well inside the sphere
      let worst = 0, n = 0; const win = Math.round(9 * dpr);
      for (let k = 0; k < 60; k++) {
        const a = k * 2.39996, r = Math.sqrt((k + 0.5) / 60) * 0.8, x = g.cx + Math.cos(a) * r * g.R, y = g.cy + Math.sin(a) * r * g.R;
        const nx = (x - g.cx) / g.R, ny = (y - g.cy) / g.R, nz = Math.sqrt(1 - nx * nx - ny * ny), I = bright([nx, ny, nz], L);
        let ink = 0, tot = 0;
        for (let j = -win; j <= win; j++) for (let i = -win; i <= win; i++) { const px = Math.round(x * dpr) + i, py = Math.round(y * dpr) + j, o = (py * canvas.width + px) * 4; ink += (251 - img[o]) / (251 - 26); tot++; }
        worst = Math.max(worst, Math.abs(ink / tot - (1 - I))); n++;
      }
      return { pass: worst < 0.06, value: `${n} ${zh ? '个窗口，覆盖率最大偏差' : 'windows, largest coverage error'} ${(worst * 100).toFixed(1)}%` };
    },
  };
}
