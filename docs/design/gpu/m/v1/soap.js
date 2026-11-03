// 2 · Soap film. Between two rings a film finds the least area it can: a catenoid, r(x) = a·cosh(x/a).
// Pull the rings apart and past h/R ≈ 1.3255 no catenoid exists, so the film breaks into two discs.
// Its colour is real thin-film interference, integrated over the visible spectrum.
import { context, program, pass, scheduler, pointer, fit_canvas, m4, clamp } from '../../lib/gl.js';

export const meta = {
  id: 'soap',
  name: { zh: '皂膜', en: 'Soap film' },
  means: { zh: '膜总是找面积最小的形状；拉得太开，最小曲面不存在了，膜就破。', en: 'A film always finds the least area; pull too far and no minimal surface exists, so it breaks.' },
  test: { zh: '破裂点 h/R = 1.3255 ± 0.01；颜色按牛顿色序', en: 'Breaks at h/R = 1.3255 ± 0.01; colours follow Newton\'s series' },
  night: true,
};

export const LIMIT = 1.3255;
// the stable catenoid through rings of radius R at ±h/2: R = a·cosh(h/2a), the larger root a
export function catenoid(h, R = 1) {
  // f(a) = a·cosh(h/2a) − R has a minimum in a; the stable root is to the right of it
  const f = (a) => a * Math.cosh(h / (2 * a)) - R;
  let lo = 1e-4, hi = R;
  // the minimum of f: golden search
  let a0 = lo, a1 = hi;
  for (let i = 0; i < 80; i++) { const m1 = a0 + (a1 - a0) * 0.382, m2 = a0 + (a1 - a0) * 0.618; if (f(m1) < f(m2)) a1 = m2; else a0 = m1; }
  const amin = (a0 + a1) / 2;
  if (f(amin) > 0) return null;
  lo = amin; hi = R;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform vec3 eye; uniform mat3 cam; uniform float h; uniform float a; uniform float t;
uniform float film; uniform float pop; uniform vec3 pop_at; uniform float discs;
const float R = 1.0, WIRE = 0.028;
float sd_ring(vec3 p, float x0){ vec2 q = vec2(length(p.yz) - R, p.x - x0); return length(q) - WIRE; }
float sd_rings(vec3 p){ return min(sd_ring(p, -h * 0.5), sd_ring(p, h * 0.5)); }
// signed distance (approximate, Lipschitz-corrected) to the catenoid between the rings
float sd_cat(vec3 p){ float c = cosh(p.x / a); float d = (length(p.yz) - a * c) / c; return max(d, -d) ; }
// film thickness in nm: gravity drains it to the top, slow swirls stir it
float thickness(vec3 p){
  float g = 0.5 - 0.5 * p.y / R;
  float sw = fbm(vec2(atan(p.z, p.y) * 1.3 + t * 0.05, p.x * 1.6 - t * 0.09) * 1.7);
  return mix(80.0, 900.0, g * g) * (0.75 + 0.5 * sw);
}
vec3 film_rgb(float d, float cosi){
  // Airy reflectance of a thin water layer in air, summed over the spectrum
  float n = 1.333, sint = sqrt(1.0 - cosi * cosi) / n, cost = sqrt(1.0 - sint * sint);
  float rs = (cosi - n * cost) / (cosi + n * cost), rp = (n * cosi - cost) / (n * cosi + cost);
  vec3 acc = vec3(0); vec3 white = vec3(0);
  for (int i = 0; i < 24; i++){
    float l = 390.0 + float(i) * 14.0;
    float delta = 4.0 * 3.14159265 * n * d * cost / l;
    float Rs = 2.0 * rs * rs * (1.0 - cos(delta)) / (1.0 + rs * rs * rs * rs - 2.0 * rs * rs * cos(delta));
    float Rp = 2.0 * rp * rp * (1.0 - cos(delta)) / (1.0 + rp * rp * rp * rp - 2.0 * rp * rp * cos(delta));
    vec3 c = cie_xyz(l); acc += c * 0.5 * (Rs + Rp); white += c;
  }
  return max(xyz_to_lin_srgb(acc / white.y), 0.0);
}
vec3 backdrop(vec3 d){
  // a dark studio with one soft box high on the left: the film only shows colour where it reflects light
  float box = smoothstep(0.55, 0.9, dot(d, normalize(vec3(-0.6, 0.65, 0.45))));
  float rim = smoothstep(0.7, 0.98, dot(d, normalize(vec3(0.8, 0.2, 0.5))));
  return vec3(0.010, 0.011, 0.015) + vec3(1.0, 0.98, 0.95) * box * 1.4 + vec3(0.7, 0.75, 0.85) * rim * 0.35;
}
vec3 screen_bg(vec2 q){ float v = 1.0 - 0.35 * length(q - vec2(-0.2, 0.25)); return to_lin(vec3(0.075, 0.08, 0.1)) * v; }
void main(){
  vec2 q = (uv * res * 2.0 - res) / res.y;
  vec3 d = normalize(cam * vec3(q, -2.2));
  vec3 col = screen_bg(q);
  // the rings (opaque wire)
  float tr = 0.0; bool hit_ring = false;
  for (int i = 0; i < 90; i++){ vec3 p = eye + d * tr; float s = sd_rings(p); if (s < 0.0008){ hit_ring = true; break; } tr += s; if (tr > 12.0) break; }
  float tmax = hit_ring ? tr : 12.0;
  // the film: up to two crossings (front and back), each reflects and lets the rest through
  vec3 film_acc = vec3(0); float trans = 1.0;
  if (film > 0.0){
    float tf = 0.0; int found = 0;
    for (int i = 0; i < 140 && found < 2; i++){
      vec3 p = eye + d * tf;
      float s = sd_cat(p);
      if (abs(p.x) > h * 0.5){ // outside the span: march to the span
        float tx = (sign(-d.x * sign(p.x)) > 0.0) ? (abs(p.x) - h * 0.5) / abs(d.x) + 0.002 : 99.0;
        if (sign(p.x) * d.x > 0.0) break;
        tf += max(tx, 0.002); continue;
      }
      if (s < 0.0006){
        if (tf > tmax) break;
        float c = cosh(p.x / a);
        vec3 nrm = normalize(vec3(-sinh(p.x / a) , p.y / length(p.yz), p.z / length(p.yz)));
        float cosi = abs(dot(d, nrm));
        float holed = pop > 0.0 ? step(length(p - pop_at), pop * 3.2) : 0.0;
        if (holed < 0.5){
          vec3 Rf = film_rgb(thickness(p) * film, cosi);
          vec3 env = backdrop(reflect(d, nrm * sign(-dot(d, nrm))));
          film_acc += trans * Rf * env;
          trans *= 1.0 - dot(Rf, vec3(0.333)) * 0.9;
          // the edge of a growing hole: the film gathers into a bright rim
          if (pop > 0.0){ float e = abs(length(p - pop_at) - pop * 3.2); film_acc += trans * vec3(0.8) * smoothstep(0.035, 0.0, e) * 0.6; }
        }
        found++; tf += 0.01;
      } else tf += max(s * 0.8, 0.0015);
      if (tf > tmax) break;
    }
  }
  // the two discs a broken film leaves behind
  if (discs > 0.0){
    for (int k = 0; k < 2; k++){
      float x0 = (k == 0 ? -0.5 : 0.5) * h;
      float tt = (x0 - eye.x) / d.x; vec3 p = eye + d * tt;
      if (tt > 0.0 && tt < tmax && length(p.yz) < R){
        float th = mix(120.0, 950.0, pow(0.5 - 0.5 * p.y, 1.5)) * (0.8 + 0.4 * fbm(p.yz * 2.0 + t * 0.03 + float(k) * 7.0));
        vec3 Rf = film_rgb(th, abs(d.x)); film_acc += trans * Rf * backdrop(reflect(d, vec3(-sign(d.x), 0, 0))) * discs; trans *= 1.0 - 0.2 * discs;
      }
    }
  }
  if (hit_ring){
    vec3 p = eye + d * tr; vec2 e = vec2(0.001, 0);
    vec3 nrm = normalize(vec3(sd_rings(p + e.xyy) - sd_rings(p - e.xyy), sd_rings(p + e.yxy) - sd_rings(p - e.yxy), sd_rings(p + e.yyx) - sd_rings(p - e.yyx)));
    vec3 env = backdrop(reflect(d, nrm));
    col = vec3(0.04) + env * 0.55;
  }
  col = col * trans + film_acc;
  col = col / (1.0 + col * 0.4);
  o = vec4(to_srgb(col * 1.25), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const gl = context(canvas), prog = program(gl, FS);
  const S = { hr: 0.9, target: 0.9, a: catenoid(0.9), film: 1, pop: 0, discs: 0, t: 0, broken: false, pop_at: [0, 1, 0] };
  fit_canvas(canvas, 1.5);
  const yaw = -0.62, pitch = 0.18, dist = 4.3;
  const eye = [Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist];
  const look = m4.look(eye, [0, 0, 0]);
  const cam = new Float32Array([look[0], look[4], look[8], look[1], look[5], look[9], look[2], look[6], look[10]]);
  function draw() { pass(gl, prog, { res: [canvas.width, canvas.height], eye, cam, h: S.hr, a: S.a || 0.5, t: S.t, film: S.film, pop: S.pop, pop_at: S.pop_at, discs: S.discs }); }
  function readout() {
    const v = S.hr.toFixed(3);
    hud.innerHTML = S.broken ? `h/R <b>${v}</b> · ${lang === 'zh' ? '最小曲面不存在了' : 'no minimal surface'}` : `h/R <b>${v}</b> · ${lang === 'zh' ? '极限' : 'limit'} ${LIMIT}`;
  }
  const sched = scheduler((dt) => {
    S.t += dt;
    S.hr += (S.target - S.hr) * Math.min(1, dt * 8);
    if (!S.broken) {
      S.a = catenoid(S.hr);
      if (!S.a) { S.broken = true; S.a = catenoid(LIMIT - 1e-4); S.pop_at = [0, -0.62, 0.0]; S.pop = 0.001; }
    }
    if (S.broken && S.pop > 0) { S.pop += dt * 1.6; if (S.pop > 1.2) { S.pop = 0; S.film = 0; } S.discs = Math.min(1, S.discs + dt * 2); }
    readout(); draw();
    return Math.abs(S.target - S.hr) > 1e-4 || S.pop > 0;
  });
  pointer(canvas, (kind, p) => {
    if (kind === 'down' && S.broken && S.target < 1.15) { S.broken = false; S.film = 1; S.discs = 0; S.pop = 0; }   // dip again
    if (kind === 'down' || (kind === 'move' && p.down)) { S.target = clamp(0.35 + p.x * 1.25, 0.35, 1.55); sched.wake(2500); }
  });
  readout(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 1.5); draw(); },
    demo() { S.target = 1.18; sched.wake(2500); },
    async accept() {
      // sweep the separation and find where the catenoid stops existing
      let hb = 0; for (let h = 1.0; h < 1.5; h += 0.0002) if (!catenoid(h)) { hb = h; break; }
      const order = newton_series();
      const pass_ = Math.abs(hb - LIMIT) < 0.01 && order.ok;
      return { pass: pass_, value: `${lang === 'zh' ? '破裂于' : 'breaks at'} h/R = ${hb.toFixed(4)}; ${order.text}` };
    },
  };
}

