// M9 · Four dimensions. A tesseract of polished steel rods turns in 4D and is projected twice: 4D → 3D by
// perspective in w, 3D → the page by the camera. Its shadow on the paper is one more projection. Drag sideways to
// turn it in the xw plane: a quarter turn swaps the inner cube and the outer one, which is what "turning into the
// fourth dimension" looks like from here. Drag up and down to tilt it in ordinary space.
// As a library primitive: project4(points, rotation) for any 4D object.
import { context, program, pass, scheduler, fit_canvas, clamp } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';

export const meta = {
  id: 'tesseract',
  name: { zh: '四维 · 超立方体', en: 'Four dimensions: the tesseract' },
  means: { zh: '超立方体在四维里转：往第四维转四分之一圈，里面的立方体和外面的立方体就换了位置。地上的影子是再投影一次。', en: 'A tesseract turning in 4D: a quarter turn into the fourth dimension swaps the inner and outer cubes. Its shadow is one more projection.' },
  test: { zh: '旋转后四维边长不变（误差 < 10⁻¹²）；xw 转 90° 后内外立方体的顶点集合互换', en: 'Edge lengths in 4D unchanged by rotation (< 10⁻¹²); after 90° in xw the inner and outer cubes\' vertices swap' },
  wide: true,
};

// the 16 vertices (±1)⁴ and the 32 edges between vertices differing in one coordinate
export const V4 = Array.from({ length: 16 }, (_, i) => [0, 1, 2, 3].map((b) => (i >> b & 1 ? 1 : -1)));
export const E4 = []; for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (i < j) E4.push([i, j]); }
export function rot4(p, a, b) {
  // rotation by a in the xw plane, then b in the zw plane
  let [x, y, z, w] = p; let c = Math.cos(a), s = Math.sin(a); [x, w] = [c * x - s * w, s * x + c * w];
  c = Math.cos(b); s = Math.sin(b); [z, w] = [c * z - s * w, s * z + c * w]; return [x, y, z, w];
}
const proj3 = (p, dw = 3) => { const k = dw / (dw - p[3]); return [p[0] * k, p[1] * k, p[2] * k, p[3]]; };

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform vec4 P[16]; uniform vec2 E[32]; uniform mat3 cam; uniform vec3 eye;
const vec3 L = normalize(vec3(-0.5, 0.9, 0.35));
// distance from a ray to a capsule (rod), returning the ray parameter at the hit (or −1)
float rod(vec3 ro, vec3 rd, vec3 a, vec3 b, float r){
  vec3 ba = b - a, oa = ro - a; float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa), oaoa = dot(oa, oa);
  float A = baba - bard * bard, B = baba * rdoa - baoa * bard, C = baba * oaoa - baoa * baoa - r * r * baba, h = B * B - A * C;
  if (h >= 0.0){ float t = (-B - sqrt(h)) / A, y = baoa + t * bard; if (y > 0.0 && y < baba) return t;
    vec3 oc = (y <= 0.0) ? oa : ro - b; B = dot(rd, oc); C = dot(oc, oc) - r * r; h = B * B - C; if (h > 0.0) return -B - sqrt(h); }
  return -1.0;
}
vec3 rod_normal(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return (pa - h * ba) / r; }
float radius(float w){ return 0.035 + 0.02 * (w + 1.0) * 0.5; }
void main(){
  vec2 q = (uv * res * 2.0 - res) / res.y;
  vec3 rd = normalize(cam * vec3(q, -2.6)), ro = eye;
  vec3 col = to_lin(PAPER);
  // the paper (y = −2.2) and the shadow of every rod on it, cast by the one light
  float tg = (-2.2 - ro.y) / rd.y;
  if (tg > 0.0){
    vec3 g = ro + rd * tg; float sh = 1.0;
    for (int i = 0; i < 32; i++){ vec3 a = P[int(E[i].x)].xyz, b = P[int(E[i].y)].xyz; float t = rod(g, L, a, b, radius(0.0) * 1.6); if (t > 0.0) sh = min(sh, 0.0); else { vec3 ba = b - a; } }
    // soften: the shadow lies far below, so it is blurred by the light's size
    col *= mix(0.86, 1.0, sh);
    col *= 0.96 + 0.04 * smoothstep(8.0, 2.0, length(g.xz));
  }
  // the rods and the joints, nearest first
  float tb = 1e9; vec3 n = vec3(0); float wv = 0.0;
  for (int i = 0; i < 32; i++){
    vec4 A = P[int(E[i].x)], B = P[int(E[i].y)];
    float r = radius((A.w + B.w) * 0.5), t = rod(ro, rd, A.xyz, B.xyz, r);
    if (t > 0.0 && t < tb){ tb = t; n = rod_normal(ro + rd * t, A.xyz, B.xyz, r); wv = (A.w + B.w) * 0.5; }
  }
  for (int i = 0; i < 16; i++){ vec3 c = P[i].xyz; float r = radius(P[i].w) * 1.7; vec3 oc = ro - c; float b = dot(oc, rd), h = b * b - dot(oc, oc) + r * r; if (h > 0.0){ float t = -b - sqrt(h); if (t > 0.0 && t < tb){ tb = t; n = normalize(ro + rd * t - c); wv = P[i].w; } } }
  if (tb < 1e8){
    // polished steel: the studio reflected; nearer in w is warmer, farther is cooler (a depth cue in the 4th axis)
    vec3 r = reflect(rd, n);
    vec3 env = mix(vec3(0.18, 0.19, 0.21), vec3(0.96), smoothstep(-0.2, 0.7, r.y)) + vec3(2.5) * pow(max(dot(r, L), 0.0), 80.0);
    vec3 tint = mix(to_lin(COBALT) * 1.6, vec3(1.0), 0.55 + 0.45 * smoothstep(-1.0, 1.0, wv));
    col = env * tint * (0.8 + 0.2 * max(dot(n, L), 0.0));
  }
  col = col / (1.0 + 0.1 * col);
  o = vec4(to_srgb(col), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', gl = context(canvas), prog = program(gl, FS);
  fit_canvas(canvas, 1.5);
  const S = { a: new Spring(0.35, 0.8, 0.9), b: new Spring(0.2, 0.8, 0.9), tilt: new Spring(0.5, 0.6, 0.9), spin: new Spring(-0.55, 0.6, 0.9) };
  function camera() {
    const el = S.tilt.x, az = S.spin.x, d = canvas.width < canvas.height ? 12 : 8.2;
    const eye = [Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d];
    const f = nrm(eye.map((v) => -v)), r = nrm(cross(f, [0, 1, 0])), u = cross(r, f);
    return { eye, cam: new Float32Array([...r, ...u, ...f.map((v) => -v)]) };
  }
  function draw() {
    const pts = V4.map((p) => proj3(rot4(p, S.a.x, S.b.x)));
    const C = camera();
    pass(gl, prog, { res: [canvas.width, canvas.height], P: new Float32Array(pts.flat()), E: new Float32Array(E4.flat()), cam: C.cam, eye: C.eye });
    hud.innerHTML = `${zh ? '在 xw 平面转了' : 'turned in the xw plane by'} <b>${(S.a.x * 180 / Math.PI).toFixed(0)}°</b>`;
  }
  const sched = scheduler((dt) => { let b = false; for (const s of Object.values(S)) b = s.step(dt) || b; draw(); return b; });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, a: S.a.target, t: S.tilt.target, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) drag.moved = true; S.a.to(drag.a + dx / 160); S.tilt.to(clamp(drag.t + dy / 300, 0.1, 1.3)); sched.wake(); });
  canvas.addEventListener('pointerup', () => { if (drag && !drag.moved) { S.a.to(Math.round(S.a.target / (Math.PI / 2)) * Math.PI / 2 + Math.PI / 2); sched.wake(3000); } drag = null; });
  draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 1.5); draw(); },
    demo() { S.a.to(S.a.target + Math.PI / 2); sched.wake(3000); },
    at(a) { S.a.snap(a); draw(); },
    async accept() {
      let worst = 0;
      for (const [a, b] of [[0.3, 0.7], [1.1, -0.4], [2.9, 1.3]]) for (const [i, j] of E4) { const p = rot4(V4[i], a, b), q = rot4(V4[j], a, b); worst = Math.max(worst, Math.abs(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2], p[3] - q[3]) - 2)); }
      // inner cube: w = −1 (smaller after the w-perspective); after 90° in xw, the vertices that were inner are outer
      const inner0 = V4.map((p, i) => [i, proj3(p)]).filter(([, p]) => p[3] < 0).map(([i]) => i);
      const after = V4.map((p) => proj3(rot4(p, Math.PI / 2, 0)));
      const size = (idx) => Math.max(...idx.map((i) => Math.max(Math.abs(after[i][0]), Math.abs(after[i][1]), Math.abs(after[i][2]))));
      const outer_now = V4.map((_, i) => i).filter((i) => after[i][3] > 0);
      // the set of projected positions of the old inner cube equals the set the old outer cube had
      const pos0 = V4.map((p) => proj3(p)), key = (p) => p.slice(0, 3).map((v) => v.toFixed(6)).join(',');
      const old_outer = new Set(V4.map((_, i) => i).filter((i) => pos0[i][3] > 0).map((i) => key(pos0[i])));
      const now_outer = new Set(outer_now.map((i) => key(after[i])));
      const swapped = [...old_outer].every((k) => now_outer.has(k)) && old_outer.size === now_outer.size && inner0.length === 8;
      return { pass: worst < 1e-12 && swapped, value: `${zh ? '边长误差' : 'edge length error'} ${worst.toExponential(1)}; ${zh ? '内外互换' : 'inner and outer swap'} ${swapped ? '✓' : '✗'}` };
    },
  };
}
const nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
