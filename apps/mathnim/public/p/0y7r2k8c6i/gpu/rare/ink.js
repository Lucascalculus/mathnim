// 3 · Ink in water. Stir, and the ink follows a flow that never piles up anywhere: div u = 0.
// Stable fluids (Stam) with an exact projection: velocities live on cell faces (u_i at i+½), the divergence is a
// backward difference and the pressure gradient a forward one, so div∘grad is exactly the 5-point Laplacian, and
// that Poisson problem is solved by a multigrid V-cycle on the GPU. Pigments mix as real inks do, by absorbing
// light: paper · exp(−Σ amount · absorbance).
import { context, program, pass, pingpong, target, pointer, fit_canvas, read_float } from '../lib/gl.js';
import { scheduler } from '../lib/ui.js';

export const meta = {
  id: 'ink',
  name: { zh: '水中墨', en: 'Ink in water' },
  means: { zh: '水不能被压缩：流进多少就流出多少，所以墨只会卷、不会堆。', en: 'Water cannot be squeezed: what flows in flows out, so ink curls but never piles up.' },
  test: { zh: '投影后平均 |div u| ÷ 投影前，低于 5%', en: 'Mean |div u| after projection ÷ before, below 5 %' },
};

// texel fetches by integer cell, so every stencil is exact (no filtering)
const HEAD = `in vec2 uv; out vec4 o; uniform vec2 size;
ivec2 cell(){ return ivec2(gl_FragCoord.xy); }
float P(sampler2D t, ivec2 c){ c = clamp(c, ivec2(0), ivec2(size) - 1); return texelFetch(t, c, 0).x; }
vec2 U(sampler2D t, ivec2 c){ if (c.x < 0 || c.y < 0) return vec2(0); vec2 u = texelFetch(t, min(c, ivec2(size) - 1), 0).xy;
  // the walls: no flow through the last face on each axis
  if (c.x >= int(size.x) - 1) u.x = 0.0; if (c.y >= int(size.y) - 1) u.y = 0.0; return u; }
`;
// advection: a face velocity is sampled at the cell centre it belongs to (a half-cell shift, ignored as Stam does)
// the velocity texture is unfiltered (exact stencils), so advection interpolates it by hand
const ADVECT = `in vec2 uv; out vec4 o; uniform sampler2D vel; uniform sampler2D src; uniform vec2 vtexel; uniform float dt; uniform float diss; uniform int src_is_vel;
vec2 vbil(vec2 q){ vec2 g = q / vtexel - 0.5, f = fract(g); ivec2 i = ivec2(floor(g)), m = ivec2(1.0 / vtexel) - 1;
  vec2 a = texelFetch(vel, clamp(i, ivec2(0), m), 0).xy, b = texelFetch(vel, clamp(i + ivec2(1, 0), ivec2(0), m), 0).xy, c = texelFetch(vel, clamp(i + ivec2(0, 1), ivec2(0), m), 0).xy, d = texelFetch(vel, clamp(i + ivec2(1, 1), ivec2(0), m), 0).xy;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
void main(){ vec2 p = uv - dt * vbil(uv) * vtexel; o = src_is_vel == 1 ? vec4(diss * vbil(p), 0, 1) : diss * texture(src, p); }`;
const SPLAT = `in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 at; uniform vec4 val; uniform float r; uniform float asp;
void main(){ vec2 d = uv - at; d.x *= asp; float k = exp(-dot(d, d) / r); o = texture(src, uv) + val * k; }`;
const CURL = HEAD + `uniform sampler2D vel;
void main(){ ivec2 c = cell(); vec2 a = U(vel, c), r = U(vel, c + ivec2(1, 0)), t = U(vel, c + ivec2(0, 1)); o = vec4((r.y - a.y) - (t.x - a.x), 0, 0, 1); }`;
const VORT = HEAD + `uniform sampler2D vel; uniform sampler2D curl; uniform float eps; uniform float dt;
void main(){ ivec2 c = cell(); float L = P(curl, c - ivec2(1, 0)), R = P(curl, c + ivec2(1, 0)), B = P(curl, c - ivec2(0, 1)), T = P(curl, c + ivec2(0, 1)), C = P(curl, c);
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-5; f *= eps * C; f.y *= -1.0;
  o = vec4(U(vel, c) + f * dt, 0, 1); }`;
const DIV = HEAD + `uniform sampler2D vel;
void main(){ ivec2 c = cell(); vec2 a = U(vel, c); o = vec4(a.x - U(vel, c - ivec2(1, 0)).x + a.y - U(vel, c - ivec2(0, 1)).y, 0, 0, 1); }`;
// Lp with Neumann walls: a missing neighbour contributes no difference
const LAP = `float lap(sampler2D p, ivec2 c, out float nb){ float s = 0.0, n = 0.0, pc = P(p, c);
  if (c.x > 0){ s += P(p, c - ivec2(1, 0)); n++; } if (c.x < int(size.x) - 1){ s += P(p, c + ivec2(1, 0)); n++; }
  if (c.y > 0){ s += P(p, c - ivec2(0, 1)); n++; } if (c.y < int(size.y) - 1){ s += P(p, c + ivec2(0, 1)); n++; }
  nb = n; return s - n * pc; }`;
