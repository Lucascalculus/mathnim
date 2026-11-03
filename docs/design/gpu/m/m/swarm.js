// M7 · Optimisation as a swarm. Thousands of small steel balls do heavy-ball descent on a landscape seen from above
// (v ← βv − η∇f, x ← x + v), each leaving a faint ink path. With little momentum each ball stays in the basin it
// started in; with more, balls overshoot shallow wells and settle in deeper ones. Tap to pour a new handful; slide
// the bead to set the momentum β.
// As a library primitive: descend(f, starts, β) on any landscape given in GLSL.
import { context, program, pass, pingpong, target, scheduler, fit_canvas, read_float, use, clamp } from '../../lib/gl.js';
import { SANS } from '../../lib/ui.js';

export const meta = {
  id: 'swarm',
  name: { zh: '优化 · 一群小球', en: 'Optimisation as a swarm' },
  means: { zh: '每个小球沿着下坡走，带着惯性；惯性小，它留在出发的那个谷；惯性大，它会冲出浅谷，找到更深的。', en: 'Each ball goes downhill with momentum; with little, it stays in the valley it started in; with more, it overshoots shallow valleys and finds deeper ones.' },
  test: { zh: '全部小球停在局部极小（|∇f| < 10⁻³ 且 Hessian 正定）；β = 0 时每个都停在出发点所在的盆地', en: 'Every ball stops at a local minimum (|∇f| < 10⁻³, Hessian positive definite); with β = 0 each stops in the basin it started in' },
  wide: true,
};

