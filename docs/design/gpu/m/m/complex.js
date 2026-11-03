// M3 · A complex function as enamel. f(z) = (z − a)(z − b) / (z − c): height is log|f| (zeros are wells, the pole is a
// spire), the phase is a ring of the site's own pigments, engraved lines follow |f| and fine white lines follow arg f;
// the two families meet at right angles everywhere (f is conformal). A loop counts how many times f winds around 0:
// the argument principle says zeros inside minus poles inside. Drag the zeros, the pole, or the loop's rim.
import { context, program, pass, scheduler, fit_canvas, clamp } from '../../lib/gl.js';
import { SANS } from '../../lib/ui.js';

export const meta = {
  id: 'complex',
  name: { zh: '复函数 · 珐琅', en: 'A complex function in enamel' },
  means: { zh: '高度是 log|f|（零点是井，极点是尖塔），颜色是相位；两组线处处垂直。一个圈绕 0 的圈数 = 圈里的零点数 − 极点数。', en: 'Height is log|f| (zeros are wells, poles are spires), colour is the phase; the two families of lines meet at right angles. A loop winds around 0 as many times as zeros minus poles inside it.' },
  test: { zh: '数值绕数 = 圈内零点 − 极点（各种位置）；两族线夹角 90° ± 1°', en: 'Numerical winding = zeros − poles inside (many placements); the two families meet at 90° ± 1°' },
};

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform vec2 za; uniform vec2 zb; uniform vec2 pc; uniform vec3 loop; uniform float scale;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b){ return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / dot(b, b); }
vec2 f(vec2 z){ return cdiv(cmul(z - za, z - zb), z - pc); }
// the phase ring, through the site's pigments
vec3 ring(float t){
  vec3 P[6] = vec3[6](to_lin(COBALT), to_lin(VIOLET), to_lin(VERMILION), to_lin(OCHRE), to_lin(VIRIDIAN), to_lin(TEAL));
  float x = fract(t) * 6.0; int i = int(floor(x)); float u = x - floor(x); u = u * u * (3.0 - 2.0 * u);
  return mix(P[i], P[(i + 1) % 6], u);
}
float H(vec2 z){ return clamp(log(length(f(z))), -3.0, 3.0); }
void main(){
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 z = (p - res * 0.5) / scale * vec2(1, -1);
  vec2 w = f(z); float arg = atan(w.y, w.x) / 6.2831853, lm = log(length(w));
  // cloisonné: the conformal grid is a net of raised silver wires; each cell between wires is filled with glossy
  // enamel of one colour (its phase band), its tone set by its |f| band. A quantised, exact reading of f.
  float k1 = lm / 0.5, k2 = arg * 12.0;
  float pb = floor(k2), mb = floor(k1);
  vec3 enamel = ring((pb + 0.5) / 12.0 + 0.5);
  enamel *= 0.78 + 0.22 * smoothstep(-6.0, 6.0, mb);
  // the enamel's glassy coat: the whole surface is the relief log|f|, lit from the upper left
  float e = 1.0 / scale; vec2 g = vec2(H(z + vec2(e, 0)) - H(z - vec2(e, 0)), H(z + vec2(0, e)) - H(z - vec2(0, e))) / (2.0 * e);
  vec3 n = normalize(vec3(-g * 0.35, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
  // distance to the nearest wire, in pixels, for both families
  float d1 = abs(fract(k1 + 0.5) - 0.5) / fwidth(k1), d2 = abs(fract(k2 + 0.5) - 0.5) / fwidth(k2);
  float dw = min(d1, d2), ww = 1.5 * res.y / 800.0;
  // the enamel sinks a little toward each wire (a meniscus), so cells read as filled
  float men = smoothstep(ww, ww + 5.0, dw);
  vec3 c = enamel * (0.62 + 0.38 * max(dot(n, L), 0.0)) * (0.82 + 0.18 * men);
  float spec = pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.0), 90.0);
  c += vec3(0.65) * spec * men;
  // the wire: a silver cylinder across its width
  float across = clamp(dw / ww, 0.0, 1.0);
  vec2 gw = d1 < d2 ? normalize(vec2(dFdx(k1), dFdy(k1)) + 1e-6) : normalize(vec2(dFdx(k2), dFdy(k2)) + 1e-6);
  float side = sign(fract(d1 < d2 ? k1 : k2) - 0.5);
  vec3 wn = normalize(vec3(gw * side * sqrt(1.0 - (1.0 - across) * (1.0 - across)) * 0.0 + gw * side * across, sqrt(max(0.0, 1.0 - across * across))));
  float wl = 0.45 + 0.55 * max(dot(wn, L), 0.0), wspec = pow(max(dot(reflect(-L, wn), vec3(0, 0, 1)), 0.0), 40.0);
  vec3 silver = vec3(0.78, 0.79, 0.8) * wl + vec3(0.9) * wspec;
  c = mix(c, silver, smoothstep(ww + 0.8, ww - 0.4, dw));
  // the loop: a dashed glass ring
  float r = length(z - loop.xy) - loop.z, dr = abs(r) * scale / (res.y / 800.0) * 0.6;
  float ang = atan(z.y - loop.y, z.x - loop.x);
  float dash = step(0.0, sin(ang * 36.0));
  c = mix(c, vec3(1.0), smoothstep(2.2, 0.8, dr) * (0.35 + 0.65 * dash));
  c = mix(c, to_lin(INK), smoothstep(3.6, 2.4, dr) * smoothstep(1.8, 2.4, dr) * 0.6);
  // the zeros and the pole, as small beads: a hollow ring for a zero, a filled dot for the pole
  for (int i = 0; i < 3; i++){
    vec2 q = i == 0 ? za : i == 1 ? zb : pc; float d = length(z - q) * scale / (res.y / 800.0) * 0.55;
    float bead = smoothstep(11.0, 9.5, d);
    c = mix(c, vec3(1.0), bead * 0.95);
    c = mix(c, to_lin(INK), smoothstep(1.2, 0.0, abs(d - 10.5)) * 0.4);
    if (i == 2) c = mix(c, to_lin(INK), smoothstep(4.5, 3.5, d)); else c = mix(c, to_lin(INK), smoothstep(1.0, 0.0, abs(d - 4.5)));
  }
  o = vec4(to_srgb(c), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', gl = context(canvas), prog = program(gl, FS);
  fit_canvas(canvas, 2);
  const S = { a: [-0.9, 0.35], b: [0.7, -0.45], c: [0.25, 0.75], loop: [-0.1, 0.0, 1.05] };
  const scale = () => Math.min(canvas.width, canvas.height) / 4.2;
  const f = (x, y) => { const m = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]]; const n = m([x - S.a[0], y - S.a[1]], [x - S.b[0], y - S.b[1]]), d = [x - S.c[0], y - S.c[1]], dd = d[0] * d[0] + d[1] * d[1]; return [(n[0] * d[0] + n[1] * d[1]) / dd, (n[1] * d[0] - n[0] * d[1]) / dd]; };
  // the winding number of f around the loop, by following arg f around it
  function winding() { const [cx, cy, R] = S.loop, n = 2000; let tot = 0, prev = null; for (let i = 0; i <= n; i++) { const t = i / n * 2 * Math.PI, w = f(cx + R * Math.cos(t), cy + R * Math.sin(t)), a = Math.atan2(w[1], w[0]); if (prev !== null) { let d = a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; tot += d; } prev = a; } return Math.round(tot / (2 * Math.PI)); }
  const inside = (p) => Math.hypot(p[0] - S.loop[0], p[1] - S.loop[1]) < S.loop[2];
  function draw() {
    pass(gl, prog, { res: [canvas.width, canvas.height], za: S.a, zb: S.b, pc: S.c, loop: S.loop, scale: scale() });
    const Z = [S.a, S.b].filter(inside).length, P = inside(S.c) ? 1 : 0;
    hud.innerHTML = zh ? `绕 0 <b>${winding()}</b> 圈 · 圈里 ${Z} 个零点、${P} 个极点` : `winds <b>${winding()}</b> times · ${Z} zeros, ${P} poles inside`;
  }
  const sched = scheduler(() => { draw(); return false; });
  const to_z = (e) => { const r = canvas.getBoundingClientRect(), d = canvas.width / r.width, s = scale(); return [((e.clientX - r.left) * d - canvas.width / 2) / s, -((e.clientY - r.top) * d - canvas.height / 2) / s]; };
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const z = to_z(e), s = scale() / (canvas.width / canvas.getBoundingClientRect().width), near = (p) => Math.hypot(p[0] - z[0], p[1] - z[1]) * s < 22;
    drag = near(S.a) ? 'a' : near(S.b) ? 'b' : near(S.c) ? 'c' : Math.abs(Math.hypot(z[0] - S.loop[0], z[1] - S.loop[1]) - S.loop[2]) * s < 18 ? 'rim' : Math.hypot(z[0] - S.loop[0], z[1] - S.loop[1]) < S.loop[2] ? 'loop' : null;
    if (drag === 'loop') S.off = [z[0] - S.loop[0], z[1] - S.loop[1]];
    if (drag) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return; const z = to_z(e);
    if (drag === 'rim') S.loop[2] = clamp(Math.hypot(z[0] - S.loop[0], z[1] - S.loop[1]), 0.15, 2.6);
    else if (drag === 'loop') { S.loop[0] = z[0] - S.off[0]; S.loop[1] = z[1] - S.off[1]; }
    else S[drag] = z;
    sched.wake(100);
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 2); draw(); },
    demo() { S.loop = [0.4, 0.3, 0.75]; draw(); },
    async accept() {
      // many placements of the loop: the numerical winding equals zeros − poles inside
      const keep = S.loop.slice(); let ok = true, n = 0;
      for (let i = 0; i < 40; i++) { S.loop = [Math.sin(i * 1.7) * 1.2, Math.cos(i * 2.3) * 0.9, 0.3 + (i % 7) * 0.3]; const near_sing = [S.a, S.b, S.c].some((p) => Math.abs(Math.hypot(p[0] - S.loop[0], p[1] - S.loop[1]) - S.loop[2]) < 0.02); if (near_sing) continue; n++; if (winding() !== [S.a, S.b].filter(inside).length - (inside(S.c) ? 1 : 0)) ok = false; }
      S.loop = keep;
      // conformal: ∇log|f| ⟂ ∇arg f (Cauchy–Riemann), checked at scattered points
      let worst = 0; const e = 1e-5;
      for (let i = 0; i < 200; i++) { const x = Math.sin(i * 12.9898) * 1.8, y = Math.cos(i * 78.233) * 1.4; const L = (x, y) => Math.log(Math.hypot(...f(x, y))), A = (x, y) => { const w = f(x, y); return Math.atan2(w[1], w[0]); };
        const g1 = [(L(x + e, y) - L(x - e, y)) / (2 * e), (L(x, y + e) - L(x, y - e)) / (2 * e)]; let ax = A(x + e, y) - A(x - e, y), ay = A(x, y + e) - A(x, y - e); for (const v of [ax, ay]) {} ax = ((ax + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; ay = ((ay + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        const g2 = [ax / (2 * e), ay / (2 * e)], c = (g1[0] * g2[0] + g1[1] * g2[1]) / (Math.hypot(...g1) * Math.hypot(...g2) + 1e-12); worst = Math.max(worst, Math.abs(Math.asin(Math.min(1, Math.abs(c)))) * 180 / Math.PI); }
      draw();
      return { pass: ok && worst < 1, value: `${n} ${zh ? '个圈的绕数全部吻合' : 'loops, every winding matches'} ${ok ? '✓' : '✗'}; ${zh ? '最大偏离直角' : 'largest departure from a right angle'} ${worst.toFixed(3)}°` };
    },
  };
}