const SMOOTH = HEAD + LAP + `uniform sampler2D p; uniform sampler2D f;
void main(){ ivec2 c = cell(); float n; float L = lap(p, c, n); float pc = P(p, c);
  // weighted Jacobi: p += ω (Lp − f) / n
  o = vec4(pc + 0.8 * (L - P(f, c)) / n, 0, 0, 1); }`;
const RESID = HEAD + LAP + `uniform sampler2D p; uniform sampler2D f;
void main(){ ivec2 c = cell(); float n; o = vec4(P(f, c) - lap(p, c, n), 0, 0, 1); }`;
// restriction: the coarse cell holds four fine cells; with unit spacing on every level the coarse right-hand
// side is the sum of the four fine residuals times the stencil ratio
const RESTRICT = `in vec2 uv; out vec4 o; uniform sampler2D r; uniform vec2 fine; uniform float k;
void main(){ ivec2 c = ivec2(gl_FragCoord.xy) * 2, m = ivec2(fine) - 1; float s = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++){ ivec2 q = c + ivec2(i, j); if (q.x <= m.x && q.y <= m.y) s += texelFetch(r, q, 0).x; }
  o = vec4(s * k, 0, 0, 1); }`;
// prolongation: add the coarse correction (bilinear) to the fine guess
const PROLONG = HEAD + `uniform sampler2D p; uniform sampler2D e;
void main(){ ivec2 c = cell(); o = vec4(P(p, c) + texture(e, uv).x, 0, 0, 1); }`;
const ZERO = `out vec4 o; void main(){ o = vec4(0); }`;
const GRAD = HEAD + `uniform sampler2D p; uniform sampler2D vel;
void main(){ ivec2 c = cell(); float pc = P(p, c); vec2 u = U(vel, c);
  vec2 g = vec2(c.x < int(size.x) - 1 ? P(p, c + ivec2(1, 0)) - pc : 0.0, c.y < int(size.y) - 1 ? P(p, c + ivec2(0, 1)) - pc : 0.0);
  o = vec4(u - g, 0, 1); }`;
