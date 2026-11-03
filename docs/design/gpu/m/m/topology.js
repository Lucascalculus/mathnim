// M6 · Topology in glass. A mug becomes a torus without tearing or gluing: the cup fills, the body flows into the
// handle, the handle thickens into a ring and lies down. It is ray-traced as glass (refraction in and out, three
// wavelengths, Fresnel) over printed paper. Its one hole survives every frame; the page checks by computing the Euler
// characteristic χ of the voxelised solid along the way (a solid with g holes has χ = 1 − g).
// As a library primitive: a homotopy between signed distance fields, with a topology check.
import { context, program, pass, scheduler, fit_canvas, clamp } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';

export const meta = {
  id: 'topology',
  name: { zh: '拓扑 · 玻璃', en: 'Topology in glass' },
  means: { zh: '杯子不撕不粘地变成甜甜圈：杯身流进把手，把手长成圆环。从头到尾，洞只有一个。', en: 'A mug becomes a doughnut without tearing or gluing: the body flows into the handle, the handle grows into a ring. All the way, there is exactly one hole.' },
  test: { zh: '沿途每一帧体素化后的欧拉示性数 χ = 0（一个洞）', en: 'Along the way, the voxelised solid has Euler characteristic χ = 0 (one hole) at every sampled frame' },
  wide: true,
};

