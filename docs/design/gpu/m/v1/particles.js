// 6 · Light particles. 262 144 grains of light, each a sample. They do Langevin dynamics on a density that lives on
// an outline: step along the score ∇log p, plus noise of exactly the right size. Whatever they start as, they end
// as samples of p, a band of width s around the outline (the idea under diffusion models). The hand heats them.
import { context, program, pass, pingpong, target, scheduler, pointer, fit_canvas, read_float, use } from '../../lib/gl.js';

export const meta = {
  id: 'particles',
  name: { zh: '光粒', en: 'Light particles' },
  means: { zh: '每粒光都是一次抽样：顺着“更可能”的方向走一步，再抖一下，最后它们就画出了分布。', en: 'Each grain of light is a sample: a step towards "more likely", a shake, and together they draw the distribution.' },
  test: { zh: '落在轮廓 2s 以内的比例 = 95.4% ± 3%', en: 'Share within 2s of the outline = 95.4 % ± 3 %' },
  night: true,
};

const TS = 512, N = TS * TS, S = 0.012;
// the shapes, as signed distances (world: x ∈ [−asp, asp], y ∈ [−1, 1])
const SDF = `
uniform float shape; uniform float asp;
float sd_box(vec2 p, vec2 c, vec2 b){ vec2 d = abs(p - c) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sd_circle(vec2 p, vec2 c, float r){ return length(p - c) - r; }
// the outline is |sdf| = 0; id says which thing a point belongs to (cart 1, ball 2, wall 3, ground 0)
float scene(vec2 p, out float id){
  float cart = abs(sd_box(p, vec2(-0.82, -0.36), vec2(0.36, 0.2)));
  float w1 = abs(sd_circle(p, vec2(-1.04, -0.62), 0.085)), w2 = abs(sd_circle(p, vec2(-0.6, -0.62), 0.085));
  cart = min(cart, min(w1, w2));
  float ball = abs(sd_circle(p, vec2(0.22, -0.5), 0.2));
  float wall = abs(sd_box(p, vec2(0.95, -0.12), vec2(0.07, 0.6)));
  float ground = abs(p.y + 0.715) + max(abs(p.x) - 1.35, 0.0);
  float d = min(min(cart, ball), min(wall, ground));
  id = d == cart ? 1.0 : d == ball ? 2.0 : d == wall ? 3.0 : 0.0;
  return d;
}
float ring(vec2 p, out float id){ id = 2.0; return abs(sd_circle(p, vec2(0.0, 0.0), 0.62)); }
// one shape, or the morph between two: the density is always exp(−d²/2s²) of the blended distance
float sdf(vec2 p, out float id){
  float i1, i2; float a = ring(p, i1), b = scene(p, i2);
  float t = clamp(shape, 0.0, 1.0); id = t < 0.5 ? i1 : i2;
  return mix(a, b, t);
}
vec2 sdf_grad(vec2 p){ float i; vec2 e = vec2(0.0015, 0); return vec2(sdf(p + e.xy, i) - sdf(p - e.xy, i), sdf(p + e.yx, i) - sdf(p - e.yx, i)) / 0.003; }
`;
const STEP = `in vec2 uv; out vec4 o; uniform sampler2D st; uniform float eps; uniform float s; uniform float seed; uniform vec3 heat;` + SDF + `
vec2 gauss(vec2 q){ vec2 u = hash22(q); u.x = max(u.x, 1e-7); return sqrt(-2.0 * log(u.x)) * vec2(cos(6.2831853 * u.y), sin(6.2831853 * u.y)); }
void main(){
  vec4 x = texelFetch(st, ivec2(gl_FragCoord.xy), 0); float id;
  float d = sdf(x.xy, id); vec2 g = sdf_grad(x.xy);
  // score of p ∝ exp(−d²/2s²): ∇log p = −d ∇d / s²
  vec2 score = -d * g / (s * s);
  float T = 1.0 + heat.z * exp(-dot(x.xy - heat.xy, x.xy - heat.xy) / 0.02);
  vec2 xi = gauss(gl_FragCoord.xy * 0.731 + seed * 91.7);
  vec2 dx = eps * score + sqrt(2.0 * eps * T) * xi;
  float m = length(dx); if (m > 0.08) dx *= 0.08 / m;
  // remember the drift (the score step) for the streak; the noise is not motion one can see
  vec2 drift = eps * score; float dm = length(drift); if (dm > 0.08) drift *= 0.08 / dm;
  x.zw = drift; x.xy += dx;
  x.x = clamp(x.x, -asp, asp); x.y = clamp(x.y, -1.0, 1.0);
  o = x;
}`;
// each grain is drawn as the segment it travelled this step: a streak while it moves, a point at rest.
// Its light is spread over the streak's length, so a moving grain is no brighter than a still one.
const DOT_VS = `uniform sampler2D st; uniform float px_world;` + SDF + `
out vec3 col;
void main(){
  int id = gl_VertexID / 2; vec4 x = texelFetch(st, ivec2(id % ${TS}, id / ${TS}), 0);
  vec2 b = x.xy, a = b - x.zw * 10.0; float len = length(b - a);
  float k; sdf(b, k);
  float r = hash12(vec2(float(id), 3.0));
  col = (k == 1.0 ? COBALT * 1.7 : k == 3.0 ? OCHRE * 1.5 : vec3(0.78, 0.82, 0.95)) * (0.5 + r);
  col *= 0.05 * px_world / max(len, px_world);
  // the streak trails behind the grain over the last six steps' worth of motion
  // a line shorter than a pixel would not be drawn at all: give every grain at least one pixel
  if (len < px_world * 1.2) a = b - vec2(px_world * 1.2, 0.0);
  vec2 p = gl_VertexID % 2 == 0 ? a : b;
  gl_Position = vec4(p.x / asp, p.y, 0, 1); gl_PointSize = 1.0;
}`;
const DOT_FS = `in vec3 col; out vec4 o; void main(){ o = vec4(col, 1.0); }`;
const SHOW = `in vec2 uv; out vec4 o; uniform sampler2D acc;
void main(){
  vec3 a = texture(acc, uv).rgb;
  vec3 bg = to_lin(vec3(0.035, 0.04, 0.058));
  // light adds up, then saturates as film does
  vec3 c = bg + (1.0 - exp(-a * 2.2)) * 1.05;
  o = vec4(to_srgb(c), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const gl = context(canvas);
  fit_canvas(canvas, 1.5);
  const asp = canvas.width / canvas.height;
  const init = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { init[i * 4] = (Math.random() * 2 - 1) * asp; init[i * 4 + 1] = Math.random() * 2 - 1; }
  const st = pingpong(gl, TS, TS, { type: 'f32', filter: 'nearest' });
  for (const t of [st.read, st.write]) { gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TS, TS, 0, gl.RGBA, gl.FLOAT, init); }
  let acc = target(gl, canvas.width, canvas.height, { type: 'f16' });
  const P = { step: program(gl, STEP), dot: program(gl, DOT_FS, DOT_VS), show: program(gl, SHOW) };
  const U = { shape: 1, goal: 1, heat: [0, 0, 0], seed: 0, anneal: 0, last: performance.now() };
  // annealed Langevin (as diffusion models sample): after a change of shape the band starts wide and cools back to s,
  // so grains can travel between parts before they condense; the step keeps eps/s² fixed
  function step() {
    U.seed = (U.seed + 1) % 4096;
    const s_eff = S * (1 + 24 * U.anneal * U.anneal), eps = 4e-6 * (s_eff / S) ** 2;
    pass(gl, P.step, { st: st.read, eps, s: s_eff, seed: U.seed, heat: U.heat, shape: U.shape, asp }, st.write); st.swap();
  }
  function draw() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, acc.fb); gl.viewport(0, 0, acc.w, acc.h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    use(gl, P.dot, { st: st.read, asp, shape: U.shape, px_world: 2 / canvas.height }); gl.bindVertexArray(gl.vao_empty); gl.drawArrays(gl.LINES, 0, N * 2);
    gl.disable(gl.BLEND);
    pass(gl, P.show, { acc });
  }
  const sched = scheduler((dt) => {
    U.shape += (U.goal - U.shape) * Math.min(1, dt * 3);
    U.anneal = Math.max(0, U.anneal - dt / 2.6);
    U.heat[2] *= Math.pow(0.05, dt);
    for (let i = 0; i < 6; i++) step();
    draw();
    return performance.now() - U.last < 5000 || Math.abs(U.goal - U.shape) > 0.002;
  });
  pointer(canvas, (kind, p) => {
    const x = (p.x * 2 - 1) * asp, y = p.y * 2 - 1;
    if (kind === 'down') { U.down_at = [x, y]; U.moved = false; }
    if (kind === 'move' && p.down) { U.heat = [x, y, 60]; U.moved = true; }
    if (kind === 'up' && !U.moved) { U.goal = U.goal > 0.5 ? 0 : 1; U.anneal = 1; }
    U.last = performance.now(); sched.wake();
  });
  for (let i = 0; i < 900; i++) step();
  draw();
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { fit_canvas(canvas, 1.5); acc = target(gl, canvas.width, canvas.height, { type: 'f16' }); draw(); },
    demo() { U.goal = U.goal > 0.5 ? 0 : 1; U.anneal = 1; U.last = performance.now(); sched.wake(); },
    async accept() {
      U.goal = 1; U.heat = [0, 0, 0];
      // the full gesture: anneal into the scene, then let it settle
      for (let i = 0; i < 1600; i++) { U.shape += (1 - U.shape) * 0.05; U.anneal = Math.max(0, 1 - i / 900); step(); }
      draw();
      const s = read_float(gl, st.read); let inside = 0;
      for (let i = 0; i < N; i++) if (scene_cpu(s[i * 4], s[i * 4 + 1]) < 2 * S) inside++;
      const f = inside / N;
      hud.innerHTML = `${lang === 'zh' ? '在 2s 带内' : 'within 2s'} <b>${(f * 100).toFixed(1)}%</b>`;
      return { pass: Math.abs(f - 0.954) < 0.03, value: (f * 100).toFixed(2) + '%' };
    },
  };
}
// the same scene distance on the CPU
function scene_cpu(x, y) {
  const box = (cx, cy, bx, by) => { const dx = Math.abs(x - cx) - bx, dy = Math.abs(y - cy) - by; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); };
  const circ = (cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
  const cart = Math.min(Math.abs(box(-0.82, -0.36, 0.36, 0.2)), Math.abs(circ(-1.04, -0.62, 0.085)), Math.abs(circ(-0.6, -0.62, 0.085)));
  return Math.min(cart, Math.abs(circ(0.22, -0.5, 0.2)), Math.abs(box(0.95, -0.12, 0.07, 0.6)), Math.abs(y + 0.715) + Math.max(Math.abs(x) - 1.35, 0));
}
