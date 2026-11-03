// D7 · Halftone density. A density is printed the way a press prints a photograph: dots on a rotated screen, each
// dot's area exactly the density in its cell (past one half, the dots join and the paper shows as holes, also of
// exact area). Two densities print in two pigments on screens at different angles, so where both are present the
// dots interleave into the press's rosette: overlap you can read. Drag either blob. Canvas 2D only.
// As a library primitive: print(density) for any field on the plane, in any pigment.
import { scheduler } from '../../lib/gl.js';

export const meta = {
  id: 'halftone',
  name: { zh: '网点密度', en: 'Halftone density' },
  means: { zh: '像印刷照片一样印出一个密度：每个网点的面积恰好等于那里的密度；两种颜色用不同角度的网，重叠处交织成玫瑰斑。', en: 'A density printed as a press prints a photograph: each dot\'s area is exactly the density there; two pigments on screens at different angles interleave where they overlap.' },
  test: { zh: '均匀密度 d 印出来的墨覆盖率 = d（d 从 0.1 到 0.9，误差 < 2%）', en: 'A uniform density d prints with ink coverage d (d from 0.1 to 0.9, within 2 %)' },
};

// the radius (in cell units) whose circle, clipped to the unit cell, has area d
const clipped_area = (r) => { const h = 0.5; if (r <= h) return Math.PI * r * r; if (r >= h * Math.SQRT2) return 1; return Math.PI * r * r - 4 * (r * r * Math.acos(h / r) - h * Math.sqrt(r * r - h * h)); };
const RT = Array.from({ length: 257 }, (_, i) => { const d = i / 256; let lo = 0, hi = 0.7072; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (clipped_area(m) < d) lo = m; else hi = m; } return (lo + hi) / 2; });
const dot_radius = (d) => { const x = Math.min(1, Math.max(0, d)) * 256, i = Math.min(255, Math.floor(x)), f = x - i; return RT[i] + (RT[i + 1] - RT[i]) * f; };

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, dpr = 1;
  const blobs = [{ x: 0.38, y: 0.48, s: 0.17, col: '#2f5bd2', ang: 0.26 }, { x: 0.62, y: 0.52, s: 0.15, col: '#c8861a', ang: 1.31 }];
  function fit() { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height; }
  const density = (b, x, y) => { const m = Math.min(W, H), dx = (x - b.x * W) / (b.s * m), dy = (y - b.y * H) / (b.s * m); return 0.92 * Math.exp(-(dx * dx + dy * dy) / 2); };
  // one screen: cells of side s along angle a; each cell prints a dot (d ≤ ½) or a hole (d > ½) of exact area d·s²
  function screen(fn, col, ang, s, uniform, g = ctx) {
    const ctx_ = ctx; { const ctx = g;
    const c = Math.cos(ang), si = Math.sin(ang), R = Math.hypot(W, H);
    ctx.fillStyle = col;
    for (let v = -R; v < R; v += s) for (let u = -R; u < R; u += s) {
      const x = W / 2 + (u + s / 2) * c - (v + s / 2) * si, y = H / 2 + (u + s / 2) * si + (v + s / 2) * c;
      if (x < -s || y < -s || x > W + s || y > H + s) continue;
      const d = uniform ?? fn(x, y); if (d < 0.004) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      // a round dot that keeps growing, clipped to its cell once it touches the neighbours; its radius is solved so the
      // clipped area is exactly d·s² (no switch from dots to holes, so no seam where d = ½)
      const r = dot_radius(d) * s;
      if (r <= s / 2) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.rect(-s / 2, -s / 2, s, s); ctx.clip(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  } }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    const s = Math.max(5, Math.min(W, H) / 70);
    ctx.globalCompositeOperation = 'multiply';
    for (const b of blobs) screen((x, y) => density(b, x, y), b.col, b.ang, s);
    ctx.globalCompositeOperation = 'source-over';
    hud.innerHTML = zh ? '网点面积 = 密度' : 'dot area = density';
  }
  const sched = scheduler(() => { draw(); return false; });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = 1e9; blobs.forEach((b, i) => { const d = Math.hypot(b.x * W - x, b.y * H - y); if (d < best) { best = d; drag = i; } }); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag == null) return; const r = canvas.getBoundingClientRect(); blobs[drag].x = (e.clientX - r.left) / W; blobs[drag].y = (e.clientY - r.top) / H; sched.wake(); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { blobs[1].x = 0.5; blobs[1].y = 0.5; draw(); },
    async accept() {
      let worst = 0; const s = Math.max(5, Math.min(W, H) / 70), res = [];
      for (const d of [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
        // a press proof: printed on a 4× plate, so the measurement is of the dots, not of the screen's pixels
        const P = document.createElement('canvas'); P.width = W * 4; P.height = H * 4; const g = P.getContext('2d', { willReadFrequently: true });
        g.setTransform(4, 0, 0, 4, 0, 0); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); screen(null, '#000000', 0.26, s, d, g);
        const x0 = Math.round(W * 0.3 * 4), y0 = Math.round(H * 0.3 * 4), w = Math.round(W * 0.4 * 4), h = Math.round(H * 0.4 * 4);
        const img = g.getImageData(x0, y0, w, h).data; let ink = 0; for (let i = 0; i < img.length; i += 4) ink += 1 - img[i] / 255;
        const cov = ink / (w * h); worst = Math.max(worst, Math.abs(cov - d)); res.push(cov.toFixed(3));
      }
      draw();
      return { pass: worst < 0.02, value: `${zh ? '覆盖率' : 'coverage'} ${res.join(' ')}; ${zh ? '最大误差' : 'largest error'} ${(worst * 100).toFixed(2)}%` };
    },
  };
}