// the same Airy sum on the CPU, to check the colour order: dark → white → yellow → magenta → blue
function film_rgb_cpu(d) {
  const n = 1.333, r = (1 - n) / (1 + n); let X = 0, Y = 0, Z = 0, W = 0;
  for (let i = 0; i < 48; i++) {
    const l = 390 + i * 7, delta = 4 * Math.PI * n * d / l, R = 2 * r * r * (1 - Math.cos(delta)) / (1 + r ** 4 - 2 * r * r * Math.cos(delta));
    const [x, y, z] = cie(l); X += x * R; Y += y * R; Z += z * R; W += y;
  }
  X /= W; Y /= W; Z /= W;
  return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
}
function cie(l) {
  const g = (x, m, a, b) => { const t = (x - m) * (x < m ? a : b); return Math.exp(-0.5 * t * t); };
  return [0.362 * g(l, 442, 0.0624, 0.0374) + 1.056 * g(l, 599.8, 0.0264, 0.0323) - 0.065 * g(l, 501.1, 0.049, 0.0382), 0.821 * g(l, 568.8, 0.0213, 0.0247) + 0.286 * g(l, 530.9, 0.0613, 0.0322), 1.217 * g(l, 437, 0.0845, 0.0278) + 0.681 * g(l, 459, 0.0385, 0.0725)];
}
function newton_series() {
  const hue = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 1e-6) return -1; let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); return ((h * 60) + 360) % 360; };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const black = lum(film_rgb_cpu(10)), white = film_rgb_cpu(100), yel = hue(film_rgb_cpu(130)), mag = hue(film_rgb_cpu(190)), blu = hue(film_rgb_cpu(230));
  const sat = (c) => (Math.max(...c) - Math.min(...c)) / (Math.max(...c) + 1e-9);
  const ok = black < 0.002 && sat(white) < 0.35 && yel > 20 && yel < 70 && (mag > 280 || mag < 20) && blu > 190 && blu < 260;
  return { ok, text: `10 nm Y=${black.toFixed(4)}, 130 nm ${yel.toFixed(0)}°, 190 nm ${mag.toFixed(0)}°, 230 nm ${blu.toFixed(0)}°` };
}