// the shape at time t ∈ [0, 1], as a signed distance; the same code in GLSL and in JS
const SDF_GLSL = `
uniform float T;
float sd_torus(vec3 p, float R, float r){ vec2 q = vec2(length(p.xy) - R, p.z); return length(q) - r; }
float sd_cyl(vec3 p, float r, float h){ vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
mat3 rotx(float a){ float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
float shape(vec3 p){
  float s1 = smoothstep(0.0, 0.25, T), s2 = smoothstep(0.15, 0.65, T), s3 = smoothstep(0.6, 1.0, T);
  // the handle: a vertical ring at the mug's side that thickens, then lies down and moves to the centre
  vec3 hc = mix(vec3(0.55, 0.45, 0.0), vec3(0.0, 0.2, 0.0), s3);
  vec3 q = rotx(-1.5708 * s3) * (p - hc);
  float R = mix(0.27, 0.42, s2), r = mix(0.065, 0.17, s2);
  float handle = sd_torus(q, R, r);
  // the body: a cup whose hollow fills first, then shrinks toward the handle's inner side and is absorbed
  float rb = mix(0.4, 0.05, s2), hb = mix(0.42, 0.06, s2);
  vec3 bc = mix(vec3(0.0, 0.42, 0.0), vec3(0.55 - mix(0.27, 0.42, s2) + 0.02, 0.45, 0.0), s2);
  bc = mix(bc, hc + vec3(-R, 0, 0), s3);
  float body = sd_cyl(p - bc, rb, hb) - 0.03;
  float cav = sd_cyl(p - bc - vec3(0, 0.08 + 0.4 * s1, 0), rb - 0.055, hb);
  body = max(body, -cav);
  return smin(handle, body, 0.06);
}`;
function shape_js(x, y, z, T) {
  const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const s1 = ss(0, 0.25, T), s2 = ss(0.15, 0.65, T), s3 = ss(0.6, 1, T);
  const hc = [mix(0.55, 0, s3), mix(0.45, 0.2, s3), 0], a = -1.5708 * s3, c = Math.cos(a), s = Math.sin(a);
  const px = x - hc[0], py = y - hc[1], pz = z - hc[2];
  // mat3(1,0,0, 0,c,s, 0,-s,c) * p  (column-major)
  const qx = px, qy = c * py - s * pz, qz = s * py + c * pz;
  const R = mix(0.27, 0.42, s2), r = mix(0.065, 0.17, s2);
  const handle = Math.hypot(Math.hypot(qx, qy) - R, qz) - r;
  const rb = mix(0.4, 0.05, s2), hb = mix(0.42, 0.06, s2);
  let bc = [mix(0, 0.55 - R + 0.02, s2), mix(0.42, 0.45, s2), 0];
  bc = [mix(bc[0], hc[0] - R, s3), mix(bc[1], hc[1], s3), mix(bc[2], hc[2], s3)];
  const cyl = (x, y, z, r, h) => { const dx = Math.hypot(x, z) - r, dy = Math.abs(y) - h; return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)); };
  let body = cyl(x - bc[0], y - bc[1], z - bc[2], rb, hb) - 0.03;
  const cav = cyl(x - bc[0], y - bc[1] - (0.08 + 0.4 * s1), z - bc[2], rb - 0.055, hb);
  body = Math.max(body, -cav);
  const k = 0.06, h = Math.min(1, Math.max(0, 0.5 + 0.5 * (body - handle) / k));
  return body + (handle - body) * h - k * h * (1 - h);
}

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform vec3 eye; uniform mat3 cam;` + SDF_GLSL + `
const vec3 L = normalize(vec3(-0.5, 0.9, 0.35));
vec3 grad(vec3 p){ vec2 e = vec2(0.0015, 0); return normalize(vec3(shape(p + e.xyy) - shape(p - e.xyy), shape(p + e.yxy) - shape(p - e.yxy), shape(p + e.yyx) - shape(p - e.yyx))); }
float march(vec3 ro, vec3 rd, float sgn, float tmax){ float t = 0.002; for (int i = 0; i < 110; i++){ float d = sgn * shape(ro + rd * t); if (d < 0.0008) return t; t += max(d * 0.9, 0.003); if (t > tmax) break; } return -1.0; }
// the paper: printed with a fine grid and a few lines of type-like rules, with the glass's soft shadow
vec3 paper(vec3 p){
  vec3 c = to_lin(PAPER);
  vec2 g = abs(fract(p.xz * 10.0 + 0.5) - 0.5) / fwidth(p.xz * 10.0);
  c *= 1.0 - 0.10 * (1.0 - min(min(g.x, g.y), 1.0));
  vec2 g2 = abs(fract(p.xz * 2.0 + 0.5) - 0.5) / fwidth(p.xz * 2.0);
  c *= 1.0 - 0.18 * (1.0 - min(min(g2.x, g2.y) / 1.3, 1.0));
  // glass casts a pale shadow: light is bent, not stopped; the core gathers a little light
  float s = 1.0, t = 0.02; for (int i = 0; i < 28; i++){ float d = shape(p + L * t); s = min(s, 8.0 * d / t); t += clamp(d, 0.02, 0.2); if (t > 3.0) break; }
  s = clamp(s, 0.0, 1.0);
  return c * mix(0.72, 1.0, s);
}
vec3 studio(vec3 d){ return to_lin(PAPER) * (0.8 + 0.2 * d.y) + vec3(3.0) * smoothstep(0.93, 0.99, dot(d, normalize(vec3(-0.6, 0.7, 0.4)))) + vec3(0.9) * smoothstep(0.96, 0.995, dot(d, normalize(vec3(0.8, 0.35, -0.5)))); }
vec3 behind(vec3 ro, vec3 rd){ if (rd.y < -0.001){ float t = -ro.y / rd.y; return paper(ro + rd * t); } return studio(rd); }
void main(){
  vec2 q = (uv * res * 2.0 - res) / res.y;
  vec3 rd = normalize(cam * vec3(q, -2.7)), ro = eye;
  float t = march(ro, rd, 1.0, 12.0);
  vec3 col;
  if (t < 0.0) col = behind(ro, rd);
  else {
    vec3 p = ro + rd * t, n = grad(p);
    float F = 0.04 + 0.96 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    vec3 refl = studio(reflect(rd, n));
    // three wavelengths, each with its own index: through the glass and out again
    vec3 tr = vec3(0);
    for (int k = 0; k < 3; k++){
      float eta = k == 0 ? 1.505 : k == 1 ? 1.515 : 1.53;
      vec3 d1 = refract(rd, n, 1.0 / eta);
      float t2 = march(p - n * 0.003, d1, -1.0, 3.0);
      vec3 c;
      if (t2 < 0.0) c = behind(p, d1);
      else {
        vec3 p2 = p - n * 0.003 + d1 * t2, n2 = -grad(p2);
        vec3 d2 = refract(d1, n2, eta);
        if (dot(d2, d2) < 0.5) d2 = reflect(d1, n2);   // total internal reflection
        c = behind(p2, d2) * exp(-t2 * vec3(0.35, 0.18, 0.22));
      }
      tr[k] = c[k];
    }
    col = mix(tr, refl, F);
    col += vec3(1.0) * pow(max(dot(reflect(rd, n), L), 0.0), 200.0) * 2.0;
  }
  col = col / (1.0 + 0.12 * col);
  o = vec4(to_srgb(col * 1.06), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', gl = context(canvas), prog = program(gl, FS);
  fit_canvas(canvas, 1.25);
  const S = { t: new Spring(0, 1.6, 1) };
  function camera() {
    const az = -0.5, el = 0.5, d = canvas.width < canvas.height ? 5.4 : 3.6, k = Math.min(1, Math.max(0, (S.t.x - 0.55) / 0.45)), target = [0.15 * (1 - k), 0.32 - 0.12 * k, 0];
    const eye = [target[0] + Math.sin(az) * Math.cos(el) * d, target[1] + Math.sin(el) * d, target[2] + Math.cos(az) * Math.cos(el) * d];
    const fwd = nrm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]), right = nrm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
    return { eye, cam: new Float32Array([...right, ...up, ...fwd.map((v) => -v)]) };
  }
  function draw() { const C = camera(); pass(gl, prog, { res: [canvas.width, canvas.height], eye: C.eye, cam: C.cam, T: S.t.x }); hud.innerHTML = zh ? `洞 <b>1</b> 个 · t = ${S.t.x.toFixed(2)}` : `<b>1</b> hole · t = ${S.t.x.toFixed(2)}`; }
  const sched = scheduler((dt) => { const b = S.t.step(dt); draw(); return b; });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, t: S.t.target, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true; S.t.to(clamp(drag.t + dx / 500, 0, 1)); sched.wake(); });
  canvas.addEventListener('pointerup', () => { if (drag && !drag.moved) { S.t.to(S.t.target > 0.5 ? 0 : 1); sched.wake(4000); } drag = null; });
  draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 1.25); draw(); },
    demo() { S.t.to(S.t.target > 0.5 ? 0 : 1); sched.wake(4000); },
    at(t) { S.t.snap(t); draw(); },
    async accept() {
      // the Euler characteristic of the voxelised solid (closed unit cubes): χ = V − E + F − C
      const res = [];
      for (const T of [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1]) res.push(euler(T));
      const ok = res.every((c) => c === 0);
      return { pass: ok, value: `χ ${zh ? '沿途' : 'along the way'}: ${res.join(', ')}` };
    },
  };
}
function euler(T, N = 72) {
  const lo = [-0.8, -0.1, -0.7], hi = [1.0, 1.0, 0.7], h = Math.max((hi[0] - lo[0]), (hi[1] - lo[1]), (hi[2] - lo[2])) / N;
  const nx = Math.ceil((hi[0] - lo[0]) / h), ny = Math.ceil((hi[1] - lo[1]) / h), nz = Math.ceil((hi[2] - lo[2]) / h);
  const occ = new Uint8Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) occ[(k * ny + j) * nx + i] = shape_js(lo[0] + (i + 0.5) * h, lo[1] + (j + 0.5) * h, lo[2] + (k + 0.5) * h, T) < 0 ? 1 : 0;
  // count the distinct vertices, edges and faces of the occupied cubes
  const V = new Set(), E = new Set(), F = new Set(); let C = 0;
  const key = (a, b, c) => (a * (ny + 2) + b) * (nz + 2) + c;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!occ[(k * ny + j) * nx + i]) continue; C++;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) V.add(key(i + a, j + b, k + c));
    // edges: along x, y, z (keyed by their lower corner and direction)
    for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) { E.add(key(i, j + b, k + c) * 3); E.add(key(i + b, j, k + c) * 3 + 1); E.add(key(i + b, j + c, k) * 3 + 2); }
    for (let a = 0; a < 2; a++) { F.add(key(i + a, j, k) * 3); F.add(key(i, j + a, k) * 3 + 1); F.add(key(i, j, k + a) * 3 + 2); }
  }
  return V.size - E.size + F.size - C;
}
const nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
