// D10 · Paper layers in depth. A page is a stack of cut paper sheets: each layer's height above the page sets its
// shadow (offset and softness grow in proportion to height under the one light) and how far it moves when you tilt
// (parallax ∝ height). Tap a layer to lift it toward you; the rest stay. Depth here is a hierarchy you can feel:
// the thing being discussed is literally on top. Canvas 2D only.
// As a library primitive: z for any mobject, rendered as cut paper, so depth = importance.
import { scheduler } from '../../lib/gl.js';
import { Spring, Spring2, SANS } from '../../lib/ui.js';

export const meta = {
  id: 'layers',
  name: { zh: '纸的层次', en: 'Paper layers in depth' },
  means: { zh: '页面是一叠剪纸：越高的层影子越远越软、倾斜时移得越多。正在讲的东西就在最上面。', en: 'The page is a stack of cut paper: higher layers cast farther, softer shadows and move more when tilted. What is being discussed is on top.' },
  test: { zh: '影子偏移 ÷ 高度、视差 ÷ 高度对每一层都相同（误差 < 1%）', en: 'Shadow offset ÷ height and parallax ÷ height are the same for every layer (within 1 %)' },
};

// sheets bleed 60 px past the frame, so tilting never shows their edge
const M = 60;
const L = [
  { name: 'far', col: '#ebe7df', z: 1, path: (w, h) => wave(w, h, 0.46, 0.06, 1.6, 0.4) },
  { name: 'hill', col: '#e2ddd2', z: 2, path: (w, h) => wave(w, h, 0.56, 0.07, 2.3, 1.9) },
  { name: 'hill2', col: '#d8d2c5', z: 3, path: (w, h) => wave(w, h, 0.66, 0.05, 3.1, 0.7) },
  { name: 'river', col: '#11899e', z: 4, path: (w, h) => river(w, h) },
  { name: 'bank', col: '#cdc6b7', z: 5, path: (w, h) => wave(w, h, 0.86, 0.025, 4.3, 2.2) },
  { name: 'wall', col: '#c8861a', z: 6, path: (w, h) => { const t = Math.max(14, w * 0.038); return [[w * 0.7, h * 0.88], [w * 0.7, h * 0.36], [w * 0.7 + t, h * 0.36], [w * 0.7 + t, h * 0.88]]; } },
  { name: 'cart', col: '#2f5bd2', z: 7, path: (w, h) => { const cw = w < 560 ? w * 0.3 : Math.min(w * 0.15, h * 0.17), ch = cw * 0.42; return cart(w * 0.3, h * 0.76 - ch - cw * 0.16, cw, ch); } },
];
function wave(w, h, y0, a, f, ph) { const P = [[-M, h + M]]; for (let i = 0; i <= 120; i++) { const t = i / 120, x = -M + t * (w + 2 * M); P.push([x, h * (y0 - a * Math.sin(t * Math.PI * f + ph) - a * 0.3 * Math.sin(t * Math.PI * f * 2.7 + ph * 3))]); } P.push([w + M, h + M]); return P; }
function river(w, h) { const P = []; for (let i = 0; i <= 80; i++) { const t = i / 80, x = -M + t * (w + 2 * M); P.push([x, h * (0.78 - 0.02 * Math.sin(t * 9))]); } for (let i = 80; i >= 0; i--) { const t = i / 80, x = -M + t * (w + 2 * M); P.push([x, h * (0.88 - 0.015 * Math.sin(t * 7 + 1))]); } return P; }
// a cart cut in one piece: a rounded body with two wheels joined to it
function cart(x, y, w, h) {
  const P = [], r = Math.min(10, h * 0.25), rw = h * 0.36;
  for (const [cx, cy, a0] of [[x + w - r, y + h - r, 0]]) for (let i = 0; i <= 6; i++) { const a = (a0 + i / 12) * Math.PI; P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  for (const wx of [x + w * 0.78, x + w * 0.22]) for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI; P.push([wx + rw * Math.cos(a), y + h + rw * Math.sin(a) * 0.95]); }
  for (const [cx, cy, a0] of [[x + r, y + h - r, 0.5], [x + r, y + r, 1], [x + w - r, y + r, 1.5]]) for (let i = 0; i <= 6; i++) { const a = (a0 + i / 12) * Math.PI; P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return P;
}

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const tilt = new Spring2(0, 0, 0.5, 0.85);
  const lift = L.map(() => new Spring(0, 0.45, 0.8));
  let top = -1;
  const K = { shadow: 2.2, blur: 3.4, par: 4.5 };   // per unit of height: shadow offset, blur, parallax (px)
  function fit() { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height; }
  const height = (i) => L[i].z + lift[i].x * 4;
  const offsets = (i) => { const z = height(i); return { sx: K.shadow * z * 0.5, sy: K.shadow * z, blur: K.blur * z, px: tilt.x * K.par * z, py: tilt.y * K.par * z }; };
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#f6f4ef'); sky.addColorStop(1, '#efece5'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // drawn in order of height, so a lifted layer comes to the front
    const order = L.map((_, i) => i).sort((a, b) => height(a) - height(b));
    for (const i of order) {
      const l = L[i], o = offsets(i), P = l.path(W, H);
      const path = () => { ctx.beginPath(); P.forEach(([x, y], k) => (k ? ctx.lineTo(x + o.px, y + o.py) : ctx.moveTo(x + o.px, y + o.py))); ctx.closePath(); };
      ctx.save(); ctx.shadowColor = `rgba(26,27,31,${0.16 + 0.015 * height(i)})`; ctx.shadowBlur = o.blur; ctx.shadowOffsetX = o.sx; ctx.shadowOffsetY = o.sy; path(); ctx.fillStyle = l.col; ctx.fill(); ctx.restore();
      // the cut edge: a hairline lit on the side facing the light
      ctx.save(); path(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.translate(1, 1); path(); ctx.stroke(); ctx.restore();
      // paper fibre: a faint tooth
      if (true) { ctx.save(); path(); ctx.clip(); ctx.globalAlpha = 0.06; ctx.fillStyle = '#fff'; for (let k = 0; k < 120; k++) { const x = (k * 97.3) % W, y = (k * 41.7) % H; ctx.fillRect(x + o.px, y + o.py, 1.2, 1.2); } ctx.restore(); }
    }
    hud.innerHTML = top >= 0 ? (zh ? `抬起：${['远山', '山', '近山', '河', '岸', '墙', '卡车'][top]}` : `lifted: ${['far hills', 'hills', 'near hills', 'river', 'bank', 'wall', 'cart'][top]}`) : '';
  }
  const sched = scheduler((dt) => { let b = tilt.step(dt); for (const s of lift) b = s.step(dt) || b; draw(); return b; });
  // the pointer tilts the stack (on a phone, the device would)
  stage.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); tilt.to(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2); sched.wake(); });
  stage.addEventListener('pointerleave', () => { tilt.to(0, 0); sched.wake(); });
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const order = L.map((_, i) => i).sort((a, b) => height(b) - height(a));
    for (const i of order) { const o = offsets(i), P = L[i].path(W, H).map(([a, b]) => [a + o.px, b + o.py]); ctx.beginPath(); P.forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.setTransform(1, 0, 0, 1, 0, 0); if (ctx.isPointInPath(x * dpr / dpr, y)) { top = top === i ? -1 : i; lift.forEach((s, j) => s.to(j === top ? 1 : 0)); sched.wake(); return; } }
  });
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { top = 6; lift.forEach((s, j) => s.to(j === 6 ? 1 : 0)); tilt.to(-0.6, -0.4); sched.wake(2000); },
    async accept() {
      // the rule is linear in height for every layer: check each ratio at a tilt
      tilt.a.snap(0.7); tilt.b.snap(-0.3); let worst = 0;
      const r0 = (() => { const o = offsets(0), z = height(0); return [o.sy / z, o.px / z]; })();
      for (let i = 0; i < L.length; i++) { const o = offsets(i), z = height(i); worst = Math.max(worst, Math.abs(o.sy / z / r0[0] - 1), Math.abs(o.px / z / r0[1] - 1)); }
      tilt.a.snap(0); tilt.b.snap(0); draw();
      return { pass: worst < 0.01, value: `${zh ? '比值最大偏差' : 'largest ratio deviation'} ${(worst * 100).toFixed(3)}%` };
    },
  };
}