const TS = 32, N = TS * TS;
const F = `
uniform float asp;
// a landscape of wells of different depth on a gentle bowl
float f(vec2 p){
  float v = 0.12 * dot(p, p);
  v -= 0.55 * exp(-dot(p - vec2(-0.75, 0.25), p - vec2(-0.75, 0.25)) / 0.09);
  v -= 0.85 * exp(-dot(p - vec2(0.62, -0.3), p - vec2(0.62, -0.3)) / 0.14);
  v -= 0.35 * exp(-dot(p - vec2(0.1, 0.55), p - vec2(0.1, 0.55)) / 0.05);
  v -= 0.3 * exp(-dot(p - vec2(-0.2, -0.45), p - vec2(-0.2, -0.45)) / 0.04);
  v += 0.06 * sin(p.x * 7.0) * sin(p.y * 6.0);
  return v;
}
vec2 gradf(vec2 p){ vec2 e = vec2(0.0005, 0); return vec2(f(p + e.xy) - f(p - e.xy), f(p + e.yx) - f(p - e.yx)) / 0.001; }`;
const STEP = `in vec2 uv; out vec4 o; uniform sampler2D st; uniform float beta; uniform float eta;` + F + `
void main(){ vec4 s = texelFetch(st, ivec2(gl_FragCoord.xy), 0); vec2 v = beta * s.zw - eta * gradf(s.xy); o = vec4(s.xy + v, v); }`;
// ink paths: each ball draws the segment it moved
const PATH_VS = `uniform sampler2D st; uniform sampler2D prev;` + F + `
void main(){ int id = gl_VertexID / 2; ivec2 c = ivec2(id % ${TS}, id / ${TS}); vec2 p = gl_VertexID % 2 == 0 ? texelFetch(st, c, 0).xy : texelFetch(prev, c, 0).xy; gl_Position = vec4(p.x / asp, p.y, 0, 1); }`;
const PATH_FS = `out vec4 o; void main(){ o = vec4(0.11, 0, 0, 0.11); }`;
const BALL_VS = `uniform sampler2D st; uniform float px;` + F + `
out vec2 c0; void main(){ ivec2 c = ivec2(gl_VertexID % ${TS}, gl_VertexID / ${TS}); vec2 p = texelFetch(st, c, 0).xy; gl_Position = vec4(p.x / asp, p.y, 0, 1); gl_PointSize = px; }`;
const BALL_FS = `out vec4 o; uniform float shadow;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y; float r2 = dot(q, q);
  if (shadow > 0.5){ float a = smoothstep(1.0, 0.2, r2); o = vec4(0, 0, 0, a * 0.22); return; }
  if (r2 > 1.0) discard;
  vec3 n = vec3(q, sqrt(1.0 - r2));
  vec3 L = normalize(vec3(-0.5, 0.6, 0.65));
  // polished steel: the studio reflected, one sharp highlight
  vec3 r = reflect(vec3(0, 0, -1), n);
  vec3 env = mix(vec3(0.25, 0.26, 0.28), vec3(0.95), smoothstep(-0.3, 0.8, r.y)) * (0.75 + 0.25 * r.z);
  vec3 c = env * 0.85 + vec3(1.0) * pow(max(dot(r, L), 0.0), 60.0);
  float edge = smoothstep(1.0, 0.85, r2);
  o = vec4(to_srgb(c) * edge, edge);
}`;
const SHOW = `in vec2 uv; out vec4 o; uniform sampler2D ink; uniform vec2 res;` + F + `
void main(){
  vec2 p = (uv * 2.0 - 1.0) * vec2(asp, 1.0);
  // the landscape from above: plaster lit from the upper left, contours engraved
  float e = 2.0 / res.y; vec2 g = gradf(p);
  vec3 n = normalize(vec3(-g * 1.1, 1.0)), L = normalize(vec3(-0.5, 0.6, 0.65));
  // deeper is darker: a valley holds less of the sky
  float depth = smoothstep(0.35, -0.7, f(p));
  vec3 c = to_lin(PAPER) * (0.62 + 0.38 * dot(n, L)) * (1.0 - 0.22 * depth);
  float k = f(p) / 0.06, w = abs(fract(k + 0.5) - 0.5) / fwidth(k);
  c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 1.2, w));
  // the paths walked, in ink
  float a = texture(ink, uv).r;
  c = mix(c, to_lin(INK), clamp(a, 0.0, 0.55));
  o = vec4(to_srgb(c), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', gl = context(canvas);
  fit_canvas(canvas, 2);
  let asp = canvas.width / canvas.height;
  const st = pingpong(gl, TS, TS, { type: 'f32', filter: 'nearest' }), prev = target(gl, TS, TS, { type: 'f32', filter: 'nearest' });
  let ink = target(gl, canvas.width, canvas.height, { type: 'f16' });
  const P = { step: program(gl, STEP), path: program(gl, PATH_FS, PATH_VS), ball: program(gl, BALL_FS, BALL_VS), show: program(gl, SHOW), copy: program(gl, `in vec2 uv; out vec4 o; uniform sampler2D s; void main(){ o = texelFetch(s, ivec2(gl_FragCoord.xy), 0); }`) };
  const S = { beta: 0.82, last: performance.now(), steps: 0 };
  const ui = document.createElement('div');
  ui.style.cssText = 'position:absolute;left:20px;bottom:52px;width:200px;height:30px;pointer-events:none';
  ui.innerHTML = `<div style="position:absolute;left:0;right:0;top:15px;height:1px;background:rgba(26,27,31,.25)"></div>${[0, 0.5, 0.95].map((b) => `<i style="position:absolute;top:10px;left:${b / 0.95 * 200}px;width:1px;height:10px;background:rgba(26,27,31,.4)"></i>`).join('')}<div class="b" style="position:absolute;top:2px;width:26px;height:26px;margin-left:-13px;border-radius:50%;background:radial-gradient(circle at 38% 30%,#fff,rgba(255,255,255,.75) 45%,#ebe8e2);box-shadow:0 0 0 .75px rgba(26,27,31,.18),0 5px 12px rgba(26,27,31,.16)"></div>`;
  stage.append(ui); const bead = ui.querySelector('.b');
  function pour(cx, cy, spread) {
    const d = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, r = spread * Math.sqrt(Math.random()); d[i * 4] = clamp(cx + Math.cos(a) * r * asp, -asp * 0.98, asp * 0.98); d[i * 4 + 1] = clamp(cy + Math.sin(a) * r, -0.98, 0.98); }
    for (const t of [st.read, st.write]) { gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TS, TS, 0, gl.RGBA, gl.FLOAT, d); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, ink.fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    S.steps = 0; S.last = performance.now(); sched.wake();
  }
  const U = () => ({ asp });
  function step() {
    pass(gl, P.copy, { s: st.read }, prev);
    pass(gl, P.step, { st: st.read, beta: S.beta, eta: 0.0016, ...U() }, st.write); st.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, ink.fb); gl.viewport(0, 0, ink.w, ink.h);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); use(gl, P.path, { st: st.read, prev, ...U() }); gl.bindVertexArray(gl.vao_empty); gl.drawArrays(gl.LINES, 0, N * 2); gl.disable(gl.BLEND);
    S.steps++;
  }
  function draw() {
    pass(gl, P.show, { ink, res: [canvas.width, canvas.height], ...U() });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const px = Math.max(7, canvas.height / 62);
    for (const sh of [1, 0]) { use(gl, P.ball, { st: st.read, px: px * (sh ? 1.5 : 1), shadow: sh, ...U() }); gl.bindVertexArray(gl.vao_empty); gl.drawArrays(gl.POINTS, 0, N); }
    gl.disable(gl.BLEND);
    hud.innerHTML = `β = <b>${S.beta.toFixed(2)}</b> · ${zh ? '动量' : 'momentum'}`; bead.style.left = (S.beta / 0.95 * 200) + 'px';
  }
  const sched = scheduler(() => { for (let i = 0; i < 3; i++) step(); draw(); return S.steps < 2400 && performance.now() - S.last < 20000; });
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width * 2 - 1) * asp, 1 - (e.clientY - r.top) / r.height * 2, e.clientX - r.left, e.clientY - r.top, r.width, r.height]; };
  let drag = false;
  canvas.addEventListener('pointerdown', (e) => { const [x, y, cx, cy, w, h] = at(e); if (cy > h - 96 && cy < h - 40 && cx < 250) { drag = true; canvas.setPointerCapture(e.pointerId); S.beta = clamp((cx - 20) / 200 * 0.95, 0, 0.95); draw(); } else pour(x, y, 0.35); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const [, , cx] = at(e); S.beta = clamp((cx - 20) / 200 * 0.95, 0, 0.95); draw(); });
  canvas.addEventListener('pointerup', () => { if (drag) { drag = false; pour(0, 0, 1.2); } });
  pour(0, 0, 1.2); for (let i = 0; i < 60; i++) step(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 2); asp = canvas.width / canvas.height; ink = target(gl, canvas.width, canvas.height, { type: 'f16' }); pour(0, 0, 1.2); },
    demo() { pour(0, 0, 1.2); },
    set_beta(b) { S.beta = b; pour(0, 0, 1.2); },
    async accept() {
      // run to rest at two momenta and check every ball
      const fj = (x, y) => { const g = (cx, cy, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s); return 0.12 * (x * x + y * y) - 0.55 * g(-0.75, 0.25, 0.09) - 0.85 * g(0.62, -0.3, 0.14) - 0.35 * g(0.1, 0.55, 0.05) - 0.3 * g(-0.2, -0.45, 0.04) + 0.06 * Math.sin(x * 7) * Math.sin(y * 6); };
      const grad = (x, y) => { const e = 1e-5; return [(fj(x + e, y) - fj(x - e, y)) / (2 * e), (fj(x, y + e) - fj(x, y - e)) / (2 * e)]; };
      const hess_pd = (x, y) => { const e = 1e-3, fxx = (fj(x + e, y) - 2 * fj(x, y) + fj(x - e, y)) / e / e, fyy = (fj(x, y + e) - 2 * fj(x, y) + fj(x, y - e)) / e / e, fxy = (fj(x + e, y + e) - fj(x + e, y - e) - fj(x - e, y + e) + fj(x - e, y - e)) / (4 * e * e); return fxx > 0 && fxx * fyy - fxy * fxy > 0; };
      // gradient flow on the CPU from a start, to name its basin
      const basin = (x, y) => { for (let i = 0; i < 60000; i++) { const g = grad(x, y); x -= 0.0016 * g[0]; y -= 0.0016 * g[1]; if (g[0] * g[0] + g[1] * g[1] < 1e-14) break; } return [x, y]; };
      const keep = S.beta; let at_min = 0, same = 0, n_checked = 0, n0 = 0;
      for (const beta of [0, 0.85]) {
        S.beta = beta; pour(0, 0, 1.2); const starts = read_float(gl, st.read);
        for (let i = 0; i < 24000; i++) pass(gl, P.step, { st: st.read, beta, eta: 0.0016, ...U() }, st.write), st.swap();
        const end = read_float(gl, st.read);
        for (let i = 0; i < N; i += 9) {
          const x = end[i * 4], y = end[i * 4 + 1], g = grad(x, y);
          if (Math.abs(x) > asp * 0.999 || Math.abs(y) > 0.999) continue;   // a ball that rolled off the page
          n_checked++; if (Math.hypot(...g) < 1e-3 && hess_pd(x, y)) at_min++;
          if (beta === 0) { n0++; const b = basin(starts[i * 4], starts[i * 4 + 1]); if (Math.hypot(b[0] - x, b[1] - y) < 0.01) same++; }
        }
      }
      S.beta = keep; pour(0, 0, 1.2);
      const all_min = at_min === n_checked, same_basin = same === n0;
      return { pass: all_min && same_basin, value: `${zh ? '停在极小' : 'at a minimum'} ${at_min}/${n_checked}; β = 0 ${zh ? '同盆地' : 'same basin'} ${same}/${n0}` };
    },
  };
}
