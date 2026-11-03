// Liquid algebra. Every glyph is a signed distance field, so a formula can change the way ink would: a term
// travels across the equals sign, a + becomes a −, and 11 − 3 flows together into 8. Glyphs that pass close join
// by a liquid bridge (a smooth union whose width grows with their speed), and every resting frame is exactly the
// typeset step. As a library primitive: TransformMatchingTex done as matter, for any formula or any text.
import { context, program, pass, fit_canvas } from '../lib/gl.js';
import { glyph_atlas } from '../lib/sdf.js';
import { scheduler, Spring } from '../lib/ui.js';

export const meta = {
  id: 'algebra',
  name: { zh: '液态代数', en: 'Liquid algebra' },
  means: { zh: '公式的每一步像墨一样变化：一项越过等号、加号变减号、11 − 3 流到一起成为 8。停下来的每一帧都正好是排好的那一步。', en: 'Each step of a formula changes as ink would: a term crosses the equals sign, + becomes −, 11 − 3 flows together into 8. Every resting frame is exactly the typeset step.' },
  test: { zh: '静止时与直接排版的字形重合（1 像素容差内 ≥ 99%）；每一步代入 x = 4 都成立', en: 'At rest the glyphs match the typeset step (≥ 99 % within 1 px); every step holds at x = 4' },
  wide: true,
};

