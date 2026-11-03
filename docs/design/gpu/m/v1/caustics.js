// 1 · Caustics. Light through moving water lands squeezed or spread: its brightness on the floor is exactly the
// area ratio of the light map, 1/|det J|. A wave equation on a height field, a refracted light mesh whose
// fragments carry that ratio, and a ray-traced view of the basin.
import { context, program, pass, pingpong, target, use, scheduler, pointer, fit_canvas, m4, read_float, norm, grid_indices } from '../../lib/gl.js';

export const meta = {
  id: 'caustics',
  name: { zh: '焦散', en: 'Caustics' },
  means: { zh: '光被水面挤到一起的地方更亮，亮多少恰好是面积缩小的倍数：1/|det J|。', en: 'Where the water squeezes light together it is brighter, by exactly how much the area shrank: 1/|det J|.' },
  test: { zh: '池底总光量 ÷ 入射光量，在 3% 以内', en: 'Total light on the floor ÷ light arriving, within 3 %' },
};

const N = 256, CN = 200, CRES = 512, D = 0.85, RIM = 0.07;
const LIGHT = norm([-0.08, -1, -0.05]);

const SIM = `
in vec2 uv; out vec4 o;
uniform sampler2D w; uniform vec2 texel; uniform vec4 drop;
void main(){
  vec4 c = texture(w, uv);
  float avg = (texture(w, uv + vec2(texel.x, 0)).r + texture(w, uv - vec2(texel.x, 0)).r + texture(w, uv + vec2(0, texel.y)).r + texture(w, uv - vec2(0, texel.y)).r) * 0.25;
  c.g += (avg - c.r) * 2.0; c.g *= 0.994; c.r += c.g;
  float d = max(0.0, 1.0 - length(uv - drop.xy) / drop.z); d = 0.5 - cos(d * 3.14159265) * 0.5; c.r += d * drop.w;
  o = c;
}`;
const NORMAL = `
in vec2 uv; out vec4 o;
uniform sampler2D w; uniform vec2 texel; uniform float cell;
void main(){
  vec4 c = texture(w, uv);
  float hx = texture(w, uv + vec2(texel.x, 0)).r - texture(w, uv - vec2(texel.x, 0)).r;
  float hz = texture(w, uv + vec2(0, texel.y)).r - texture(w, uv - vec2(0, texel.y)).r;
  o = vec4(c.r, c.g, hx / (2.0 * cell), hz / (2.0 * cell));
}`;
// the light mesh: each vertex is a point of the water surface; it moves to where its refracted ray meets the floor
const CAUSTIC_VS = `
uniform sampler2D w; uniform vec3 L; uniform float depth; uniform int n;
out vec3 p_old; out vec3 p_new;
vec3 hit(vec3 p, vec3 r){ return p + r * ((-depth - p.y) / r.y); }
void main(){
  int i = gl_VertexID % (n + 1), j = gl_VertexID / (n + 1);
  vec2 g = vec2(float(i), float(j)) / float(n), xz = g * 2.0 - 1.0;
  vec4 s = texture(w, g);
  vec3 nrm = normalize(vec3(-s.b, 1.0, -s.a));
  p_old = hit(vec3(xz.x, 0.0, xz.y), refract(L, vec3(0, 1, 0), 1.0 / 1.333));
  p_new = hit(vec3(xz.x, s.r, xz.y), refract(L, nrm, 1.0 / 1.333));
  gl_Position = vec4(p_new.x, p_new.z, 0.0, 1.0);
}`;
const CAUSTIC_FS = `
in vec3 p_old; in vec3 p_new; out vec4 o;
void main(){
  float a_old = length(cross(dFdx(p_old), dFdy(p_old)));
  float a_new = length(cross(dFdx(p_new), dFdy(p_new)));
  o = vec4(min(a_old / max(a_new, 1e-9), 60.0), 0.0, 0.0, 1.0);
}`;
const VIEW = `
in vec2 uv; out vec4 o;
uniform mat4 inv_vp; uniform vec3 eye; uniform sampler2D w; uniform sampler2D caustic; uniform vec3 L; uniform float depth; uniform float rim; uniform float flat_sum;
vec3 env(vec3 d){
  // a quiet studio: paper all round, one soft light where the sun is
  float k = max(dot(d, -L), 0.0);
  return vec3(0.92, 0.915, 0.9) * (0.75 + 0.25 * d.y) + vec3(1.0) * pow(k, 200.0) * 6.0 + vec3(1.0) * pow(k, 12.0) * 0.25;
}
float grid(vec2 p, float s, float wpx){ vec2 g = abs(fract(p * s - 0.5) - 0.5) / fwidth(p * s); return 1.0 - min(min(g.x, g.y) / wpx, 1.0); }
vec3 floor_col(vec3 p){
  vec3 c = to_lin(PAPER) * 0.93;
  float fine = grid(p.xz, 10.0, 0.7), major = grid(p.xz, 2.0, 1.1);
  c = mix(c, to_lin(GRAPHITE), 0.18 * fine); c = mix(c, to_lin(INK), 0.28 * major);
  // one figure printed on the floor: a cobalt ring
  float r = abs(length(p.xz - vec2(0.18, -0.1)) - 0.42); c = mix(c, to_lin(COBALT), 0.85 * (1.0 - smoothstep(0.006, 0.012, r)));
  return c;
}
vec3 under(vec3 p, vec3 d){
  // inside the basin: walls at |x|,|z| = 1, floor at -depth
  float tf = (-depth - p.y) / d.y;
  vec2 tw = (sign(d.xz) - p.xz) / d.xz; float t = min(tf, min(tw.x, tw.y));
  vec3 q = p + d * t;
  vec3 absorb = exp(-t * vec3(0.30, 0.07, 0.05));
  if (t == tf){
    float c = texture(caustic, q.xz * 0.5 + 0.5).r;
    float lit = c * 0.62 * max(-L.y, 0.0) + 0.16;
    return floor_col(q) * lit * absorb;
  }
  float ao = 0.55 + 0.45 * smoothstep(-depth, 0.0, q.y);
  return to_lin(PAPER) * 0.8 * ao * absorb;
}
void main(){
  vec4 a = inv_vp * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(a.xyz / a.w - eye);
  float t = (rim - eye.y) / d.y; vec3 h = eye + d * t;
  vec3 col;
  if (max(abs(h.x), abs(h.z)) > 1.0){
    // the plaster around the basin, with a soft contact shade at its edge
    float e = max(abs(h.x), abs(h.z)) - 1.0;
    col = to_lin(PAPER) * (0.86 + 0.08 * smoothstep(0.0, 0.08, e));
  } else {
    float t0 = (0.0 - eye.y) / d.y; vec3 p = eye + d * t0;
    vec2 tw = (sign(d.xz) - eye.xz) / d.xz; float twall = min(tw.x, tw.y);
    if (twall < t0){ vec3 q = eye + d * twall; col = to_lin(PAPER) * 0.74 * (0.85 + 0.15 * smoothstep(0.0, rim, q.y)); }
    else {
      vec4 s = texture(w, p.xz * 0.5 + 0.5);
      vec3 nrm = normalize(vec3(-s.b, 1.0, -s.a));
      float cosi = max(dot(-d, nrm), 0.0);
      float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
      vec3 r = reflect(d, nrm), tr = refract(d, nrm, 1.0 / 1.333);
      col = mix(under(p, tr), env(r), F);
    }
  }
  col = col / (1.0 + 0.18 * col); o = vec4(to_srgb(col * 1.12), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const gl = context(canvas);
  const sim = pingpong(gl, N, N, { type: 'f32' }), caus = target(gl, CRES, CRES, { type: 'f32' });
  const P = { sim: program(gl, SIM), nrm: program(gl, NORMAL), view: program(gl, VIEW), caus: program(gl, CAUSTIC_FS, CAUSTIC_VS) };
  const mesh = grid_indices(gl, CN);
  const drops = [];
  let flat_sum = 0, last_input = -1e9, cam = null;

  function camera() {
    const asp = canvas.width / canvas.height, eye = [0, 3.1, 3.3];
    const vp = m4.mul(m4.persp(0.62, asp, 0.1, 20), m4.look(eye, [0, -0.25, 0.05]));
    cam = { eye, vp, inv: m4.inv(vp) };
  }
  function sim_step() {
    const dr = drops.shift() || [0, 0, 0.001, 0];
    pass(gl, P.sim, { w: sim.read, texel: [1 / N, 1 / N], drop: dr }, sim.write); sim.swap();
  }
  function normals() { pass(gl, P.nrm, { w: sim.read, texel: [1 / N, 1 / N], cell: 2 / N }, sim.write); sim.swap(); }
  function caustics() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, caus.fb); gl.viewport(0, 0, CRES, CRES);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    use(gl, P.caus, { w: sim.read, L: LIGHT, depth: D, n: CN });
    gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
  function view() { pass(gl, P.view, { inv_vp: cam.inv, eye: cam.eye, w: sim.read, caustic: caus, L: LIGHT, depth: D, rim: RIM, flat_sum }); }
  function light_sum() { const px = read_float(gl, caus); let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i]; return s; }

  fit_canvas(canvas); camera();
  normals(); caustics(); flat_sum = light_sum();

  const sched = scheduler((dt, t) => {
    for (let k = 0; k < 2; k++) sim_step();
    normals(); caustics(); view();
    return performance.now() - last_input < 9000;
  });
  // the pointer touches the water where its ray meets the surface
  function water_at(P) {
    const a = mul4(cam.inv, [P.x * 2 - 1, P.y * 2 - 1, 1, 1]), q = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], e = cam.eye;
    const d = [q[0] - e[0], q[1] - e[1], q[2] - e[2]], t = -e[1] / d[1];
    return [e[0] + d[0] * t, e[2] + d[2] * t];
  }
  pointer(canvas, (kind, p) => {
    if (kind === 'move' && !p.down && p.inside) { const [x, z] = water_at(p); if (Math.max(Math.abs(x), Math.abs(z)) < 1) drops.push([x * 0.5 + 0.5, z * 0.5 + 0.5, 0.025, 0.004]); }
    if (kind === 'down' || (kind === 'move' && p.down)) { const [x, z] = water_at(p); if (Math.max(Math.abs(x), Math.abs(z)) < 1) drops.push([x * 0.5 + 0.5, z * 0.5 + 0.5, 0.05, kind === 'down' ? 0.03 : 0.01]); }
    last_input = performance.now(); sched.wake();
  });
  view();
  const demo = () => {
    for (const [x, z, s] of [[-0.3, 0.2, 0.035], [0.35, -0.25, 0.03], [0.1, 0.45, 0.02]]) drops.push([x * 0.5 + 0.5, z * 0.5 + 0.5, 0.06, s]);
    for (let i = 0; i < 40; i++) sim_step();
    last_input = performance.now(); sched.wake();
  };
  demo();
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { fit_canvas(canvas); camera(); view(); },
    demo,
    async accept() {
      demo(); for (let i = 0; i < 30; i++) sim_step(); normals(); caustics();
      const s = light_sum(), r = s / flat_sum;
      hud.innerHTML = `${lang === 'zh' ? '池底总光量' : 'light on the floor'} <b>${(r * 100).toFixed(1)}%</b>`;
      return { pass: Math.abs(r - 1) < 0.03, value: (r * 100).toFixed(2) + '%' };
    },
  };
}
function mul4(m, v) { const o = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) o[i] += m[k * 4 + i] * v[k]; return o; }
