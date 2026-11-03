// 7 · Reaction–diffusion, printed as letterpress. Two chemicals, two local rules (feed F, kill k), and global
// pattern appears: spots, stripes, mazes. The small card is the parameter plane itself: one simulation whose F
// rises upwards and k to the right, so it shows every pattern at once. The glass bead picks the main sheet's (F, k).
import { context, program, pass, pingpong, scheduler, pointer, fit_canvas, read_float, clamp } from '../../lib/gl.js';

export const meta = {
  id: 'rd',
  name: { zh: '反应扩散 · 凸版', en: 'Reaction–diffusion, letterpress' },
  means: { zh: '只有两条局部规则，整体却长出了花纹；换一组参数，就换一种花纹。', en: 'Two local rules make a global pattern; another pair of parameters, another pattern.' },
  test: { zh: '斑点参数下是许多圆斑，迷宫参数下是长带；一万步后无数值发散', en: 'Spot parameters give many round spots, maze parameters long bands; no blow-up after 10 000 steps' },
};

export const F_RANGE = [0.018, 0.062], K_RANGE = [0.055, 0.0665];
const SIM = `in vec2 uv; out vec4 o; uniform sampler2D s; uniform vec2 fk; uniform int map; uniform vec2 fr; uniform vec2 kr; uniform vec4 seed;
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy), n = textureSize(s, 0);
  #define S(dx, dy) texelFetch(s, (c + ivec2(dx, dy) + n) % n, 0).xy
  vec2 a = S(0, 0);
  vec2 lap = -a + 0.2 * (S(1, 0) + S(-1, 0) + S(0, 1) + S(0, -1)) + 0.05 * (S(1, 1) + S(-1, 1) + S(1, -1) + S(-1, -1));
  vec2 p = fk;
  if (map == 1){ vec2 q = (vec2(c) + 0.5) / vec2(n); p = vec2(mix(fr.x, fr.y, q.y), mix(kr.x, kr.y, q.x)); }
  float F = p.x, K = p.y, uvv = a.x * a.y * a.y;
  vec2 b = a + vec2(1.0 * lap.x - uvv + F * (1.0 - a.x), 0.5 * lap.y + uvv - (F + K) * a.y);
  // a pressed seed (the hand)
  if (seed.z > 0.0 && length(vec2(c) - seed.xy) < seed.z) b.y = 0.5;
  o = vec4(clamp(b, 0.0, 1.0), 0, 1);
}`;
// letterpress: where v is high the type pressed the paper down and left ink. The relief is lit from the upper left:
// the wall facing the light is bright, the wall away from it in shade; ink gathers at the edges of each shape
// (the "squeeze") and thins in its middle, where the paper's tooth shows through.
const SHOW = `in vec2 uv; out vec4 o; uniform sampler2D s; uniform vec2 res; uniform vec4 inset; uniform sampler2D m; uniform vec2 bead; uniform float bead_r;
float vfield(sampler2D t, vec2 q){ return smoothstep(0.16, 0.34, texture(t, q).y); }
vec3 press(sampler2D t, vec2 q, vec2 px, float scale){
  float v = vfield(t, q);
  vec2 g = vec2(vfield(t, q + vec2(px.x, 0)) - vfield(t, q - vec2(px.x, 0)), vfield(t, q + vec2(0, px.y)) - vfield(t, q - vec2(0, px.y)));
  float blur = 0.0; for (int i = 0; i < 8; i++){ float a = float(i) * 0.785; blur += vfield(t, q + vec2(cos(a), sin(a)) * px * 2.5); } blur /= 8.0;
  float tooth = vnoise(q * res * 0.55) * 0.6 + vnoise(q * res * 1.7) * 0.4;
  vec3 paper = to_lin(PAPER) * (0.975 + 0.03 * tooth);
  vec3 ink = to_lin(vec3(0.085, 0.09, 0.11));
  // the squeeze: more ink near an edge (where the blurred field is between 0 and 1), less in the middle
  float edge = 1.0 - abs(2.0 * blur - 1.0);
  float cover = v * clamp(0.86 + 0.25 * edge - 0.16 * smoothstep(0.58, 0.78, tooth), 0.0, 1.0);
  vec3 c = mix(paper, ink, cover);
  // the relief: debossed, so the gradient of v points down into the press
  float lit = dot(normalize(vec2(-0.7, 0.7)), g) * scale * 3.2;
  c *= 1.0 - 0.38 * clamp(lit, 0.0, 1.0);
  c += vec3(0.16) * clamp(-lit, 0.0, 1.0) * (1.0 - cover);
  return c;
}
void main(){
  vec2 p = uv * res;
  vec3 c = press(s, uv, 1.0 / vec2(textureSize(s, 0)), 1.0);
  vec2 lo = inset.xy, hi = inset.xy + inset.zw;
  // the parameter card lies on the sheet: a white card with a soft contact shadow
  vec2 d2 = max(lo - p, p - hi); float card = max(d2.x, d2.y);
  vec2 so = p - vec2(1.5, -4.0); vec2 sd = max(lo - so, so - hi); float sh = smoothstep(12.0, -3.0, length(max(sd, 0.0)) + min(max(sd.x, sd.y), 0.0));
  c *= 1.0 - 0.13 * sh * step(0.0, card);
  if (card < 0.0){
    vec2 q = (p - lo) / inset.zw;
    c = press(m, q, 1.0 / vec2(textureSize(m, 0)), 0.7);
    // the bead: a clear glass ring with a shadow under it
    vec2 bc = lo + bead * inset.zw; float r = length(p - bc), rs = length(p - bc - vec2(1.5, -2.5));
    c *= 1.0 - 0.28 * smoothstep(bead_r + 2.0, bead_r - 1.0, rs) * smoothstep(bead_r - 5.0, bead_r - 2.0, rs);
    float ringm = smoothstep(bead_r + 0.8, bead_r - 0.6, r) * smoothstep(bead_r - 4.2, bead_r - 2.6, r);
    float hl = 0.5 + 0.5 * dot(normalize(p - bc + 1e-4), normalize(vec2(-0.7, 0.7)));
    c = mix(c, vec3(1.0), ringm * (0.55 + 0.45 * hl));
    c = mix(c, to_lin(INK), smoothstep(bead_r + 1.4, bead_r + 0.4, r) * smoothstep(bead_r - 0.2, bead_r + 0.6, r) * 0.55);
  }
  o = vec4(to_srgb(c), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const gl = context(canvas);
  fit_canvas(canvas, 2);
  const asp = canvas.width / canvas.height, W = Math.min(1024, Math.round(canvas.width / 1.6)), H = Math.round(W / asp), MW = 288, MH = 180;
  const seed_tex = (w, h, spots) => { const d = new Float32Array(w * h * 4); for (let i = 0; i < w * h; i++) { d[i * 4] = 1; d[i * 4 + 1] = 0; } for (let k = 0; k < spots; k++) { const cx = Math.random() * w | 0, cy = Math.random() * h | 0, r = 3 + (Math.random() * 5 | 0); for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) { const i = (((cy + y + h) % h) * w + ((cx + x + w) % w)) * 4; d[i] = 0.5; d[i + 1] = 0.25 + Math.random() * 0.1; } } return d; };
  const mk = (w, h, spots) => { const t = pingpong(gl, w, h, { type: 'f32' }); const d = seed_tex(w, h, spots); for (const x of [t.read, t.write]) { gl.bindTexture(gl.TEXTURE_2D, x.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, d); } return t; };
  let A = mk(W, H, Math.round(W * H / 3000)); const M = mk(MW, MH, 220);
  const P = { sim: program(gl, SIM), show: program(gl, SHOW) };
  const S = { bead: [0.62, 0.62], last: performance.now(), seed: [0, 0, 0, 0] };
  const fk = () => [F_RANGE[0] + S.bead[1] * (F_RANGE[1] - F_RANGE[0]), K_RANGE[0] + S.bead[0] * (K_RANGE[1] - K_RANGE[0])];
  function inset() { const s = canvas.height / 800, w = 300 * s, h = w * MH / MW; return [canvas.width - w - 28 * s, 28 * s, w, h]; }
  function step(n) {
    for (let i = 0; i < n; i++) {
      pass(gl, P.sim, { s: A.read, fk: fk(), map: 0, fr: F_RANGE, kr: K_RANGE, seed: i === 0 ? S.seed : [0, 0, 0, 0] }, A.write); A.swap();
      pass(gl, P.sim, { s: M.read, fk: fk(), map: 1, fr: F_RANGE, kr: K_RANGE, seed: [0, 0, 0, 0] }, M.write); M.swap();
    }
    S.seed = [0, 0, 0, 0];
  }
  const draw = () => pass(gl, P.show, { s: A.read, m: M.read, res: [canvas.width, canvas.height], inset: inset(), bead: S.bead, bead_r: 13 * canvas.height / 800 });
  function readout() { const [F, K] = fk(); hud.innerHTML = `F <b>${F.toFixed(4)}</b> · k <b>${K.toFixed(4)}</b>`; }
  const sched = scheduler(() => { step(16); draw(); return performance.now() - S.last < 14000; });
  let on_card = false;
  pointer(canvas, (kind, p) => {
    const [x0, y0, w, h] = inset(), px = p.x * canvas.width, py = p.y * canvas.height;
    const inside = px > x0 - 14 && px < x0 + w + 14 && py > y0 - 14 && py < y0 + h + 14;
    if (kind === 'down') on_card = inside;
    if ((kind === 'down' || kind === 'move') && p.down) {
      if (on_card) { S.bead = [clamp((px - x0) / w, 0, 1), clamp((py - y0) / h, 0, 1)]; readout(); }
      else S.seed = [p.x * W, p.y * H, 6, 0];
    }
    S.last = performance.now(); sched.wake();
  });
  window.__rd_dbg = () => { const d = read_float(gl, A.read); let mx = 0, mu = 0; for (let i = 0; i < d.length; i += 4) { mx = Math.max(mx, d[i + 1]); mu += d[i]; } return [mx, mu / (d.length / 4), d.slice(0, 8)]; };
  window.__rd_dbg0 = window.__rd_dbg();
  step(2400); readout(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 2); draw(); },
    demo() { S.last = performance.now(); sched.wake(); },
    async accept() {
      // two settings, the same seed, 6000 steps each on a small sheet; tell spots from bands by their shapes
      const run = (F, K) => {
        const T = mk(200, 200, 40);
        for (let i = 0; i < 6000; i++) { pass(gl, P.sim, { s: T.read, fk: [F, K], map: 0, fr: F_RANGE, kr: K_RANGE, seed: [0, 0, 0, 0] }, T.write); T.swap(); }
        const d = read_float(gl, T.read); const v = new Float32Array(200 * 200); let nan = false;
        for (let i = 0; i < v.length; i++) { v[i] = d[i * 4 + 1]; if (!Number.isFinite(v[i])) nan = true; }
        return { ...blobs(v, 200, 200, 0.25), nan };
      };
      const spots = run(0.0367, 0.0649), maze = run(0.029, 0.057);
      const ok = !spots.nan && !maze.nan && spots.n >= 20 && spots.round > 0.6 && maze.round < 0.35;
      return { pass: ok, value: `${lang === 'zh' ? '斑点' : 'spots'}: ${spots.n} ${lang === 'zh' ? '块' : 'blobs'}, ${lang === 'zh' ? '圆度' : 'roundness'} ${spots.round.toFixed(2)}; ${lang === 'zh' ? '迷宫' : 'maze'}: ${maze.n} ${lang === 'zh' ? '块' : 'blobs'}, ${lang === 'zh' ? '圆度' : 'roundness'} ${maze.round.toFixed(2)}` };
    },
  };
}
// connected regions above a threshold (periodic grid): count, and mean roundness 4πA / P²
function blobs(v, w, h, th) {
  const lab = new Int32Array(w * h).fill(-1); let n = 0, round = 0;
  const on = (i) => v[i] > th;
  for (let i = 0; i < w * h; i++) {
    if (!on(i) || lab[i] >= 0) continue;
    const st = [i]; lab[i] = n; let A = 0, Pm = 0;
    while (st.length) {
      const j = st.pop(), x = j % w, y = (j / w) | 0; A++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = ((y + dy + h) % h) * w + ((x + dx + w) % w);
        if (!on(k)) Pm++; else if (lab[k] < 0) { lab[k] = n; st.push(k); }
      }
    }
    // a 4-connected perimeter overestimates a circle's by 4/π; correct for it
    const Pc = Pm * Math.PI / 4;
    round += Math.min(1, 4 * Math.PI * A / (Pc * Pc)); n++;
  }
  return { n, round: n ? round / n : 0 };
}
