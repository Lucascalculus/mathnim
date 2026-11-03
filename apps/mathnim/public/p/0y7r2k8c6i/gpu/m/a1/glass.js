// A1 · Liquid glass. Controls float over the page as real glass: a bevelled slab whose edge refracts the page
// beneath it (per wavelength, so the bevel disperses), a frosted flat top that keeps labels legible, one high light
// and the hand's own light on the rim, a soft contact shadow. Glass that comes close merges, as liquid does.
// The bead is a dome, so it magnifies: hold it over the page and it is a loupe.
import { context, program, pass, scheduler, fit_canvas, clamp } from '../../lib/gl.js';
import { lesson_page, upload, Spring, Spring2 } from '../../lib/ui.js';

export const meta = {
  id: 'glass',
  name: { zh: '液态玻璃', en: 'Liquid glass' },
  means: { zh: '浮在内容上的控件是一块真玻璃：边缘折射下面的页面，靠近就融合，按住就成了放大镜。', en: 'Controls over content are real glass: the edge refracts the page beneath, nearby glass merges, and held, it is a loupe.' },
  test: { zh: '玻璃上的字对比度 ≥ 4.5:1（任何底下内容）；60 帧下单帧 GPU < 4 ms', en: 'Text on glass ≥ 4.5:1 over any content; < 4 ms GPU per frame' },
  wide: true,
};

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform sampler2D page; uniform vec2 page_px; uniform float scroll; uniform float dpr;
uniform vec4 isl; uniform float isl_r; uniform vec4 btn; uniform vec3 bead; uniform float merge; uniform vec3 hand; uniform float sheet;
float sd_box(vec2 p, vec2 c, vec2 b, float r){ vec2 q = abs(p - c) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// the union of all glass, in device pixels, y down
float sdf(vec2 p){
  float a = sd_box(p, isl.xy, isl.zw, isl_r);
  float b = sd_box(p, btn.xy, btn.zw, btn.z);
  float c = length(p - bead.xy) - bead.z;
  return smin(smin(a, c, merge), b, 2.0 * dpr);
}
vec3 page_at(vec2 p, float lod){
  vec2 q = vec2(p.x, p.y + scroll) / page_px; q.y = 1.0 - q.y;
  return to_lin(textureLod(page, q, lod).rgb);
}
float bevel(){ return 18.0 * dpr; }
// height of the glass above the page: a rounded bevel up to a flat top, plus the bead's dome
float height(vec2 p){
  float t = -sdf(p), B = bevel();
  float h = t <= 0.0 ? 0.0 : B * sqrt(1.0 - pow(1.0 - min(t / B, 1.0), 2.0));
  float r = length(p - bead.xy); float dome = bead.z * 0.8 * sqrt(max(1.0 - (r * r) / (bead.z * bead.z), 0.0));
  return max(h, dome);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  float d = sdf(p);
  vec3 col = page_at(p, 0.0);
  // the shadow the glass casts on the page: a soft key from above and a tight contact line
  float sh = smoothstep(30.0 * dpr, -10.0 * dpr, sdf(p - vec2(0, 10.0 * dpr))) * 0.10 + smoothstep(5.0 * dpr, -1.0 * dpr, sdf(p - vec2(0, 1.5 * dpr))) * 0.07;
  col *= 1.0 - sh * smoothstep(-1.0, 1.0, d);
  // a lens gathers the light it stops: a bright spot inside the bead's shadow
  vec2 bs = p - bead.xy - vec2(5.0, 12.0) * dpr; float spot = exp(-dot(bs, bs) / pow(bead.z * 0.33, 2.0));
  col *= 1.0 + 0.35 * spot * smoothstep(-1.0, 1.0, d);
  if (d < 1.0){
    vec2 e = vec2(1.0, 0.0);
    float h = height(p);
    vec2 g = vec2(height(p + e.xy) - height(p - e.xy), height(p + e.yx) - height(p - e.yx)) * 0.5;
    vec3 n = normalize(vec3(-g, 1.0));
    // refraction through the slab, six wavelengths (crown glass, Abbe ≈ 40): the bevel bends and disperses the page
    vec3 acc = vec3(0), wsum = vec3(0);
    // frost grows with depth into the slab: the bevel stays clear (it is where the light bends), the flat top is
    // frosted so its labels read over anything; the bead stays clear (it is a lens)
    float depth_in = clamp(-d / bevel(), 0.0, 1.0);
    float frost = (3.2 + 1.6 * sheet) * smoothstep(0.35, 1.0, depth_in) * (1.0 - smoothstep(bead.z * 1.1, bead.z * 0.6, length(p - bead.xy)));
    for (int i = 0; i < 6; i++){
      float lam = 430.0 + float(i) * 48.0; float eta = 1.5 + 0.0042 / pow(lam / 1000.0, 2.0) - 0.0042 / 0.3025;
      vec3 r = refract(vec3(0, 0, -1), n, 1.0 / eta);
      vec2 off = r.xy / -r.z * (h * 0.42 + 3.0 * dpr);
      vec3 w = max(xyz_to_lin_srgb(cie_xyz(lam)), 0.0);
      // frost: a few taps around the refracted point, wider on the flat top
      vec3 s = vec3(0);
      for (int k = 0; k < 5; k++){ float a = float(k) * 1.2566 + hash12(p) * 6.28; s += page_at(p + off + vec2(cos(a), sin(a)) * frost * 1.6 * dpr, frost * 1.1); }
      acc += w * s / 5.0; wsum += w;
    }
    vec3 under = acc / wsum;
    // the glass itself: a breath of white (it scatters a little light), and vibrancy keeps colours alive
    float lum = dot(under, vec3(0.2126, 0.7152, 0.0722));
    under = mix(vec3(lum), under, 1.18);
    vec3 glass = mix(under, vec3(1.0), (0.10 + 0.22 * smoothstep(0.3, 1.0, depth_in)) * (1.0 - smoothstep(bead.z * 1.1, bead.z * 0.6, length(p - bead.xy))) + 0.30 * sheet * smoothstep(0.3, 1.0, depth_in));
    // one high light on the upper left, and the hand's own light from where the pointer hovers
    vec3 L = normalize(vec3(-0.45, -0.75, 0.55));
    vec3 H = normalize(L + vec3(0, 0, 1));
    float spec = pow(max(dot(n, H), 0.0), 90.0) * 0.9;
    vec3 Lh = normalize(vec3(hand.xy - p, 140.0 * dpr)); vec3 Hh = normalize(Lh + vec3(0, 0, 1));
    float spec_h = pow(max(dot(n, Hh), 0.0), 160.0) * 1.4 * hand.z;
    float rim = pow(1.0 - n.z, 2.0);
    glass += vec3(1.0) * (spec + spec_h) + vec3(1.0) * rim * 0.35;
    // the far side of the bevel, away from the light, is a touch darker (the glass is thick)
    glass *= 1.0 - 0.10 * smoothstep(0.0, 0.6, dot(-n.xy, normalize(-L.xy))) * rim * 4.0;
    // a hairline at the edge so glass on white still has a boundary
    float edge = smoothstep(-1.4 * dpr, -0.2 * dpr, d) * smoothstep(0.8, -0.2, d);
    glass = mix(glass, to_lin(vec3(0.62, 0.63, 0.66)), edge * 0.5);
    col = mix(col, glass, smoothstep(0.75, -0.75, d));
  }
  o = vec4(to_srgb(col), 1.0);
}`;

const CSS = `
.g-ui{position:absolute;inset:0;pointer-events:none;font-family:var(--sans);color:var(--ink)}
.g-isl{position:absolute;display:flex;align-items:center;gap:12px;padding:0 6px 0 20px;height:56px;white-space:nowrap}
.g-isl .ask{font-size:17px;font-weight:600}
.g-isl .ticks{display:flex;gap:7px;align-items:flex-end;height:18px}
.g-isl .ticks i{width:1.5px;height:10px;background:rgba(26,27,31,.42);border-radius:1px}
.g-isl .ticks i.on{height:16px;background:var(--ink);width:2px}
.g-isl .ticks i.done{background:rgba(26,27,31,.75)}
.g-isl .n{font-size:14px;color:var(--ink-2);font-variant-numeric:tabular-nums}
.g-isl .go{height:44px;padding:0 18px;border-radius:22px;background:var(--vermilion);color:#fff;font-size:15px;font-weight:600;display:flex;align-items:center}
.g-sheet{position:absolute;padding:22px 24px;opacity:0;font-size:15px;line-height:1.6;color:var(--ink-2)}
.g-sheet h3{margin:0 0 8px;font-size:17px;color:var(--ink);font-weight:600}
.g-sheet p{margin:0;font-family:var(--serif);font-size:16px;color:var(--ink);line-height:1.75}
.g-btn{position:absolute;display:grid;place-items:center}
.g-btn svg{width:20px;height:20px}
`;

export function make({ stage, canvas, hud, lang }) {
  if (!document.getElementById('g-css')) { const st = document.createElement('style'); st.id = 'g-css'; st.textContent = CSS; document.head.append(st); }
  const gl = context(canvas), prog = program(gl, FS);
  fit_canvas(canvas, 2);
  let dpr = canvas.width / canvas.getBoundingClientRect().width;
  let W = canvas.width, H = canvas.height;
  let page = null, page_px = [0, 0];
  const build_page = () => { const cv = lesson_page(W, Math.round(H * 3.2), lang, { scale: dpr, center: true }); page = upload(gl, cv); page_px = [cv.width, cv.height]; };
  build_page();
  // the UI layer: labels are DOM over the glass, so they stay crisp and selectable
  const ui = document.createElement('div'); ui.className = 'g-ui';
  ui.innerHTML = `<div class="g-isl"><span class="ask">${lang === 'zh' ? '问' : 'Ask'}</span><span class="ticks">${Array.from({ length: 9 }, (_, i) => `<i class="${i < 3 ? 'done' : i === 3 ? 'on' : ''}"></i>`).join('')}</span><span class="n">4 / 9</span><span class="go">${lang === 'zh' ? '继续' : 'Next'}</span></div>
    <div class="g-sheet"><h3>${lang === 'zh' ? '为什么只有这道墙算“起作用”？' : 'Why does only this wall count as active?'}</h3><p>${lang === 'zh' ? '因为球正靠在它上面。再往外一点就撞墙；往里退一点就得上坡，代价变大。只有它在“顶住”球，所以它的乘子 λ 大于零。' : 'Because the ball rests against it. A little further and it hits the wall; a little back and it climbs, so the cost rises. Only this wall holds the ball, so its multiplier λ is positive.'}</p></div>
    <div class="g-btn"><svg viewBox="0 0 20 20" fill="none" stroke="#1a1b1f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg></div>`;
  stage.append(ui);
  const el_isl = ui.querySelector('.g-isl'), el_sheet = ui.querySelector('.g-sheet'), el_btn = ui.querySelector('.g-btn');
  // the island's geometry and the bead live on springs (CSS px)
  const css = () => [canvas.width / dpr, canvas.height / dpr];
  const S = {
    w: new Spring(150, 0.5, 0.78), h: new Spring(28, 0.5, 0.78), y: new Spring(0, 0.5, 0.8), sheet: new Spring(0, 0.45, 1),
    bead: new Spring2(0, 0, 0.32, 0.72), hand: new Spring(0, 0.25, 1), scroll: 0, vscroll: 0, open: false, tuck: new Spring(0, 0.4, 1),
  };
  const layout = () => {
    const [w, h] = css(), iw = el_isl.offsetWidth || 300;
    const closed = { w: iw / 2, h: 28, y: h - 46 }, open = { w: Math.min(w - 48, 520) / 2, h: Math.min(h * 0.62, 260) / 2 };
    open.y = h - 22 - open.h;
    return { closed, open };
  };
  let G = layout();
  S.w.snap(G.closed.w); S.h.snap(G.closed.h); S.y.snap(G.closed.y);
  { const [w, h] = css(); S.bead.a.snap(w * 0.3); S.bead.b.snap(h * 0.42); }
  let hand = [0, 0];
  function draw() {
    const [w, h] = css();
    const tuck = S.tuck.x, cy = S.y.x + tuck * 10;
    const isl = [w / 2 * dpr, cy * dpr, S.w.x * (1 - 0.06 * tuck) * dpr, S.h.x * (1 - 0.06 * tuck) * dpr];
    const btn = [36 * dpr, 36 * dpr, 22 * dpr, 22 * dpr];
    pass(gl, prog, { res: [canvas.width, canvas.height], page, page_px, scroll: S.scroll * dpr, dpr, isl, isl_r: Math.min(isl[2], isl[3], 28 * dpr), btn, bead: [S.bead.x * dpr, S.bead.y * dpr, 30 * dpr], merge: 26 * dpr, hand: [hand[0] * dpr, hand[1] * dpr, S.hand.x], sheet: S.sheet.x });
    el_isl.style.transform = `translate(${w / 2 - el_isl.offsetWidth / 2}px, ${cy - 28}px) scale(${1 - 0.06 * tuck})`;
    el_isl.style.opacity = String(1 - S.sheet.x * 1.6);
    el_sheet.style.width = `${S.w.x * 2}px`; el_sheet.style.transform = `translate(${w / 2 - S.w.x}px, ${S.y.x - S.h.x}px)`;
    el_sheet.style.opacity = String(Math.max(0, S.sheet.x * 1.4 - 0.4));
    el_btn.style.cssText = `left:14px;top:14px;width:44px;height:44px`;
  }
  const sched = scheduler((dt) => {
    let b = false;
    for (const s of [S.w, S.h, S.y, S.sheet, S.hand, S.tuck]) b = s.step(dt) || b;
    b = S.bead.step(dt) || b;
    // scrolling glides and the island tucks while it does
    if (Math.abs(S.vscroll) > 0.5) { S.scroll = clamp(S.scroll + S.vscroll * dt, 0, page_px[1] / dpr - css()[1]); S.vscroll *= Math.pow(0.04, dt); b = true; } else S.vscroll = 0;
    S.tuck.to(Math.abs(S.vscroll) > 40 ? 1 : 0);
    draw(); return b;
  });
  // input: drag the bead, tap the island, drag anywhere else to scroll
  let mode = null, last = null, t_down = 0;
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  stage.addEventListener('pointerdown', (e) => {
    const [x, y] = at(e), [w] = css(); t_down = performance.now(); last = [x, y, performance.now()];
    stage.setPointerCapture(e.pointerId);
    if (Math.hypot(x - S.bead.x, y - S.bead.y) < 40) mode = 'bead';
    else if (Math.abs(x - w / 2) < S.w.x + 6 && Math.abs(y - S.y.x) < S.h.x + 6) mode = 'island';
    else { mode = 'scroll'; S.vscroll = 0; }
    hand = [x, y]; S.hand.to(1); sched.wake();
  });
  stage.addEventListener('pointermove', (e) => {
    const [x, y] = at(e); hand = [x, y]; if (e.pointerType === 'mouse') S.hand.to(mode ? 1 : 0.6);
    if (mode === 'bead') S.bead.to(x, y);
    if (mode === 'scroll' && last) { const dy = y - last[1], dtm = Math.max(1, performance.now() - last[2]); S.scroll = clamp(S.scroll - dy, 0, page_px[1] / dpr - css()[1]); S.vscroll = -dy / dtm * 1000; S.tuck.to(Math.abs(dy) > 1 ? 1 : 0); }
    last = [x, y, performance.now()]; sched.wake();
  });
  stage.addEventListener('pointerup', () => {
    if (mode === 'island' && performance.now() - t_down < 400) toggle();
    if (mode === 'scroll' && Math.abs(S.vscroll) < 30) S.vscroll = 0;
    mode = null; S.hand.to(0); sched.wake(2000);
  });
  stage.addEventListener('pointerleave', () => { S.hand.to(0); sched.wake(); });
  stage.addEventListener('wheel', (e) => { e.preventDefault(); S.scroll = clamp(S.scroll + e.deltaY, 0, page_px[1] / dpr - css()[1]); S.tuck.to(1); setTimeout(() => S.tuck.to(0), 260); sched.wake(); }, { passive: false });
  function toggle() {
    S.open = !S.open; G = layout(); const g = S.open ? G.open : G.closed;
    S.w.to(g.w); S.h.to(g.h); S.y.to(g.y); S.sheet.to(S.open ? 1 : 0); sched.wake(2000);
  }
  draw();
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { fit_canvas(canvas, 2); dpr = canvas.width / canvas.getBoundingClientRect().width; W = canvas.width; H = canvas.height; build_page(); G = layout(); const g = S.open ? G.open : G.closed; S.w.snap(g.w); S.h.snap(g.h); S.y.snap(g.y); draw(); },
    demo() { const [w, h] = css(); S.bead.to(w * 0.56, h * 0.36); S.scroll = 0; sched.wake(2500); },
    toggle,
    async accept() {
      // the label's contrast against the glass it sits on, over the page scrolled through its whole length
      let worst = 99; const [w, h] = css();
      const saved = S.scroll;
      for (let s = 0; s < page_px[1] / dpr - h; s += 90) {
        S.scroll = s; draw();
        const px = new Uint8Array(4 * 9), cx = Math.round((w / 2) * dpr), cy = Math.round((h - S.y.x) * dpr);
        gl.readPixels(cx - Math.round(60 * dpr), cy, 9, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (let i = 0; i < 9; i++) { const L = rel(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); worst = Math.min(worst, (L + 0.05) / (rel(26, 27, 31) + 0.05)); }
      }
      S.scroll = saved;
      // GPU time of one frame
      const t0 = performance.now(); for (let i = 0; i < 20; i++) draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); const ms = (performance.now() - t0) / 20;
      return { pass: worst >= 4.5, value: `${lang === 'zh' ? '最差对比度' : 'worst contrast'} ${worst.toFixed(1)}:1; ${ms.toFixed(1)} ms/${lang === 'zh' ? '帧（软件渲染）' : 'frame (software GL)'}` };
    },
  };
}
const rel = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
