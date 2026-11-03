// A2 · Liquid selection. Choosing is moving a drop of wet ink: its head runs to the new option, its tail follows,
// and the bridge between them thins as it stretches (the ink is conserved). Labels are composited in the shader,
// so text turns white exactly where the ink is under it. The same drop serves tabs, a list and toggles.
import { context, program, pass, scheduler, fit_canvas, texture } from '../../lib/gl.js';
import { Spring, SANS } from '../../lib/ui.js';

export const meta = {
  id: 'select',
  name: { zh: '流动的选择', en: 'Liquid selection' },
  means: { zh: '“选中”是一滴墨：它流到你点的地方，拉长、变细、再聚拢。分段、列表、开关都是同一滴墨。', en: '"Selected" is a drop of ink: it flows to what you tap, stretching, thinning, gathering again. Tabs, lists and toggles are the same drop.' },
  test: { zh: '墨的面积在流动中守恒（±8%）；任何时刻都能被新的点击打断而不跳', en: 'The ink\'s area is conserved in flight (±8 %); any moment can be interrupted without a jump' },
};

const MAXD = 6;
const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform float dpr; uniform sampler2D labels;
uniform vec4 tracks[${MAXD}]; uniform float track_r[${MAXD}];
uniform vec4 head[${MAXD}]; uniform vec4 tail[${MAXD}]; uniform float amt[${MAXD}]; uniform int n;
uniform vec4 knobs[4]; uniform int nk;
float sd_box(vec2 p, vec2 c, vec2 b, float r){ vec2 q = abs(p - c) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sd_seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// one drop: a box at its head and one at its tail, joined by a bridge that thins as they part
float drop(vec2 p, vec4 H, vec4 T, float a){
  float d = length(H.xy - T.xy), hh = min(H.w, T.w), thin = 1.0 / sqrt(1.0 + d / (2.2 * hh));
  vec2 bh = H.zw * vec2(1.0, mix(0.62, 1.0, thin)), bt = T.zw * vec2(mix(0.7, 1.0, thin), mix(0.55, 1.0, thin));
  float r = min(bh.y, bh.x);
  float s = smin(sd_box(p, H.xy, bh * a, r * a), sd_box(p, T.xy, bt * a, min(bt.x, bt.y) * a), hh * 0.9);
  float bridge = sd_seg(p, H.xy, T.xy) - hh * thin * thin * 0.75 * a;
  return smin(s, bridge, hh * 0.6);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec3 col = to_lin(PAPER);
  float ink = 0.0, wet = 0.0, inkd = 1e9;
  vec3 nrm = vec3(0, 0, 1);
  for (int i = 0; i < ${MAXD}; i++){
    if (i >= n) break;
    // the track: a shallow well pressed into the paper
    float t = sd_box(p, tracks[i].xy, tracks[i].zw, track_r[i]);
    float well = smoothstep(0.8, -0.8, t);
    col = mix(col, to_lin(vec3(0.925, 0.92, 0.905)), well);
    col *= 1.0 - 0.10 * smoothstep(-5.0 * dpr, 0.0, t) * well * smoothstep(tracks[i].y - tracks[i].w, tracks[i].y - tracks[i].w + 5.0 * dpr, p.y) * 0.0;
    col *= 1.0 - 0.06 * well * (1.0 - smoothstep(0.0, 4.0 * dpr, p.y - (tracks[i].y - tracks[i].w)));
    float d = drop(p, head[i], tail[i], amt[i]);
    inkd = min(inkd, d);
  }
  // the ink: a wet surface (a dome over its depth) with one highlight from the upper left
  float a = smoothstep(0.7, -0.7, inkd);
  vec2 e = vec2(1.0, 0.0);
  if (a > 0.0){
    float hgt = sqrt(clamp(-inkd / (9.0 * dpr), 0.0, 1.0));
    float hx = 0.0, hy = 0.0;
    // the gradient of the height, from neighbouring distances
    float dxp = 1e9, dxm = 1e9, dyp = 1e9, dym = 1e9;
    for (int i = 0; i < ${MAXD}; i++){ if (i >= n) break;
      dxp = min(dxp, drop(p + e.xy, head[i], tail[i], amt[i])); dxm = min(dxm, drop(p - e.xy, head[i], tail[i], amt[i]));
      dyp = min(dyp, drop(p + e.yx, head[i], tail[i], amt[i])); dym = min(dym, drop(p - e.yx, head[i], tail[i], amt[i])); }
    float k = 1.0 / (9.0 * dpr);
    hx = sqrt(clamp(-dxp * k, 0.0, 1.0)) - sqrt(clamp(-dxm * k, 0.0, 1.0)); hy = sqrt(clamp(-dyp * k, 0.0, 1.0)) - sqrt(clamp(-dym * k, 0.0, 1.0));
    nrm = normalize(vec3(-hx * 4.0, -hy * 4.0, 1.0));
    vec3 L = normalize(vec3(-0.5, -0.8, 0.6)), Hh = normalize(L + vec3(0, 0, 1));
    float spec = pow(max(dot(nrm, Hh), 0.0), 140.0);
    vec3 inkc = to_lin(vec3(0.11, 0.115, 0.135)) * (0.85 + 0.15 * nrm.z);
    inkc += vec3(0.5) * spec * 0.35;
    // the ink's shadow on the well
    col = mix(col, inkc, a);
  }
  float shadow = smoothstep(4.0 * dpr, -1.0 * dpr, inkd - 0.0) * (1.0 - a);
  col *= 1.0 - 0.0 * shadow;
  // labels: ink on paper, white where the ink is under them
  vec4 lab = texture(labels, vec2(uv.x, uv.y));
  vec3 lc = mix(to_lin(INK), vec3(1.0), a);
  col = mix(col, lc, lab.a);
  // the toggles' knobs: small white beads on top
  for (int i = 0; i < 4; i++){ if (i >= nk) break;
    float kd = length(p - knobs[i].xy) - knobs[i].z;
    float sh = smoothstep(4.0 * dpr, -2.0 * dpr, length(p - knobs[i].xy - vec2(0, 1.5 * dpr)) - knobs[i].z) * 0.18;
    col *= 1.0 - sh * smoothstep(-0.7, 0.7, kd);
    float ka = smoothstep(0.7, -0.7, kd);
    float top = clamp(1.0 - (p.y - knobs[i].y + knobs[i].z) / (2.0 * knobs[i].z), 0.0, 1.0);
    col = mix(col, vec3(1.0) * (0.94 + 0.06 * top), ka);
  }
  o = vec4(to_srgb(col), 1.0);
}`;

const L10N = {
  zh: { tabs: ['概念', '推导', '代码', '练习'], list: ['预测：三秒后在哪儿', '代价：离目标多远', '约束：不能越过墙', '求解：每 0.1 秒一次', '回顾'], toggles: ['旁白', '字幕', '慢放'], head: ['这一课', '设置'] },
  en: { tabs: ['Idea', 'Derive', 'Code', 'Practice'], list: ['Predict: where in 3 s', 'Cost: how far from goal', 'Constraint: never past the wall', 'Solve: every 0.1 s', 'Review'], toggles: ['Narration', 'Captions', 'Slow motion'], head: ['This lesson', 'Settings'] },
};

export function make({ stage, canvas, hud, lang }) {
  const gl = context(canvas), prog = program(gl, FS);
  const T = L10N[lang];
  let dpr = 1, W = 0, H = 0, labels = null, G = null;
  const state = { tab: 1, item: 2, tog: [true, false, false] };
  const drops = [];   // { head: {x,y,w,h springs}, tail: {...}, amt: Spring, opts: [boxes], track }
  const mk = () => ({ x: new Spring(0, 0.3, 0.72), y: new Spring(0, 0.3, 0.72), w: new Spring(0, 0.3, 0.8), h: new Spring(0, 0.3, 0.8) });
  const mkt = () => ({ x: new Spring(0, 0.52, 0.92), y: new Spring(0, 0.52, 0.92), w: new Spring(0, 0.52, 0.92), h: new Spring(0, 0.52, 0.92) });
  function layout() {
    fit_canvas(canvas, 2);
    const r = canvas.getBoundingClientRect(); dpr = canvas.width / r.width; W = r.width; H = r.height;
    const narrow = W < 560, pad = narrow ? 16 : 32;
    const g = { tabs: [], list: [], togs: [], heads: [] };
    // tabs across the top
    const tw = Math.min(W - 2 * pad, 440), th = 40, tx = narrow ? pad : (W - tw) / 2;
    const total = narrow ? 40 + 28 + 26 + 44 * 5 + 36 + 26 + 56 * 3 : 40 + 40 + 26 + 46 * 5, ty = Math.max(pad, (H - total) / 2);
    g.track_tabs = [tx + tw / 2, ty + th / 2, tw / 2, th / 2, th / 2];
    const ow = (tw - 8) / 4; T.tabs.forEach((t, i) => g.tabs.push({ x: tx + 4 + ow * (i + 0.5), y: ty + th / 2, w: ow / 2, h: th / 2 - 4, label: t }));
    // the list and the toggles, side by side (stacked on a phone)
    const top = ty + th + (narrow ? 28 : 40), colw = narrow ? W - 2 * pad : Math.min(340, (W - 3 * pad) / 2);
    const lx = narrow ? pad : W / 2 - colw - pad / 2, rowh = narrow ? 44 : 46;
    g.heads.push({ x: lx + 14, y: top + 8, label: T.head[0] });
    const ly = top + 26, lh = rowh * T.list.length;
    g.track_list = [lx + colw / 2, ly + lh / 2, colw / 2, lh / 2, 14];
    T.list.forEach((t, i) => g.list.push({ x: lx + colw / 2, y: ly + rowh * (i + 0.5), w: colw / 2 - 5, h: rowh / 2 - 5, label: t, left: lx + 18 }));
    const rx = narrow ? pad : W / 2 + pad / 2, ry = narrow ? ly + lh + 36 : top;
    g.heads.push({ x: rx + 2, y: ry + 8, label: T.head[1] });
    T.toggles.forEach((t, i) => { const y = ry + 26 + 24 + i * 56; g.togs.push({ label: t, lx: rx + 2, y, track: [rx + colw - 30, y, 26, 16, 16] }); });
    return g;
  }
  function draw_labels() {
    const cv = document.createElement('canvas'); cv.width = canvas.width; cv.height = canvas.height;
    const c = cv.getContext('2d'); c.scale(dpr, dpr); c.textBaseline = 'middle'; c.fillStyle = '#000';
    c.font = `500 15px ${SANS}`; c.textAlign = 'center';
    for (const t of G.tabs) c.fillText(t.label, t.x, t.y + 0.5);
    c.textAlign = 'left'; c.font = `16px ${SANS}`;
    for (const t of G.list) c.fillText(t.label, t.left, t.y + 0.5);
    c.font = `600 13px ${SANS}`; c.globalAlpha = 0.55; for (const h of G.heads) c.fillText(h.label, h.x, h.y); c.globalAlpha = 1;
    c.font = `16px ${SANS}`; for (const t of G.togs) c.fillText(t.label, t.lx, t.y + 0.5);
    labels = texture(gl, cv.width, cv.height, { type: 'u8' });
    gl.bindTexture(gl.TEXTURE_2D, labels.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  function build() {
    G = layout(); draw_labels();
    drops.length = 0;
    drops.push({ opts: G.tabs, track: G.track_tabs, sel: () => state.tab });
    drops.push({ opts: G.list, track: G.track_list, sel: () => state.item });
    G.togs.forEach((t, i) => drops.push({ opts: [{ x: t.track[0] - 10, y: t.y, w: 12, h: 12 }, { x: t.track[0], y: t.y, w: 22, h: 12 }], track: t.track, sel: () => (state.tog[i] ? 1 : 0), toggle: i }));
    for (const d of drops) { d.head = mk(); d.tail = mkt(); d.amt = new Spring(1, 0.35, 1); snap(d); }
  }
  function target(d) { const i = d.sel(); return d.opts[i]; }
  function snap(d) { const o = target(d); for (const s of [d.head, d.tail]) { s.x.snap(o.x); s.y.snap(o.y); s.w.snap(o.w); s.h.snap(o.h); } d.amt.snap(d.toggle != null && !state.tog[d.toggle] ? 0 : 1); }
  function aim(d) { const o = target(d); for (const s of [d.head, d.tail]) { s.x.to(o.x); s.y.to(o.y); s.w.to(o.w); s.h.to(o.h); } if (d.toggle != null) d.amt.to(state.tog[d.toggle] ? 1 : 0); }
  build();
  function draw() {
    const f = (v) => v * dpr;
    const tracks = [], tr = [], heads = [], tails = [], amts = [], knobs = [];
    for (const d of drops) {
      tracks.push(f(d.track[0]), f(d.track[1]), f(d.track[2]), f(d.track[3])); tr.push(f(d.track[4]));
      heads.push(f(d.head.x.x), f(d.head.y.x), f(d.head.w.x), f(d.head.h.x)); tails.push(f(d.tail.x.x), f(d.tail.y.x), f(d.tail.w.x), f(d.tail.h.x));
      amts.push(Math.max(0, d.amt.x));
      if (d.toggle != null) { const on = d.head.x.x; knobs.push(f(on + (d.sel() ? 8 : -2) * 0 + (d.head.w.x - 12) * 0), f(d.track[1]), f(13), 0); }
    }
    pass(gl, prog, { res: [canvas.width, canvas.height], dpr, labels, tracks: new Float32Array(tracks), track_r: new Float32Array(tr), head: new Float32Array(heads), tail: new Float32Array(tails), amt: new Float32Array(amts), n: drops.length, knobs: new Float32Array(knobs.concat(Array(16 - knobs.length).fill(0))), nk: knobs.length / 4 });
  }
  // toggles: the knob rides the head; the ink fills the track when on
  for (const d of drops) if (d.toggle != null) { d.opts = [{ x: d.track[0] - 10, y: d.track[1], w: 13, h: 13 }, { x: d.track[0] + 10, y: d.track[1], w: 13, h: 13 }]; }
  for (const d of drops) snap(d);
  const sched = scheduler((dt) => {
    let b = false;
    for (const d of drops) { for (const s of [d.head, d.tail]) for (const k of ['x', 'y', 'w', 'h']) b = s[k].step(dt) || b; b = d.amt.step(dt) || b;
      // a toggle's ink is the whole track when on: the tail stays at the start, the head runs to the end
      if (d.toggle != null) { const on = state.tog[d.toggle]; d.tail.x.to(d.track[0] - 10); d.tail.w.to(13); d.head.w.to(13); }
    }
    // the ink is conserved: scale the drop so its area stays what it was at rest
    for (const d of drops) if (d.toggle == null) conserve(d);
    draw(); return b;
  });
  function cur(d) { return [[d.head.x.x, d.head.y.x, d.head.w.x, d.head.h.x], [d.tail.x.x, d.tail.y.x, d.tail.w.x, d.tail.h.x]]; }
  function area_at(d, sc, step = 1) {
    const [H, Tt] = cur(d); let n = 0;
    const x0 = Math.min(H[0] - H[2], Tt[0] - Tt[2]) - 4, x1 = Math.max(H[0] + H[2], Tt[0] + Tt[2]) + 4, y0 = Math.min(H[1] - H[3], Tt[1] - Tt[3]) - 4, y1 = Math.max(H[1] + H[3], Tt[1] + Tt[3]) + 4;
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) if (drop_cpu([x, y], H, Tt, sc) < 0) n++;
    return n * step * step;
  }
  function conserve(d) {
    const o = target(d), rest = d.rest || (d.rest = new Map()), key = o.w + 'x' + o.h;
    if (!rest.has(key)) rest.set(key, 4 * o.w * o.h - (4 - Math.PI) * Math.min(o.w, o.h) ** 2);
    const A0 = rest.get(key), [H, Tt] = cur(d);
    if (Math.hypot(H[0] - Tt[0], H[1] - Tt[1]) < 0.3) { d.amt.snap(1); return; }
    let lo = 0.3, hi = 1.05;
    for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; if (area_at(d, m, 2) > A0) hi = m; else lo = m; }
    d.amt.snap((lo + hi) / 2);
  }
  function hit(x, y) {
    for (const [di, d] of drops.entries()) {
      if (d.toggle != null) { const t = d.track; if (Math.abs(x - t[0]) < t[2] + 14 && Math.abs(y - t[1]) < 22) return { di, i: -1 }; continue; }
      for (const [i, o] of d.opts.entries()) if (Math.abs(x - o.x) <= o.w + 4 && Math.abs(y - o.y) <= o.h + 5) return { di, i };
    }
    return null;
  }
  function choose(h) {
    const d = drops[h.di];
    if (d.toggle != null) state.tog[d.toggle] = !state.tog[d.toggle];
    else if (h.di === 0) state.tab = h.i; else state.item = h.i;
    aim(d); sched.wake(1500);
  }
  let dragging = null;
  stage.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top); if (h) { choose(h); dragging = h.di; stage.setPointerCapture(e.pointerId); } });
  // dragging across options pulls the drop along with the finger
  stage.addEventListener('pointermove', (e) => { if (dragging == null) return; const r = canvas.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top); if (h && h.di === dragging && h.i >= 0) { const d = drops[h.di]; if (d.sel() !== h.i) choose(h); } });
  stage.addEventListener('pointerup', () => { dragging = null; });
  draw();
  // the ink's area, from its distance field on the CPU (same shape as the shader)
  function area(d) {
    const H = [d.head.x.x, d.head.y.x, d.head.w.x, d.head.h.x], Tt = [d.tail.x.x, d.tail.y.x, d.tail.w.x, d.tail.h.x];
    let n = 0; const x0 = Math.min(H[0], Tt[0]) - 60, x1 = Math.max(H[0], Tt[0]) + 60, y0 = Math.min(H[1], Tt[1]) - 40, y1 = Math.max(H[1], Tt[1]) + 40;
    for (let y = y0; y < y1; y += 0.5) for (let x = x0; x < x1; x += 0.5) if (drop_cpu([x, y], H, Tt, d.amt.x) < 0) n++;
    if (!d.rest) d.rest = new Map();
    return n * 0.25;
  }
  return {
    visible: (v) => sched.set_visible(v), resize: () => { build(); draw(); },
    demo() { state.tab = 3; aim(drops[0]); state.item = 0; aim(drops[1]); state.tog[1] = true; aim(drops[3]); sched.wake(1500); },
    async accept() {
      // fly the list's drop from the first item to the last and measure its area along the way
      const d = drops[1]; state.item = 0; snap(d); const a0 = area(d);
      state.item = 4; aim(d); let worst = 0, vmax_before = 0, vmax_after = 0, interrupted = false;
      for (let t = 0; t < 1.2; t += 1 / 60) {
        const before = [d.head.y.x, d.tail.y.x];
        for (const s of [d.head, d.tail]) for (const k of ['x', 'y', 'w', 'h']) s[k].step(1 / 60);
        if (!interrupted && t >= 0.2) { state.item = 1; aim(d); interrupted = true; }   // interrupt mid-flight
        const v = Math.max(Math.abs(d.head.y.x - before[0]), Math.abs(d.tail.y.x - before[1]));
        if (interrupted) vmax_after = Math.max(vmax_after, v); else vmax_before = Math.max(vmax_before, v);
        conserve(d); worst = Math.max(worst, Math.abs(area(d) / a0 - 1));
      }
      snap(d); draw();
      const v = `${lang === 'zh' ? '面积最大偏差' : 'max area change'} ${(worst * 100).toFixed(1)}%; ${lang === 'zh' ? '打断前后最快' : 'fastest before / after the interruption'} ${vmax_before.toFixed(1)} / ${vmax_after.toFixed(1)} px/${lang === 'zh' ? '帧' : 'frame'}`;
      return { pass: worst < 0.08 && vmax_after <= vmax_before * 1.05, value: v };
    },
  };
}
function drop_cpu(p, H, T, a) {
  const box = (p, c, b, r) => { const q = [Math.abs(p[0] - c[0]) - b[0] + r, Math.abs(p[1] - c[1]) - b[1] + r]; return Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0)) + Math.min(Math.max(q[0], q[1]), 0) - r; };
  const smin = (a, b, k) => { const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
  const seg = (p, a, b) => { const pa = [p[0] - a[0], p[1] - a[1]], ba = [b[0] - a[0], b[1] - a[1]], h = Math.min(1, Math.max(0, (pa[0] * ba[0] + pa[1] * ba[1]) / Math.max(ba[0] * ba[0] + ba[1] * ba[1], 1e-6))); return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h); };
  const d = Math.hypot(H[0] - T[0], H[1] - T[1]), hh = Math.min(H[3], T[3]), thin = 1 / Math.sqrt(1 + d / (2.2 * hh));
  const bh = [H[2], H[3] * (0.62 + 0.38 * thin)], bt = [T[2] * (0.7 + 0.3 * thin), T[3] * (0.55 + 0.45 * thin)];
  const s = smin(box(p, H, [bh[0] * a, bh[1] * a], Math.min(bh[0], bh[1]) * a), box(p, T, [bt[0] * a, bt[1] * a], Math.min(bt[0], bt[1]) * a), hh * 0.9);
  return smin(s, seg(p, H, T) - hh * thin * thin * 0.75 * a, hh * 0.6);
}