const SHOW = `in vec2 uv; out vec4 o; uniform sampler2D dye;
void main(){
  vec3 m = max(texture(dye, uv).rgb, 0.0);
  // absorbance of each ink: −log of its colour on white
  vec3 A = m.r * -log(to_lin(COBALT)) + m.g * -log(to_lin(OCHRE)) + m.b * -log(to_lin(VERMILION));
  vec3 c = to_lin(PAPER) * exp(-A * 0.9);
  c *= 0.985 + 0.015 * vnoise(uv * vec2(900.0, 560.0));
  o = vec4(to_srgb(c), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const gl = context(canvas);
  fit_canvas(canvas, 1.5);
  const asp = canvas.width / canvas.height, SW = 256, SH = Math.round(256 / asp / 2) * 2, DW = 1024, DH = Math.round(1024 / asp);
  const vel = pingpong(gl, SW, SH, { type: 'f32', filter: 'nearest' }), dye = pingpong(gl, DW, DH, { type: 'f16' });
  const div = target(gl, SW, SH, { type: 'f32', filter: 'nearest' }), curl = target(gl, SW, SH, { type: 'f32', filter: 'nearest' });
  // the multigrid hierarchy
  const levels = []; for (let w = SW, h = SH; w >= 8 && h >= 4; w = Math.ceil(w / 2), h = Math.ceil(h / 2)) levels.push({ w, h, p: pingpong(gl, w, h, { type: 'f32' }), f: target(gl, w, h, { type: 'f32', filter: 'nearest' }), r: target(gl, w, h, { type: 'f32', filter: 'nearest' }) });
  const P = { adv: program(gl, ADVECT), splat: program(gl, SPLAT), curl: program(gl, CURL), vort: program(gl, VORT), div: program(gl, DIV), smooth: program(gl, SMOOTH), resid: program(gl, RESID), restrict: program(gl, RESTRICT), prolong: program(gl, PROLONG), zero: program(gl, ZERO), grad: program(gl, GRAD), show: program(gl, SHOW) };
  const vt = [1 / SW, 1 / SH];
  const queue = [];
  let last_input = -1e9, ink_i = 0, KR = 1, NS = 3;
  const INKS = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];

  function vcycle(k) {
    const L = levels[k], sz = [L.w, L.h];
    const smooth = (n) => { for (let i = 0; i < n; i++) { pass(gl, P.smooth, { p: L.p.read, f: L.f, size: sz }, L.p.write); L.p.swap(); } };
    if (k === levels.length - 1) { smooth(40); return; }
    smooth(NS);
    pass(gl, P.resid, { p: L.p.read, f: L.f, size: sz }, L.r);
    const C = levels[k + 1];
    pass(gl, P.restrict, { r: L.r, fine: sz, k: KR }, C.f);
    pass(gl, P.zero, {}, C.p.read);
    vcycle(k + 1);
    pass(gl, P.prolong, { p: L.p.read, e: C.p.read, size: sz }, L.p.write); L.p.swap();
    smooth(NS);
  }
  // the Helmholtz projection: solve Lp = div u (warm-started from the last frame's pressure), subtract grad p
  function project(cycles = 2) {
    pass(gl, P.div, { vel: vel.read, size: [SW, SH] }, levels[0].f);
    for (let i = 0; i < cycles; i++) vcycle(0);
    pass(gl, P.grad, { p: levels[0].p.read, vel: vel.read, size: [SW, SH] }, vel.write); vel.swap();
  }
  function step(dt) {
    for (const s of queue.splice(0)) {
      pass(gl, P.splat, { src: vel.read, at: s.at, val: [s.f[0], s.f[1], 0, 0], r: 0.0022, asp }, vel.write); vel.swap();
      if (s.ink) { pass(gl, P.splat, { src: dye.read, at: s.at, val: s.ink, r: 0.0012, asp }, dye.write); dye.swap(); }
    }
    pass(gl, P.curl, { vel: vel.read, size: [SW, SH] }, curl);
    pass(gl, P.vort, { vel: vel.read, curl, eps: 14, dt, size: [SW, SH] }, vel.write); vel.swap();
    project(2);
    pass(gl, P.adv, { vel: vel.read, src: vel.read, src_is_vel: 1, vtexel: vt, dt: dt * 60, diss: 0.992 }, vel.write); vel.swap();
    project(2);
    pass(gl, P.adv, { vel: vel.read, src: dye.read, src_is_vel: 0, vtexel: vt, dt: dt * 60, diss: 0.9995 }, dye.write); dye.swap();
  }
  const show = () => pass(gl, P.show, { dye: dye.read });
  const sched = scheduler(() => { step(1 / 60); show(); return performance.now() - last_input < 8000; });
  let prev = null;
  pointer(canvas, (kind, p) => {
    if (kind === 'down') { prev = [p.x, p.y]; ink_i = (ink_i + 1) % 3; }
    if (kind === 'move' && p.down && prev) {
      const f = [(p.x - prev[0]) * SW * 6, (p.y - prev[1]) * SH * 6]; prev = [p.x, p.y];
      queue.push({ at: [p.x, p.y], f, ink: INKS[ink_i].map((v) => v * 0.8) });
    }
    if (kind === 'up') prev = null;
    last_input = performance.now(); sched.wake();
  });
  function demo() {
    const shots = [[0.3, 0.55, 22, -6, 0], [0.66, 0.4, -18, 14, 1], [0.52, 0.72, -8, -20, 2]];
    for (const [x, y, fx, fy, k] of shots) for (let i = 0; i < 6; i++) queue.push({ at: [x + i * fx * 0.0012, y + i * fy * 0.0012], f: [fx * 5, fy * 5], ink: INKS[k].map((v) => v * 1.4) });
    last_input = performance.now(); sched.wake();
  }
  show(); demo();
  function mean_abs(t) { const px = read_float(gl, t); let s = 0; for (let i = 0; i < px.length; i += 4) s += Math.abs(px[i]); return s / (px.length / 4); }
  // a fresh, hard stir: the divergence it makes, and what one frame's projection leaves of it
  function trial(cycles) {
    pass(gl, P.zero, {}, levels[0].p.read);
    pass(gl, P.splat, { src: vel.read, at: [0.45, 0.52], val: [300, -200, 0, 0], r: 0.004, asp }, vel.write); vel.swap();
    pass(gl, P.div, { vel: vel.read, size: [SW, SH] }, div); const before = mean_abs(div);
    project(cycles);
    pass(gl, P.div, { vel: vel.read, size: [SW, SH] }, div); return mean_abs(div) / before;
  }
  window.__ink_probe = (kr, ns, cyc) => { KR = kr; NS = ns; return trial(cyc); };
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 1.5); show(); }, demo,
    async accept() {
      for (let i = 0; i < 10; i++) step(1 / 60);
      const r = trial(2);
      pass(gl, P.zero, {}, vel.read); for (let i = 0; i < 30; i++) step(1 / 60); show();   // calm the water again
      hud.innerHTML = `|div u| ${lang === 'zh' ? '投影后剩' : 'left after projection'} <b>${(r * 100).toFixed(2)}%</b>`;
      return { pass: r < 0.05, value: (r * 100).toFixed(2) + '%' };
    },
  };
}