const SERIF = '"Noto Serif", "DejaVu Serif", "Times New Roman", Georgia, serif';
const GLYPHS = [['2'], ['x', `italic {px}px ${SERIF}`], ['+'], ['3'], ['='], ['1'], ['8'], ['−'], ['4'], ['÷']].map(([ch, f]) => ({ ch, font: f || `{px}px ${SERIF}` }));
// each step: slots of [glyph, instance ids that sit in it]
const STEPS = [
  [['2', ['a']], ['x', ['x']], ['+', ['p']], ['3', ['t']], ['=', ['e']], ['1', ['o1']], ['1', ['o2']]],
  [['2', ['a']], ['x', ['x']], ['=', ['e']], ['1', ['o1']], ['1', ['o2']], ['−', ['p']], ['3', ['t']]],
  [['2', ['a']], ['x', ['x']], ['=', ['e']], ['8', ['o1', 'o2', 'p', 't']]],
  [['x', ['x']], ['=', ['e']], ['8', ['o1', 'o2', 'p', 't']], ['÷', ['d']], ['2', ['a']]],
  [['x', ['x']], ['=', ['e']], ['4', ['o1', 'o2', 'p', 't', 'd', 'a']]],
];
const CHECK = [(x) => 2 * x + 3 === 11, (x) => 2 * x === 11 - 3, (x) => 2 * x === 8, (x) => x === 8 / 2, (x) => x === 4];
const IDS = ['a', 'x', 'p', 't', 'e', 'o1', 'o2', 'd'];
const OPS = new Set(['+', '−', '=', '÷']);

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform sampler2D atlas; uniform vec2 atlas_size; uniform float cell; uniform float cols; uniform float px_scale;
uniform vec4 I0[8]; uniform vec4 I1[8];
float glyph(float gi, vec2 q){
  // q in cell units (0..1, y up); outside the cell, the distance grows from its edge
  vec2 c = clamp(q, vec2(0.004), vec2(0.996));
  vec2 org = vec2(mod(gi, cols), floor(gi / cols)) * cell;
  float d = texture(atlas, (org + c * cell) / atlas_size).r;
  return d + length(q - c) * cell;
}
float smin(float a, float b, float k){ if (k <= 0.0) return min(a, b); float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float field(vec2 p){
  float d = 1e5;
  for (int i = 0; i < 8; i++){
    vec4 a = I0[i], b = I1[i];
    if (a.w <= 0.001) continue;
    vec2 q = (p - a.xy) / a.z + 0.5;
    float g = mix(glyph(b.x, q), glyph(b.y, q), b.z) * a.z / cell;  // screen pixels
    // growing in or melting away: the outline erodes as w → 0
    g += (1.0 - a.w) * a.z * 0.22;
    d = smin(d, g, b.w);
  }
  return d;
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  float d = field(p);
  vec3 col = to_lin(PAPER);
  float aa = 0.75;
  float ink = smoothstep(aa, -aa, d);
  if (ink > 0.0){
    // wet ink: a shallow dome over the depth inside the outline, one highlight from the upper left
    vec2 e = vec2(1.0, 0.0);
    float h0 = sqrt(clamp(-d / (6.0 * px_scale), 0.0, 1.0));
    float hx = sqrt(clamp(-field(p + e.xy) / (6.0 * px_scale), 0.0, 1.0)) - sqrt(clamp(-field(p - e.xy) / (6.0 * px_scale), 0.0, 1.0));
    float hy = sqrt(clamp(-field(p + e.yx) / (6.0 * px_scale), 0.0, 1.0)) - sqrt(clamp(-field(p - e.yx) / (6.0 * px_scale), 0.0, 1.0));
    vec3 n = normalize(vec3(-hx * 3.0, -hy * 3.0, 1.0));
    float spec = pow(max(dot(n, normalize(vec3(-0.35, -0.55, 1.0))), 0.0), 120.0);
    vec3 c = to_lin(vec3(0.10, 0.105, 0.125)) + vec3(0.6) * spec * 0.45;
    col = mix(col, c, ink);
  }
  o = vec4(to_srgb(col), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh';
  const gl = context(canvas), prog = program(gl, FS);
  fit_canvas(canvas, 2);
  const atlas = glyph_atlas(gl, GLYPHS, 224, 160);
  const gi = (ch) => atlas.index.get(ch);
  let step = 0, FONT = 0;
  // per instance: x, y on springs; glyph from → to with a morph spring; presence w
  const inst = Object.fromEntries(IDS.map((id) => [id, { x: new Spring(0, 0.62, 0.86), y: new Spring(0, 0.62, 0.86), m: new Spring(1, 0.5, 1), w: new Spring(0, 0.45, 1), ga: 0, gb: 0, x0: 0, x1: 0, y1: 0, d0: 0, carrier: true, cross: false }]));
  function layout(k) {
    const W = canvas.width, H = canvas.height, row = STEPS[k];
    FONT = Math.min(W / 9.5, H / 3.2);
    const adv = (ch) => atlas.metrics[gi(ch)].adv * FONT + (OPS.has(ch) ? FONT * 0.34 : FONT * 0.04);
    const total = row.reduce((s, [ch]) => s + adv(ch), 0);
    let x = (W - total) / 2; const out = {};
    for (const [ch, ids] of row) { const w = adv(ch); ids.forEach((id, j) => { out[id] = { x: x + w / 2, y: H * 0.5 + FONT * (0.68 - 0.5) * (atlas.cell / atlas.px), ch, carrier: j === 0 }; }); x += w; }
    return out;
  }
  function go(k, snap = false) {
    const prev = layout(step), next = layout(k);
    const e_prev = prev.e?.x ?? 0;
    for (const id of IDS) {
      const I = inst[id], n = next[id];
      if (!n) { I.w.to(0); if (snap) I.w.snap(0); continue; }
      const appearing = !prev[id] || I.w.target === 0;
      if (I.gb !== gi(n.ch) || snap) { I.ga = snap || appearing ? gi(n.ch) : I.gb; I.gb = gi(n.ch); I.m.snap(snap ? 1 : 0); I.m.to(1); }
      if (appearing && !snap) { I.x.snap(n.x); I.y.snap(n.y); }
      // a term that crosses the equals sign travels on an arc
      I.d0 = Math.hypot(n.x - I.x.x, n.y - I.y.x); I.y1 = n.y; I.carrier = n.carrier;
      I.x0 = I.x.x; I.x1 = n.x; I.cross = prev[id] && next.e && (prev[id].x - e_prev) * (n.x - next.e.x) < 0;
      I.x.to(n.x); I.y.to(n.y); I.w.to(1);
      if (snap) { I.x.snap(n.x); I.y.snap(n.y); I.w.snap(1); I.d0 = 0; }
    }
    step = k; sched.wake(2600);
  }
  function uniforms() {
    const I0 = [], I1 = [], size = FONT * atlas.cell / atlas.px;
    for (const id of IDS) {
      const I = inst[id], span = I.x1 - I.x0, prog_ = span ? Math.max(0, Math.min(1, (I.x.x - I.x0) / span)) : 1;
      const arc = I.cross ? -Math.sin(Math.PI * prog_) * FONT * 0.55 : 0;
      const speed = Math.hypot(I.x.v, I.y.v) / FONT;
      // how far along its journey it is: the glyph changes shape as it arrives, not on a clock
      const near = I.d0 > 2 ? 1 - Math.min(1, Math.hypot(I.x.x - I.x1, I.y.x - I.y1) / I.d0) : 1;
      const m = I.d0 > 2 ? Math.min(Math.max(0, I.m.x), near * near * (3 - 2 * near)) : Math.max(0, Math.min(1, I.m.x));
      // ink that joins another glyph flows into it and is gone: only the slot's carrier stays
      let w = Math.max(0, Math.min(1, I.w.x)); if (!I.carrier && I.d0 > 2) w *= 1 - near * near; else if (!I.carrier) w = 0;
      I0.push(I.x.x, I.y.x + arc, size, w);
      // the liquid bridge exists only in motion: at rest the union is exact
      I1.push(I.ga, I.gb, m, FONT * Math.min(0.2, speed * 0.07));
    }
    return { I0: new Float32Array(I0), I1: new Float32Array(I1) };
  }
  function draw() { pass(gl, prog, { res: [canvas.width, canvas.height], atlas, atlas_size: [atlas.w, atlas.h], cell: atlas.cell, cols: atlas.cols, px_scale: canvas.width / canvas.getBoundingClientRect().width, ...uniforms() }); hud.innerHTML = `${zh ? '第' : 'step'} <b>${step + 1}</b> / ${STEPS.length}`; }
  const sched = scheduler((dt) => { let b = false; for (const id of IDS) for (const k of ['x', 'y', 'm', 'w']) b = inst[id][k].step(dt) || b; draw(); return b; });
  canvas.addEventListener('pointerdown', () => go((step + 1) % STEPS.length));
  addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(Math.min(STEPS.length - 1, step + 1)); if (e.key === 'ArrowLeft') go(Math.max(0, step - 1)); });
  go(0, true); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 2); go(step, true); draw(); },
    demo() { go((step + 1) % STEPS.length); }, go,
    async accept() {
      // at rest each step must be the typeset step: compare the drawn ink with the glyphs placed directly
      let worst = 1;
      for (let k = 0; k < STEPS.length; k++) {
        go(k, true); draw();
        const W = canvas.width, H = canvas.height, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const ref = document.createElement('canvas'); ref.width = W; ref.height = H; const g = ref.getContext('2d');
        const L = layout(k), size = FONT;
        for (const [ch, ids] of STEPS[k]) { const p = L[ids[0]], G = GLYPHS[gi(ch)]; g.font = G.font.replace('{px}', size); g.textAlign = 'center'; g.fillText(ch, p.x, p.y + (0.68 - 0.5) * size * atlas.cell / atlas.px); }
        // ink pixels agree if the other image has ink within one pixel (anti-aliased type differs by a hair at its rim)
        const R = g.getImageData(0, 0, W, H).data, A = (x, y) => px[((H - 1 - y) * W + x) * 4] < 128, B = (x, y) => R[(y * W + x) * 4 + 3] > 128;
        const near = (f, x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (f(x + dx, y + dy)) return true; return false; };
        let ok_n = 0, all_n = 0;
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const a = A(x, y), b = B(x, y); if (!a && !b) continue; all_n++; if ((a && near(B, x, y)) || (b && near(A, x, y))) ok_n++; }
        const best = ok_n / all_n;
        worst = Math.min(worst, best);
      }
      const holds = CHECK.every((f) => f(4));
      go(0, true); draw();
      return { pass: worst >= 0.99 && holds, value: `${zh ? '最差重合' : 'worst match'} ${(worst * 100).toFixed(1)}%; x = 4 ${zh ? '每步成立' : 'holds at every step'} ${holds ? '✓' : '✗'}` };
    },
  };
}
