// M10 · Eigenmodes as Chladni sand. A square plate rings in one of its modes, u = cos(nπx)cos(mπy) − cos(mπx)cos(nπy)
// (Chladni's own approximation for a free plate). Sand grains are kicked in proportion to how much the plate moves
// under them, so they wander off the moving parts and gather where it is still: on the nodal lines. Tap to ring the
// plate in the next mode. The sand is white on a black lacquered plate: a night tray.
// As a library primitive: sand(u) shows the zero set of any field by letting matter find it.
import { context, program, pass, pingpong, scheduler, fit_canvas, read_float, use } from '../../lib/gl.js';

export const meta = {
  id: 'chladni',
  name: { zh: '本征模 · 克拉尼沙', en: 'Eigenmodes as Chladni sand' },
  means: { zh: '金属板在某个本征频率上振动：哪里动得厉害，沙子就被弹走；最后沙子停在不动的地方，画出节线。', en: 'A plate rings at one of its eigenfrequencies: sand is thrown off where it moves and comes to rest where it is still, drawing the nodal lines.' },
  test: { zh: '静下来后 ≥ 80% 的沙子落在 |u| < 0.1 的地方（那里只占板面的一小部分）', en: 'Once settled, ≥ 80 % of the sand lies where |u| < 0.1 (a small part of the plate)' },
  night: true,
};

