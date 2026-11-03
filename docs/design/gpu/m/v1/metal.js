// 4 · Liquid metal. A Gaussian mixture poured as mercury: each blob is a component, the surface is their sum.
// Two equal blobs keep two peaks until they come closer than 2σ; then the mixture has one peak. The one light
// overhead puts a highlight on every place where the surface is level, so peaks can be counted by eye.
import { context, program, pass, scheduler, pointer, fit_canvas, m4, clamp } from '../../lib/gl.js';

export const meta = {
  id: 'metal',
  name: { zh: '液态金属', en: 'Liquid metal' },
  means: { zh: '几团高斯靠近到 2σ 以内，就只剩一个峰：混合分布的众数个数。', en: 'Gaussian blobs closer than 2σ leave a single peak: the number of modes of a mixture.' },
  test: { zh: '曲面上数出的峰数 = 理论（两团等量：d ≤ 2σ 时为 1）', en: 'Peaks counted on the surface = theory (two equal blobs: one iff d ≤ 2σ)' },
};

export const SIG = 0.36;
const AMP = 0.55, TAU = 0.06;
export function mix_h(c, x, y) { let s = 0; for (const b of c) { const dx = x - b[0], dy = y - b[1]; s += b[2] * Math.exp(-(dx * dx + dy * dy) / (2 * SIG * SIG)); } return AMP * s; }
// count local maxima: climb from a grid of starts, merge the summits
export function count_peaks(c) {
  const tops = [];
  for (let i = 0; i < 24; i++) for (let j = 0; j < 16; j++) {
    let x = -2.2 + i * 4.4 / 23, y = -1.4 + j * 2.8 / 15; if (mix_h(c, x, y) < 0.01 * AMP) continue;
    for (let k = 0; k < 4000; k++) { const e = 1e-4, gx = (mix_h(c, x + e, y) - mix_h(c, x - e, y)) / (2 * e), gy = (mix_h(c, x, y + e) - mix_h(c, x, y - e)) / (2 * e); x += 0.02 * gx; y += 0.02 * gy; if (gx * gx + gy * gy < 1e-14) break; }
    if (!tops.some((t) => Math.hypot(t[0] - x, t[1] - y) < 0.02)) tops.push([x, y]);
  }
  return tops;
}

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform vec3 eye; uniform mat3 cam; uniform vec3 B[3]; uniform float sig; uniform float amp; uniform float tau;
float H(vec2 p){ float s = 0.0; for (int i = 0; i < 3; i++){ vec2 d = p - B[i].xy; s += B[i].z * exp(-dot(d, d) / (2.0 * sig * sig)); } return amp * s - tau; }
vec2 G(vec2 p){ vec2 g = vec2(0); for (int i = 0; i < 3; i++){ vec2 d = p - B[i].xy; g += -B[i].z * d / (sig * sig) * exp(-dot(d, d) / (2.0 * sig * sig)); } return amp * g; }
const vec3 LDIR = normalize(vec3(-0.35, 1.0, 0.25));
vec3 env(vec3 d){
  // the studio the metal reflects. Below the horizon: the paper table it stands on. A darker band where the far
  // walls are in shade (it draws the chrome line). Above: a ceiling that brightens upwards, one small round soft
  // box straight overhead (so every level place on the surface, every peak, shows a highlight), and a long strip
  // light on the right.
  vec3 c;
  if (d.y < 0.0){
    float far = smoothstep(-0.02, -0.5, d.y);
    c = to_lin(PAPER) * mix(0.25, 0.95, far);
  } else {
    c = mix(vec3(0.035, 0.037, 0.045), vec3(0.30, 0.31, 0.33), smoothstep(0.0, 0.22, d.y));
    c = mix(c, vec3(0.80, 0.81, 0.83), smoothstep(0.25, 0.95, d.y));
    // a large dim panel on the left gives the broad faces something to reflect
    float panel = smoothstep(0.25, 0.0, max(abs(d.x + 0.62) - 0.22, abs(d.y - 0.42) - 0.2));
    c += vec3(0.55) * panel;
    float top = dot(d, vec3(0, 1, 0));
    c += vec3(3.4) * smoothstep(0.978, 0.99, top);
    vec3 sd = normalize(vec3(0.85, 0.42, -0.3)); float along = dot(d, normalize(vec3(0.3, 0.0, 0.95)));
    float strip = smoothstep(0.05, 0.03, abs(dot(d, normalize(cross(sd, normalize(vec3(0.3, 0.0, 0.95))))))) * smoothstep(0.75, 0.9, dot(d, sd) + 0.4 * abs(along));
    c += vec3(1.3, 1.32, 1.38) * strip;
  }
  return c;
}
void main(){
  vec2 q = (uv * res * 2.0 - res) / res.y;
  vec3 d = normalize(cam * vec3(q, -2.6));
  // the paper is the plane y = 0; the metal is the part of the mixture above the level tau
  float t = 0.0, tp = (0.0 - eye.y) / d.y; bool hit = false; vec3 p;
  float tstart = (amp * 1.6 - eye.y) / d.y;
  t = max(tstart, 0.0);
  float prev = 1.0;
  float step_ = 0.01;
  for (int i = 0; i < 200; i++){
    p = eye + d * t;
    float h = H(p.xz); float gap = p.y - max(h, 0.0);
    if (h > 0.0 && gap < 0.0){
      // refine between the last two steps
      float a = t - step_, b = t; for (int k = 0; k < 8; k++){ float m = 0.5 * (a + b); vec3 pm = eye + d * m; if (pm.y - H(pm.xz) < 0.0) b = m; else a = m; }
      t = b; p = eye + d * t; hit = true; break;
    }
    if (t > tp) break;
    step_ = clamp(gap * 0.45, 0.002, 0.05); t += step_;
  }
  vec3 col;
  if (hit){
    vec2 g = G(p.xz); vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 r = reflect(d, n);
    float F = 0.72 + 0.28 * pow(1.0 - max(dot(-d, n), 0.0), 5.0);
    col = env(r) * F * vec3(0.90, 0.92, 0.95);
    // where the metal thins to nothing at its rim, it lets the paper through over a pixel or so
    float edge = smoothstep(0.0, 0.006, H(p.xz));
    vec3 pp = eye + d * tp; col = mix(to_lin(PAPER) * 0.7, col, edge);
    // the thin edge where the metal meets the paper is darker: it reflects the table, not the box
  } else {
    vec3 pp = eye + d * tp;
    vec3 base = to_lin(PAPER);
    // a soft shadow of the metal: march toward the light through the height field
    float sh = 1.0, s = 0.02;
    for (int k = 0; k < 28; k++){ vec3 x = pp + LDIR * s; float h = H(x.xz); if (h > x.y) sh = min(sh, 0.0); else sh = min(sh, 6.0 * (x.y - max(h, 0.0)) / s); s += 0.035; }
    sh = clamp(sh, 0.0, 1.0);
    // and a contact darkening right at the rim
    float rim = smoothstep(0.0, -0.05, H(pp.xz));
    col = base * (0.7 + 0.3 * sh) * mix(0.72, 1.0, rim);
    // the metal throws a little light on the paper too (a reflected glint)
  }
  col = col / (1.0 + 0.12 * col);
  o = vec4(to_srgb(col), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const gl = context(canvas), prog = program(gl, FS);
  fit_canvas(canvas, 1.5);
  const blobs = [[-0.9, 0.1, 1], [0.75, -0.05, 1], [0.05, 0.75, 0.7]], goal = blobs.map((b) => b.slice());
  const eye = [0, 3.0, 3.1], look = m4.look(eye, [0, 0, 0.05]);
  const cam = new Float32Array([look[0], look[4], look[8], look[1], look[5], look[9], look[2], look[6], look[10]]);
  let drag = -1;
  function draw() { pass(gl, prog, { res: [canvas.width, canvas.height], eye, cam, B: new Float32Array(blobs.flat()), sig: SIG, amp: AMP, tau: TAU }); }
  function readout() { const n = count_peaks(blobs).length; hud.innerHTML = `${lang === 'zh' ? '峰' : 'peaks'} <b>${n}</b> · σ = ${SIG}`; }
  // the pointer on the paper plane
  function ground(P) {
    const asp = canvas.width / canvas.height, qx = (P.x * 2 - 1) * asp, qy = P.y * 2 - 1;
    const d0 = [qx, qy, -2.6], d = [cam[0] * d0[0] + cam[3] * d0[1] + cam[6] * d0[2], cam[1] * d0[0] + cam[4] * d0[1] + cam[7] * d0[2], cam[2] * d0[0] + cam[5] * d0[1] + cam[8] * d0[2]];
    const t = -eye[1] / d[1]; return [eye[0] + d[0] * t, eye[2] + d[2] * t];
  }
  const sched = scheduler((dt) => {
    let moving = false;
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) { const v = goal[i][k] - blobs[i][k]; blobs[i][k] += v * Math.min(1, dt * 14); if (Math.abs(v) > 1e-4) moving = true; }
    draw(); readout(); return moving;
  });
  pointer(canvas, (kind, p) => {
    const [x, z] = ground(p);
    if (kind === 'down') { let best = 0.6; drag = -1; blobs.forEach((b, i) => { const dd = Math.hypot(b[0] - x, b[1] - z); if (dd < best) { best = dd; drag = i; } }); }
    if (kind === 'move' && p.down && drag >= 0) { goal[drag][0] = clamp(x, -2.2, 2.2); goal[drag][1] = clamp(z, -1.3, 1.3); sched.wake(); }
    if (kind === 'up') drag = -1;
  });
  draw(); readout();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 1.5); draw(); },
    demo() { goal[0][0] = -0.42; goal[1][0] = 0.38; sched.wake(); },
    async accept() {
      const rows = []; let ok = true;
      for (const d of [0.3, 0.5, 0.65, 0.7, 0.74, 0.78, 0.9, 1.2]) {
        const c = [[-d / 2, 0, 1], [d / 2, 0, 1], [0, 9, 0]], n = count_peaks(c).length, theory = d <= 2 * SIG ? 1 : 2;
        if (n !== theory) ok = false; rows.push(`${(d / SIG).toFixed(2)}σ→${n}`);
      }
      return { pass: ok, value: rows.join(' ') };
    },
  };
}
