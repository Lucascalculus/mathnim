// M8 · Iteration: Newton's method on a cubic with three roots you can move. Every pixel is a starting guess, iterated
// live on the GPU; it takes the colour of the root it converges to and is engraved by how many steps it took. Between
// the basins lies a fractal boundary where all three meet at every point. Wheel or pinch to zoom; drag a root.
// As a library primitive: iterate(map, colour_by_limit) for any map of the plane.
import { context, program, pass, scheduler, fit_canvas, clamp } from '../../lib/gl.js';

export const meta = {
  id: 'newton',
  name: { zh: '迭代 · 牛顿法', en: "Iteration: Newton's method" },
  means: { zh: '每个像素是一次起始猜测：它被迭代到哪个根，就染哪个根的颜色；刻线是用了几步。三片盆地的边界处处是分形。', en: 'Every pixel is a starting guess: it takes the colour of the root it reaches, engraved by the steps it took. The boundary of the basins is fractal everywhere.' },
  test: { zh: '每个根附近（|z − r| < 0.1）都属于它自己的盆地；对称时三片盆地面积相等（±2%）', en: 'Near each root (|z − r| < 0.1) every pixel is that root\'s; in the symmetric case the three basins have equal area (±2 %)' },
};

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform vec2 center; uniform float zoom; uniform vec2 R[3]; uniform float test;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b){ return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / dot(b, b); }
void main(){
  vec2 z = center + (gl_FragCoord.xy - res * 0.5) / res.y * 2.0 / zoom;
  int root = -1; float it = 0.0;
  for (int i = 0; i < 64; i++){
    // p(z) = (z − r0)(z − r1)(z − r2); Newton: z ← z − p / p' = z − 1 / Σ 1/(z − rk)
    vec2 s = cdiv(vec2(1, 0), z - R[0]) + cdiv(vec2(1, 0), z - R[1]) + cdiv(vec2(1, 0), z - R[2]);
    z -= cdiv(vec2(1, 0), s);
    for (int k = 0; k < 3; k++) if (length(z - R[k]) < 1e-3){ root = k; break; }
    if (root >= 0){ it = float(i) + 1.0; break; }
  }
  if (test > 0.5){ o = vec4(float(root + 1) / 4.0, 0, 0, 1); return; }
  vec3 P[3] = vec3[3](to_lin(COBALT), to_lin(OCHRE), to_lin(VIRIDIAN));
  vec3 c = root < 0 ? to_lin(INK) : P[root];
  // smooth iteration count: lighter where the guess converged fast, deeper where it took long
  float k = it / 22.0;
  c = mix(vec3(1.0), c, clamp(0.58 + k * 0.9, 0.0, 1.0));
  // engraved bands, one per step
  float b = abs(fract(it * 0.5) - 0.5);
  c *= 0.93 + 0.07 * smoothstep(0.0, 0.5, b);
  // the roots: small white beads
  for (int i = 0; i < 3; i++){ float d = length((center + (gl_FragCoord.xy - res * 0.5) / res.y * 2.0 / zoom) - R[i]) * zoom * res.y / 2.0; float s = res.y / 800.0;
    c = mix(c, vec3(1.0), smoothstep(10.0 * s, 8.5 * s, d)); c = mix(c, to_lin(INK), smoothstep(1.4 * s, 0.0, abs(d - 9.4 * s)) * 0.5); }
  o = vec4(to_srgb(c), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', gl = context(canvas), prog = program(gl, FS);
  fit_canvas(canvas, 1.5);
  const sym = () => [0, 1, 2].map((k) => [Math.cos(k * 2 * Math.PI / 3), Math.sin(k * 2 * Math.PI / 3)]);
  const S = { R: sym(), c: [0, 0], z: 0.9, zt: 0.9, ct: [0, 0] };
  S.R[1] = [-0.35, 0.95];
  const draw = (test = 0) => { pass(gl, prog, { res: [canvas.width, canvas.height], center: S.c, zoom: S.z, R: new Float32Array(S.R.flat()), test }); hud.innerHTML = `${zh ? '放大' : 'zoom'} <b>${S.z.toFixed(S.z < 10 ? 1 : 0)}×</b>`; };
  const sched = scheduler((dt) => { const k = 1 - Math.pow(0.001, dt); S.z += (S.zt - S.z) * k; S.c[0] += (S.ct[0] - S.c[0]) * k; S.c[1] += (S.ct[1] - S.c[1]) * k; draw(); return Math.abs(S.zt / S.z - 1) > 1e-3 || Math.hypot(S.ct[0] - S.c[0], S.ct[1] - S.c[1]) * S.z > 1e-3; });
  const to_z = (e) => { const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * canvas.width, y = (1 - (e.clientY - r.top) / r.height) * canvas.height; return [S.c[0] + (x - canvas.width / 2) / canvas.height * 2 / S.z, S.c[1] + (y - canvas.height / 2) / canvas.height * 2 / S.z]; };
  // zoom about the point under the pointer, as maps do
  const zoom_at = (z, f) => { const nz = clamp(S.zt * f, 0.5, 20000); S.ct = [z[0] + (S.ct[0] - z[0]) * S.zt / nz, z[1] + (S.ct[1] - z[1]) * S.zt / nz]; S.zt = nz; sched.wake(); };
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom_at(to_z(e), Math.exp(-e.deltaY * 0.0025)); }, { passive: false });
  let drag = null; const pts = new Map(); let pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, e); canvas.setPointerCapture(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }; drag = null; return; }
    const z = to_z(e), px = 2 / canvas.height / S.z * (canvas.width / canvas.getBoundingClientRect().width);
    const k = S.R.findIndex((r) => Math.hypot(r[0] - z[0], r[1] - z[1]) < 14 * px);
    drag = k >= 0 ? { root: k } : { pan: z, c: S.ct.slice() };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); zoom_at(to_z({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }), d / pinch.d); pinch.d = d; return; }
    if (!drag) return;
    if (drag.root != null) { S.R[drag.root] = to_z(e); draw(); }
    else { const z = to_z(e); S.ct = [S.ct[0] - (z[0] - drag.pan[0]), S.ct[1] - (z[1] - drag.pan[1])]; S.c = S.ct.slice(); draw(); }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('dblclick', (e) => zoom_at(to_z(e), 4));
  draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 1.5); draw(); },
    // find a point on the boundary between two basins (bisect along the segment between two roots), and zoom there
    demo() {
      const nr = (x, y) => { for (let i = 0; i < 80; i++) { if (S.R.some((r) => Math.hypot(x - r[0], y - r[1]) < 1e-9)) break; let sx = 0, sy = 0; for (const r of S.R) { const dx = x - r[0], dy = y - r[1], d = dx * dx + dy * dy; sx += dx / d; sy += -dy / d; } const d = sx * sx + sy * sy; x -= sx / d; y -= -sy / d; } let best = 0, bd = 1e9; S.R.forEach((r, k) => { const d = Math.hypot(x - r[0], y - r[1]); if (d < bd) { bd = d; best = k; } }); return best; };
      const a = S.R[0], b = S.R[1], ka = nr(...a);
      let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, k = nr(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m); if (k === ka) lo = m; else hi = m; }
      S.ct = [a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo]; S.zt = 40; sched.wake(4000);
    },
    view(c, z) { S.c = c.slice(); S.ct = c.slice(); S.z = S.zt = z; draw(); },
    async accept() {
      const keep = { R: S.R.map((r) => r.slice()), c: S.c.slice(), z: S.z };
      S.R = sym(); S.c = [0, 0]; S.z = 0.5; draw(1);
      const W = canvas.width, H = canvas.height, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const area = [0, 0, 0]; let near_ok = true;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = Math.round(px[(y * W + x) * 4] / 255 * 4) - 1, zx = (x + 0.5 - W / 2) / H * 2 / S.z, zy = (y + 0.5 - H / 2) / H * 2 / S.z;
        // the symmetric basins, counted inside a disc centred on 0 (so the frame's shape does not bias them)
        if (Math.hypot(zx, zy) < 1.8 && k >= 0) area[k]++;
        S.R.forEach((r, j) => { if (Math.hypot(zx - r[0], zy - r[1]) < 0.1 && k !== j) near_ok = false; });
      }
      const mean = (area[0] + area[1] + area[2]) / 3, spread = Math.max(...area.map((a) => Math.abs(a / mean - 1)));
      S.R = keep.R; S.c = keep.c; S.ct = keep.c.slice(); S.z = keep.z; draw();
      return { pass: near_ok && spread < 0.02, value: `${zh ? '根附近正确' : 'near each root'} ${near_ok ? '✓' : '✗'}; ${zh ? '三片面积差' : 'basin areas differ by'} ${(spread * 100).toFixed(2)}%` };
    },
  };
}