const TS = 256, N = TS * TS;
const MODES = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [1, 6], [4, 5], [3, 7]];
const U = `
uniform vec2 nm; uniform float sgn;
float u(vec2 p){ vec2 x = (p + 1.0) * 0.5; float n = nm.x, m = nm.y; return cos(n * 3.14159265 * x.x) * cos(m * 3.14159265 * x.y) + sgn * cos(m * 3.14159265 * x.x) * cos(n * 3.14159265 * x.y); }`;
const STEP = `in vec2 uv; out vec4 o; uniform sampler2D st; uniform float seed; uniform float amp;` + U + `
void main(){
  vec4 s = texelFetch(st, ivec2(gl_FragCoord.xy), 0);
  // a kick whose size is how much the plate moves here: a random walk with diffusivity ∝ u²
  vec2 r = hash22(gl_FragCoord.xy * 0.731 + seed) * 2.0 - 1.0;
  vec2 p = s.xy + r * amp * abs(u(s.xy));
  p = clamp(p, vec2(-0.995), vec2(0.995));
  o = vec4(p, s.xy);
}`;
const SAND_VS = `uniform sampler2D st; uniform float scale; uniform vec2 off; uniform float px;
out float lum; void main(){ ivec2 c = ivec2(gl_VertexID % ${TS}, gl_VertexID / ${TS}); vec4 s = texelFetch(st, c, 0); lum = 0.6 + 0.4 * hash12(vec2(c)); gl_Position = vec4(s.xy * scale + off, 0, 1); gl_PointSize = px; }`;
const SAND_FS = `in float lum; out vec4 o; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float a = smoothstep(1.0, 0.3, dot(q, q)); o = vec4(vec3(0.95, 0.93, 0.88) * lum * a * 0.5, 1.0); }`;
const PLATE = `in vec2 uv; out vec4 o; uniform vec2 res; uniform vec2 scale2;` + U + `
void main(){
  vec2 p = (uv * 2.0 - 1.0) / scale2;
  vec3 c = to_lin(vec3(0.035, 0.038, 0.05));
  if (max(abs(p.x), abs(p.y)) < 1.0){
    // black lacquer: a faint sheen across the plate, a bevelled edge catching the light
    c = to_lin(vec3(0.055, 0.058, 0.07)) * (1.0 + 0.25 * smoothstep(1.4, 0.0, length(p - vec2(-0.6, 0.6))));
    float e = 1.0 - max(abs(p.x), abs(p.y));
    c += vec3(0.25) * smoothstep(0.012, 0.0, e) * (0.5 + 0.5 * (p.y - p.x) * 0.5);
  }
  o = vec4(to_srgb(c), 1.0);
}`;
const ADD = `in vec2 uv; out vec4 o; uniform sampler2D base; uniform sampler2D sand; void main(){ vec3 c = texture(base, uv).rgb + (1.0 - exp(-texture(sand, uv).rgb * 2.0)); o = vec4(to_srgb(c), 1.0); }`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', gl = context(canvas);
  fit_canvas(canvas, 2);
  const st = pingpong(gl, TS, TS, { type: 'f32', filter: 'nearest' });
  const P = { step: program(gl, STEP), sand: program(gl, SAND_FS, SAND_VS), plate: program(gl, PLATE) };
  let mode = 2, seed = 0, amp = 0.06, last = performance.now();
  function scatter() { const d = new Float32Array(N * 4); for (let i = 0; i < N; i++) { d[i * 4] = Math.random() * 2 - 1; d[i * 4 + 1] = Math.random() * 2 - 1; } for (const t of [st.read, st.write]) { gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TS, TS, 0, gl.RGBA, gl.FLOAT, d); } }
  const modeU = () => ({ nm: MODES[mode], sgn: mode % 2 ? 1 : -1 });
  function step(n = 1) { for (let i = 0; i < n; i++) { seed = (seed + 1.618) % 977; pass(gl, P.step, { st: st.read, seed, amp, ...modeU() }, st.write); st.swap(); } }
  function draw() {
    const W = canvas.width, H = canvas.height, s = Math.min(W, H) * 0.42, sc = [s / (W / 2), s / (H / 2)];
    pass(gl, P.plate, { res: [W, H], scale2: sc, ...modeU() });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    use(gl, P.sand, { st: st.read, scale: 1, off: [0, 0], px: Math.max(1.5, H / 520), ...modeU() });
    gl.bindVertexArray(gl.vao_empty);
    // the plate is square: the sand is drawn in a square viewport over it
    const side = Math.round(2 * s); gl.viewport(Math.round((W - side) / 2), Math.round((H - side) / 2), side, side);
    gl.drawArrays(gl.POINTS, 0, N); gl.disable(gl.BLEND); gl.viewport(0, 0, W, H);
    hud.innerHTML = `${zh ? '模态' : 'mode'} (${MODES[mode][0]}, ${MODES[mode][1]})`;
  }
  const sched = scheduler(() => { amp = Math.max(0.0015, amp * 0.995); step(6); draw(); return performance.now() - last < 9000; });
  canvas.addEventListener('pointerdown', () => { mode = (mode + 1) % MODES.length; amp = 0.06; last = performance.now(); sched.wake(); });
  scatter(); for (let i = 0; i < 400; i++) { amp = Math.max(0.004, amp * 0.995); step(1); } draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 2); draw(); },
    demo() { mode = (mode + 1) % MODES.length; amp = 0.06; last = performance.now(); sched.wake(); },
    set(k) { mode = k; amp = 0.06; for (let i = 0; i < 1400; i++) { amp = Math.max(0.004, amp * 0.996); step(1); } draw(); },
    async accept() {
      // settle a mode, then count grains near the nodal set, against how much of the plate that set covers
      const k = 4; mode = k; scatter(); amp = 0.06; for (let i = 0; i < 5000; i++) { amp = Math.max(0.0015, amp * 0.997); step(1); }
      const s = read_float(gl, st.read), [n, m] = MODES[k], sg = k % 2 ? 1 : -1, uu = (x, y) => { const a = (x + 1) / 2, b = (y + 1) / 2; return Math.cos(n * Math.PI * a) * Math.cos(m * Math.PI * b) + sg * Math.cos(m * Math.PI * a) * Math.cos(n * Math.PI * b); };
      let near = 0; for (let i = 0; i < N; i++) if (Math.abs(uu(s[i * 4], s[i * 4 + 1])) < 0.1) near++;
      let area = 0; const G = 400; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) if (Math.abs(uu(i / G * 2 - 1, j / G * 2 - 1)) < 0.1) area++;
      draw();
      const f = near / N, a = area / G / G;
      return { pass: f >= 0.8, value: `${zh ? '沙子在节线附近' : 'sand near the nodes'} ${(f * 100).toFixed(1)}% (${zh ? '那里只占板面' : 'which is only'} ${(a * 100).toFixed(1)}%)` };
    },
  };
}
