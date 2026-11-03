// M1 · A vector field as light. Two thousand grains of light flow along the field (RK4 on the GPU) and leave trails that
// fade, so the picture is the field's integral curves themselves; faster flow is whiter (a long exposure). The field is made of
// singularities you can move: sources pour light out, sinks swallow it, vortices turn it.
// As a library primitive: flow(field) for any 2D vector field given in GLSL.
import { context, program, pass, pingpong, scheduler, fit_canvas, read_float, use } from '../../lib/gl.js';

export const meta = {
  id: 'field',
  name: { zh: '向量场 · 流动的光', en: 'Vector field as light' },
  means: { zh: '光顺着向量场流：留下的轨迹就是积分曲线，越快越白；源头往外涌，汇点把光吞掉，涡旋让它打转。', en: 'Light flows along the field: its trails are the integral curves, whiter where faster; sources pour, sinks swallow, vortices turn.' },
  test: { zh: '纯涡旋里转一整圈，半径漂移 < 0.5%（积分曲线是圆）', en: 'One full turn in a pure vortex drifts < 0.5 % in radius (the integral curves are circles)' },
  night: true,
};

const TS = 48, N = TS * TS, MAXS = 6;
const FIELD = `
uniform vec4 sing[${MAXS}]; uniform int ns; uniform float asp;
// each singularity: (x, y, strength of source(+)/sink(−), strength of vortex)
vec2 F(vec2 p){
  vec2 v = vec2(0.0);
  for (int i = 0; i < ${MAXS}; i++){ if (i >= ns) break;
    vec2 d = p - sing[i].xy; float r2 = dot(d, d) + 0.0025;
    v += sing[i].z * d / r2 + sing[i].w * vec2(-d.y, d.x) / r2; }
  return v;
}`;
// state: (x, y, previous x, previous y). A grain's age is a phase of the clock (its seed is its index), so it needs
// no storage: it is reborn when its phase wraps.
const STEP = `in vec2 uv; out vec4 o; uniform sampler2D st; uniform float dt; uniform float t; uniform float life;` + FIELD + `
vec2 rk4(vec2 p, float h){ vec2 k1 = F(p), k2 = F(p + 0.5 * h * k1), k3 = F(p + 0.5 * h * k2), k4 = F(p + h * k3); return p + h / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4); }
float phase(float tt){ float s = hash12(gl_FragCoord.xy * 0.37 + 3.7); return (tt / life + s); }
void main(){
  vec4 s = texelFetch(st, ivec2(gl_FragCoord.xy), 0);
  vec2 p = s.xy;
  // substeps where the flow is fast, so every grain advances a full dt and the integral stays accurate
  float sp = length(F(p)); int n = int(clamp(ceil(sp * dt / 0.004), 1.0, 16.0));
  vec2 q = p; for (int i = 0; i < 16; i++){ if (i >= n) break; q = rk4(q, dt / float(n)); }
  bool dead = floor(phase(t)) != floor(phase(t - dt)) || abs(q.x) > asp * 1.05 || abs(q.y) > 1.05;
  for (int i = 0; i < ${MAXS}; i++){ if (i >= ns) break; if (sing[i].z < 0.0 && length(q - sing[i].xy) < 0.03) dead = true; }
  if (dead){
    vec2 r = hash22(gl_FragCoord.xy * 0.613 + floor(phase(t)) * 17.3 + t);
    q = (r * 2.0 - 1.0) * vec2(asp, 1.0);
    // sources breathe light out: some new grains are born right at a source
    for (int i = 0; i < ${MAXS}; i++){ if (i >= ns) break; if (sing[i].z > 0.0 && hash12(gl_FragCoord.xy + t * 3.1 + float(i)) < 0.12){ float a = r.y * 6.2831853; q = sing[i].xy + vec2(cos(a), sin(a)) * 0.035; } }
    p = q;
  }
  o = vec4(q, p);
}`;
// each grain draws the segment it travelled this frame, weighted by its speed and faded in and out over its life
const LINE_VS = `uniform sampler2D st; uniform float t; uniform float life; uniform float ppu;` + FIELD + `
out float bright; out float spd;
void main(){
  int id = gl_VertexID / 2; ivec2 c = ivec2(id % ${TS}, id / ${TS}); vec4 s = texelFetch(st, c, 0);
  float ph = fract(t / life + hash12(vec2(c) * 0.37 + 3.7));
  bright = smoothstep(0.0, 0.15, ph) * smoothstep(1.0, 0.75, ph);
  spd = length(F(s.xy));
  // a long exposure: the light of one frame is spread along the streak, so a fast grain is fainter per pixel
  float len = length(s.xy - s.zw) * ppu; bright *= 1.0 / max(1.0, len);
  vec2 p = gl_VertexID % 2 == 0 ? s.xy : s.zw;
  gl_Position = vec4(p.x / asp, p.y, 0, 1);
}`;
const LINE_FS = `in float bright; in float spd; out vec4 o;
// speed shows as colour temperature: slow flow is cobalt, fast flow is white
void main(){ float k = clamp(spd / 4.0, 0.0, 1.0); vec3 c = mix(COBALT * 1.2, vec3(0.92, 0.95, 1.0), sqrt(k)); o = vec4(c * bright * 3.2, 1.0); }`;
const FADE = `in vec2 uv; out vec4 o; uniform sampler2D src; uniform float k; void main(){ o = texture(src, uv) * k; }`;
const SHOW = `in vec2 uv; out vec4 o; uniform sampler2D acc; uniform vec2 res;` + FIELD + `
void main(){
  vec3 a = texture(acc, uv).rgb;
  vec3 bg = to_lin(vec3(0.03, 0.034, 0.05));
  vec3 c = bg + (1.0 - exp(-a * 1.6)) * 1.05;
  vec2 p = (uv * 2.0 - 1.0) * vec2(asp, 1.0); float px = 2.0 / res.y;
  // the singularities, as small glass rings: filled for a source, hollow for a sink, open arcs for a vortex
  for (int i = 0; i < ${MAXS}; i++){ if (i >= ns) break;
    float r = length(p - sing[i].xy), R = 0.03;
    float ring = smoothstep(px * 1.2, 0.0, abs(r - R) - px * 0.6);
    if (abs(sing[i].w) > abs(sing[i].z)){ float ang = atan(p.y - sing[i].y, p.x - sing[i].x); ring *= step(0.0, sin(ang * 3.0 + sign(sing[i].w) * 0.0)); }
    float fill = sing[i].z > 0.0 ? smoothstep(R * 0.55 + px, R * 0.55, r) : 0.0;
    c = mix(c, vec3(1.0), clamp(ring * 0.9 + fill, 0.0, 1.0));
  }
  o = vec4(to_srgb(c), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh';
  const gl = context(canvas);
  fit_canvas(canvas, 1.5);
  let asp = canvas.width / canvas.height;
  const init = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { init[i * 4] = init[i * 4 + 2] = (Math.random() * 2 - 1) * asp; init[i * 4 + 1] = init[i * 4 + 3] = Math.random() * 2 - 1; }
  const st = pingpong(gl, TS, TS, { type: 'f32', filter: 'nearest' });
  for (const t of [st.read, st.write]) { gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TS, TS, 0, gl.RGBA, gl.FLOAT, init); }
  let acc = pingpong(gl, canvas.width, canvas.height, { type: 'f16' });
  const P = { step: program(gl, STEP), line: program(gl, LINE_FS, LINE_VS), fade: program(gl, FADE), show: program(gl, SHOW) };
  // the field: a source, a sink and a vortex, all movable
  const S = [[-0.75 * asp, 0.15, 1.0, 0.25], [0.7 * asp, -0.2, -1.0, -0.2], [0.05, 0.55, 0.0, 1.2]];
  let T = 0, last = performance.now();
  const sing = () => { const a = new Float32Array(MAXS * 4); S.forEach((s, i) => a.set(s, i * 4)); return a; };
  const U = () => ({ sing: sing(), ns: S.length, asp });
  function step(dt) { T += dt; pass(gl, P.step, { st: st.read, dt, t: T, life: 3.2, ...U() }, st.write); st.swap(); }
  function frame(dt) {
    step(dt);
    pass(gl, P.fade, { src: acc.read, k: 0.978 }, acc.write);
    gl.bindFramebuffer(gl.FRAMEBUFFER, acc.write.fb); gl.viewport(0, 0, acc.w, acc.h);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    use(gl, P.line, { st: st.read, t: T, life: 3.2, ppu: canvas.height / 2, ...U() }); gl.bindVertexArray(gl.vao_empty); gl.drawArrays(gl.LINES, 0, N * 2);
    gl.disable(gl.BLEND); acc.swap();
    pass(gl, P.show, { acc: acc.read, res: [canvas.width, canvas.height], ...U() });
  }
  const sched = scheduler((dt) => { frame(1 / 60); return performance.now() - last < 9000; });
  let drag = -1;
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width * 2 - 1) * asp, 1 - (e.clientY - r.top) / r.height * 2]; };
  canvas.addEventListener('pointerdown', (e) => { const [x, y] = at(e); drag = -1; let best = 0.12; S.forEach((s, i) => { const d = Math.hypot(s[0] - x, s[1] - y); if (d < best) { best = d; drag = i; } }); canvas.setPointerCapture(e.pointerId); last = performance.now(); sched.wake(); });
  canvas.addEventListener('pointermove', (e) => { if (drag < 0) return; const [x, y] = at(e); S[drag][0] = x; S[drag][1] = y; last = performance.now(); sched.wake(); });
  canvas.addEventListener('pointerup', () => { drag = -1; });
  // a double tap turns a source into a sink into a vortex: the three kinds of singular point
  canvas.addEventListener('dblclick', (e) => { const [x, y] = at(e); S.forEach((s) => { if (Math.hypot(s[0] - x, s[1] - y) < 0.12) { const k = s[2] > 0 ? [-1, -0.2] : s[2] < 0 ? [0, 1.2] : [1, 0.25]; s[2] = k[0]; s[3] = k[1]; } }); last = performance.now(); sched.wake(); });
  for (let i = 0; i < 90; i++) frame(1 / 60);
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { fit_canvas(canvas, 1.5); asp = canvas.width / canvas.height; acc = pingpong(gl, canvas.width, canvas.height, { type: 'f16' }); },
    demo() { last = performance.now(); sched.wake(); },
    async accept() {
      // a pure vortex at the origin; grains placed on a circle; after one turn their radius must be unchanged
      const saved = S.map((s) => s.slice()); S.length = 0; S.push([0, 0, 0, 1]);
      const M = 256, test = pingpong(gl, M, 1, { type: 'f32', filter: 'nearest' }), d = new Float32Array(M * 4), R = 0.4 * Math.min(asp, 1);
      for (let i = 0; i < M; i++) { const a = i / M * 6.2831853; d[i * 4] = d[i * 4 + 2] = R * Math.cos(a); d[i * 4 + 1] = d[i * 4 + 3] = R * Math.sin(a); }
      for (const t of [test.read, test.write]) { gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, M, 1, 0, gl.RGBA, gl.FLOAT, d); }
      // speed on the circle is R/(R²+ε); one turn takes 2πR/speed
      const sp = R / (R * R + 0.0025), turn = 2 * Math.PI * R / sp, n = Math.ceil(turn / (1 / 60));
      for (let i = 0; i < n; i++) { pass(gl, P.step, { st: test.read, dt: turn / n, t: 1 + i * turn / n, life: 1e9, ...U() }, test.write); test.swap(); }
      const out = read_float(gl, test.read); let worst = 0;
      let ang = 0; for (let i = 0; i < M; i++) worst = Math.max(worst, Math.abs(Math.hypot(out[i * 4], out[i * 4 + 1]) / R - 1)); ang = Math.atan2(out[1], out[0]);
      S.length = 0; saved.forEach((s) => S.push(s));
      return { pass: worst < 0.005 && Math.abs(ang) < 0.01, value: `${zh ? '一整圈后半径漂移' : 'radius drift after a full turn'} ${(worst * 100).toFixed(3)}%, ${zh ? '回到起点角度差' : 'angle back at start'} ${ang.toFixed(4)} rad` };
    },
  };
}
