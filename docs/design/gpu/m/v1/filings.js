// 5 · Iron filings. A magnet hides under the paper; each filing turns to lie along the field where it is, so
// together they draw the field's lines. Each filing is a tangent: θ follows atan2(B), with torque and damping,
// and filings slowly gather where the field is strong.
import { context, program, pass, pingpong, scheduler, pointer, fit_canvas, read_float, use, clamp } from '../../lib/gl.js';

export const meta = {
  id: 'filings',
  name: { zh: '铁屑', en: 'Iron filings' },
  means: { zh: '每一粒铁屑都顺着它所在处的方向躺下：一张向量场。', en: 'Every filing lies along the direction where it is: a vector field.' },
  test: { zh: '静下来后铁屑与场方向的平均夹角，小于 3°', en: 'Mean angle between filings and the field once settled, below 3°' },
};

const TW = 160, TH = 110, NF = TW * TH, DW = 384, DH = 240;
const FIELD = `
uniform vec4 mag; // x, y, angle, half-length of the bar magnet
vec2 field(vec2 p){
  vec2 ax = vec2(cos(mag.z), sin(mag.z)) * mag.w, n = mag.xy + ax, s = mag.xy - ax;
  vec2 a = p - n, b = p - s;
  // a 2D magnet: a source at its north pole and a sink at its south pole
  return a / (dot(a, a) + 0.0016) - b / (dot(b, b) + 0.0016);
}`;
const STEP = `in vec2 uv; out vec4 o; uniform sampler2D st; uniform sampler2D dens; uniform float dt; uniform float asp; uniform float shake;` + FIELD + `
void main(){
  vec4 s = texelFetch(st, ivec2(gl_FragCoord.xy), 0);
  vec2 B = field(s.xy); float th = atan(B.y, B.x);
  // a filing is a needle without a head: it aligns modulo π (torque ∝ sin 2Δ)
  float d = th - s.z, torque = sin(2.0 * d) * min(length(B), 40.0) * 0.5;
  s.w += (torque * 30.0 - s.w * 9.0) * dt;
  s.w += shake * (hash12(gl_FragCoord.xy + fract(dt * 977.0) * 113.0) - 0.5) * 30.0;
  s.z += s.w * dt;
  // filings creep up the gradient of |B|² (they are pulled into strong field), a little each tap
  vec2 e = vec2(0.004, 0), g = vec2(dot(field(s.xy + e.xy), field(s.xy + e.xy)) - dot(field(s.xy - e.xy), field(s.xy - e.xy)), dot(field(s.xy + e.yx), field(s.xy + e.yx)) - dot(field(s.xy - e.yx), field(s.xy - e.yx))) / 0.008;
  s.xy += shake * 0.000006 * g / (1.0 + length(g) * 0.000006 * 200.0);
  // tapping the paper: filings magnetise each other and gather sideways into chains along the field
  vec2 tq = (s.xy / vec2(asp, 1.0)) * 0.5 + 0.5, de = 1.5 / vec2(textureSize(dens, 0));
  vec2 gr = vec2(texture(dens, tq + vec2(de.x, 0)).r - texture(dens, tq - vec2(de.x, 0)).r, texture(dens, tq + vec2(0, de.y)).r - texture(dens, tq - vec2(0, de.y)).r);
  vec2 nb = normalize(vec2(-B.y, B.x) + 1e-6);
  s.xy += shake * nb * dot(nb, gr) * 0.0009 / (1.0 + abs(dot(nb, gr)) * 0.4);
  // but iron takes up room: where filings already crowd, they are pushed apart (piles form at the poles)
  float rho = texture(dens, tq).r;
  s.xy -= shake * gr * 0.002 * smoothstep(0.35, 1.2, rho) / (1.0 + length(gr) * 0.3);
  s.x = clamp(s.x, -asp, asp); s.y = clamp(s.y, -1.0, 1.0);
  o = s;
}`;
const VS = `
uniform sampler2D st; uniform float asp; uniform float len; uniform float wid; uniform vec2 shadow; uniform int tw;
out vec2 q; out float glint; out float seed;
void main(){
  int id = gl_VertexID / 6, k = gl_VertexID % 6;
  vec4 s = texelFetch(st, ivec2(id % tw, id / tw), 0);
  seed = hash12(vec2(float(id), 7.0));
  float L = len * (0.55 + 0.9 * seed);
  vec2 corner = vec2[6](vec2(-1, -1), vec2(1, -1), vec2(1, 1), vec2(-1, -1), vec2(1, 1), vec2(-1, 1))[k];
  vec2 t = vec2(cos(s.z), sin(s.z)), n = vec2(-t.y, t.x);
  vec2 p = s.xy + t * corner.x * L + n * corner.y * wid * 1.8 + shadow;
  q = vec2(corner.x * (L + wid) / L, corner.y * 1.8);
  // a filing is a tiny elongated crystal: it glints when its long axis is across the light
  glint = pow(abs(sin(s.z - 0.6)), 24.0);
  gl_Position = vec4(p.x / asp, p.y, 0, 1);
}`;
const FS = `in vec2 q; in float glint; in float seed; out vec4 o; uniform float is_shadow;
void main(){
  float d = length(vec2(max(abs(q.x) - 1.0, 0.0) * 4.0, q.y));
  float a = smoothstep(1.0, 0.45, d);
  vec3 c = mix(vec3(0.16, 0.165, 0.18), vec3(0.42, 0.43, 0.45), seed * 0.6);
  c += vec3(0.55) * glint * smoothstep(0.6, 0.0, abs(q.y));
  if (is_shadow > 0.5){ o = vec4(0.0, 0.0, 0.0, a * 0.16); return; }
  o = vec4(to_srgb(to_lin(c)) * a, a);
}`;
const DOT_VS = `uniform sampler2D st; uniform float asp; uniform int tw;
void main(){ vec4 s = texelFetch(st, ivec2(gl_VertexID % tw, gl_VertexID / tw), 0); gl_Position = vec4(s.x / asp, s.y, 0, 1); gl_PointSize = 1.0; }`;
const DOT_FS = `out vec4 o; void main(){ o = vec4(1.0, 0, 0, 1); }`;
const BLUR = `in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 dir;
void main(){ vec4 s = vec4(0); float w[5] = float[5](0.227, 0.194, 0.121, 0.054, 0.016);
  s += texture(src, uv) * w[0]; for (int i = 1; i < 5; i++){ s += (texture(src, uv + dir * float(i)) + texture(src, uv - dir * float(i))) * w[i]; } o = s; }`;
const PAPER_FS = `in vec2 uv; out vec4 o; uniform float asp;` + FIELD + `
void main(){
  vec2 p = (uv * 2.0 - 1.0) * vec2(asp, 1.0);
  vec3 c = to_lin(PAPER);
  // the magnet under the paper shows through as a soft shade
  vec2 ax = vec2(cos(mag.z), sin(mag.z)), r = p - mag.xy;
  vec2 lr = vec2(dot(r, ax), dot(r, vec2(-ax.y, ax.x)));
  float box = length(max(abs(lr) - vec2(mag.w + 0.05, 0.075), 0.0));
  c *= 1.0 - 0.045 * smoothstep(0.035, 0.0, box);
  c *= 0.985 + 0.015 * vnoise(uv * vec2(700.0 * asp, 700.0));
  o = vec4(to_srgb(c), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const gl = context(canvas, { antialias: true });
  fit_canvas(canvas, 2);
  const asp = canvas.width / canvas.height;
  const init = new Float32Array(NF * 4);
  for (let i = 0; i < NF; i++) { init[i * 4] = (Math.random() * 2 - 1) * asp; init[i * 4 + 1] = Math.random() * 2 - 1; init[i * 4 + 2] = Math.random() * Math.PI; init[i * 4 + 3] = 0; }
  const st = pingpong(gl, TW, TH, { type: 'f32', filter: 'nearest' });
  for (const t of [st.read, st.write]) { gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TW, TH, 0, gl.RGBA, gl.FLOAT, init); }
  const P = { step: program(gl, STEP), draw: program(gl, FS, VS), paper: program(gl, PAPER_FS), dot: program(gl, DOT_FS, DOT_VS), blur: program(gl, BLUR) };
  const dens = pingpong(gl, DW, DH, { type: 'f16' });
  const M = { x: 0.15, y: -0.05, a: 0.25, w: 0.34 }, goal = { ...M };
  let shake = 0, last_input = performance.now();
  const mag = () => [M.x, M.y, M.a, M.w];
  function density() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dens.read.fb); gl.viewport(0, 0, DW, DH); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); use(gl, P.dot, { st: st.read, asp, tw: TW }); gl.bindVertexArray(gl.vao_empty); gl.drawArrays(gl.POINTS, 0, NF); gl.disable(gl.BLEND);
    pass(gl, P.blur, { src: dens.read, dir: [1 / DW, 0] }, dens.write); dens.swap();
    pass(gl, P.blur, { src: dens.read, dir: [0, 1 / DH] }, dens.write); dens.swap();
  }
  let n_step = 0;
  function step(dt) { if (shake > 0 && n_step++ % 3 === 0) density(); pass(gl, P.step, { st: st.read, dens: dens.read, dt, asp, shake, mag: mag() }, st.write); st.swap(); }
  function draw() {
    pass(gl, P.paper, { asp, mag: mag() });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const px = 2 / canvas.height;
    for (const sh of [1, 0]) {
      use(gl, P.draw, { st: st.read, asp, len: 2.6 * px * (canvas.height / 800 * 1.6 + 0.6), wid: 0.62 * px * 1.6, shadow: sh ? [0.9 * px, -1.3 * px] : [0, 0], tw: TW, is_shadow: sh });
      gl.bindVertexArray(gl.vao_empty); gl.drawArrays(gl.TRIANGLES, 0, NF * 6);
    }
    gl.disable(gl.BLEND);
  }
  const sched = scheduler((dt) => {
    let moving = false;
    for (const k of ['x', 'y', 'a']) { const v = goal[k] - M[k]; M[k] += v * Math.min(1, dt * 10); if (Math.abs(v) > 1e-4) moving = true; }
    for (let i = 0; i < 3; i++) step(1 / 180);
    shake *= Math.pow(0.02, dt); if (shake < 0.01) shake = 0;
    draw();
    return moving || performance.now() - last_input < 3000 || shake > 0;
  });
  let grab = null;
  pointer(canvas, (kind, p) => {
    const x = (p.x * 2 - 1) * asp, y = p.y * 2 - 1;
    if (kind === 'down') { grab = [x - goal.x, y - goal.y]; shake = 1; }
    if (kind === 'move' && p.down && grab) { goal.x = clamp(x - grab[0], -asp + 0.3, asp - 0.3); goal.y = clamp(y - grab[1], -0.75, 0.75); shake = Math.max(shake, 0.25); }
    if (kind === 'up') grab = null;
    last_input = performance.now(); sched.wake();
  });
  canvas.addEventListener('dblclick', () => { goal.a += Math.PI / 2; shake = 1; last_input = performance.now(); sched.wake(); });
  // sprinkle, then tap the paper a few times so the filings fall into place
  for (let i = 0; i < 700; i++) { shake = i < 600 ? 0.6 : 0; step(1 / 180); }
  draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 2); draw(); },
    demo() { goal.a = 0.25 + 0.5; shake = 1; last_input = performance.now(); sched.wake(); },
    async accept() {
      for (let i = 0; i < 600; i++) step(1 / 180);
      const s = read_float(gl, st.read); let err = 0, n = 0;
      for (let i = 0; i < NF; i++) {
        const x = s[i * 4], y = s[i * 4 + 1], th = s[i * 4 + 2];
        const ax = [Math.cos(M.a) * M.w, Math.sin(M.a) * M.w], a = [x - M.x - ax[0], y - M.y - ax[1]], b = [x - M.x + ax[0], y - M.y + ax[1]];
        const da = a[0] * a[0] + a[1] * a[1] + 0.0016, db = b[0] * b[0] + b[1] * b[1] + 0.0016;
        const B = [a[0] / da - b[0] / db, a[1] / da - b[1] / db]; if (Math.hypot(...B) < 0.05) continue;
        let d = Math.atan2(B[1], B[0]) - th; d = ((d % Math.PI) + Math.PI) % Math.PI; d = Math.min(d, Math.PI - d);
        err += d; n++;
      }
      draw();
      const deg = err / n * 180 / Math.PI;
      hud.innerHTML = `${lang === 'zh' ? '与场方向平均差' : 'mean misalignment'} <b>${deg.toFixed(2)}°</b>`;
      return { pass: deg < 3, value: deg.toFixed(2) + '°' };
    },
  };
}
