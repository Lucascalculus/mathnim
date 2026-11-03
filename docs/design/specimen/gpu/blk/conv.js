// An array and a sliding window. A row of numbers, and a window of three weights that slides along it; at each place
// the three numbers under the window are multiplied by the weights and added, and the sum drops into the row below,
// right under the window’s middle. Slide the window and the output fills in; choose the weights: [1 2 1]/4 smooths the
// row, [−1 0 1] answers only where it changes. (The weights are applied as they stand, unflipped: the sliding window of
// signal processing’s correlation and of a neural network’s “convolution”.) As a building block: window(array, kernel, { at }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { num, text, glass_bead, drags, choice_row } from '../lib/plot.js';

export const meta = {
  id: 'conv',
  name: { zh: '数组与滑动窗口', en: 'An array and a sliding window' },
  means: { zh: '一排数，和一个装着三个权重的窗口沿着它滑；每到一处，窗口下的三个数乘上权重再相加，和落到下一排、正对窗口中间的位置。滑动窗口，输出一格格填出来；换权重：[1 2 1]/4 把这排数抹平，[−1 0 1] 只在数变化的地方有反应。', en: 'A row of numbers and a window of three weights sliding along it; at each place the three numbers under it are weighted and added, and the sum drops into the row below, under the window’s middle. Slide it and the output fills in; [1 2 1]/4 smooths, [−1 0 1] answers only where the row changes.' },
  test: { zh: '两种权重下，每个输出格都等于逐项相乘再相加算出的值（误差 < 10⁻¹²）；输出格的中心正对窗口中间那格的中心；写出来的求和等于那一格的值', en: 'For both kernels every output equals the weighted sum computed term by term (to 10⁻¹²); each output cell is centred under the window’s middle cell; the written sum equals that cell' },
  wide: true,
  aspect: '16 / 6.5',
};

const SIG = [1, 1, 2, 1, 1, 6, 7, 6, 7, 6, 2, 2, 1, 2, 8, 8, 8, 2, 1, 1];
const KERNELS = [{ k: [1, 2, 1], div: 4, zh: '抹平', en: 'smooth' }, { k: [-1, 0, 1], div: 1, zh: '找变化', en: 'change' }];
const out_at = (K, i) => (K.k[0] * SIG[i - 1] + K.k[1] * SIG[i] + K.k[2] * SIG[i + 1]) / K.div;   // i = the window's middle

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { k: 0, at: new Spring(5, 0.35, 0.9), seen: 6 };
  const lift = new Spring(0);
  let rows = [];
  const geo = () => { const { W, H } = cv, n = SIG.length, c = Math.min(46, (W - 60) / n); return { c, x0: W / 2 - c * n / 2, ys: H * 0.36, yo: H * 0.36 + c * 2.6 }; };
  const shade = (v, max) => { const t = Math.max(0, Math.min(1, Math.abs(v) / max)) * 0.42, q = v >= 0 ? [47, 91, 210] : [200, 134, 26]; return `rgb(${[251, 250, 247].map((p, i) => Math.round(p + (q[i] - p) * t)).join(',')})`; };

  function draw() {
    const { W, H } = cv, G = geo(), c = G.c, K = KERNELS[S.k], m = Math.round(S.at.x), mx = G.x0 + (S.at.x + 0.5) * c;
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the input row
    SIG.forEach((v, i) => { const x = G.x0 + i * c; g.fillStyle = shade(v, 8); g.fillRect(x + 1, G.ys + 1, c - 2, c - 2); text(g, String(v), x + c / 2, G.ys + c / 2 + 5, { size: Math.min(15, c * 0.36), weight: 600, tabular: true, align: 'center' }); });
    // the output row: filled where the window has been
    for (let i = 1; i < SIG.length - 1; i++) {
      const x = G.x0 + i * c, done = i <= S.seen;
      g.strokeStyle = GR(0.22); g.lineWidth = 0.8; g.strokeRect(x + 1, G.yo + 1, c - 2, c - 2);
      if (done) { const v = out_at(K, i); g.fillStyle = shade(v, K.div === 4 ? 8 : 6); g.fillRect(x + 1.5, G.yo + 1.5, c - 3, c - 3); text(g, num(v, Number.isInteger(v) ? 0 : 1), x + c / 2, G.yo + c / 2 + 5, { size: Math.min(14, c * 0.32), weight: 600, tabular: true, align: 'center' }); }
    }
    // the window: a glass frame over three cells, its weights above, the funnel down to its output
    const wx = mx - 1.5 * c;
    g.strokeStyle = GR(0.35); g.lineWidth = 1;
    for (let d = -1; d <= 1; d++) { g.beginPath(); g.moveTo(mx + d * c, G.ys + c + 2); g.lineTo(mx, G.yo - 2); g.stroke(); }
    g.save(); g.shadowColor = GR(0.22 + 0.1 * lift.x); g.shadowBlur = (8 + 6 * lift.x) * cv.dpr; g.shadowOffsetY = (3 + 2 * lift.x) * cv.dpr;
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 5; g.strokeRect(wx - 2, G.ys - 2, 3 * c + 4, c + 4); g.restore();
    g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(wx - 2, G.ys - 2, 3 * c + 4, c + 4);
    K.k.forEach((w, d) => text(g, (w > 0 && K.div === 1 ? '+' : '') + num(w, 0), wx + (d + 0.5) * c, G.ys - 10, { size: 13, weight: 650, tabular: true, align: 'center', color: C.teal }));
    if (K.div !== 1) text(g, '÷ ' + K.div, wx + 3 * c + 12, G.ys - 10, { size: 13, weight: 650, color: C.teal });
    glass_bead(g, mx, G.ys + c + 18, 10, lift.x, { dir: 0 });
    // the sum for this place, written out
    const v = out_at(K, m), terms = K.k.map((w, d) => `${num(w, 0)}·${SIG[m - 1 + d]}`).join(' + ');
    text(g, terms + (K.div !== 1 ? `  ÷ ${K.div}` : '') + '  =  ' + num(v, Number.isInteger(v) ? 0 : 2), W / 2, G.yo + c + 40, { size: 15, tabular: true, align: 'center', color: C.ink });
    rows = choice_row(g, KERNELS.map((k) => ({ text: zh ? k.zh : k.en })), S.k, 22, 38);
  }

  const hold = drags(canvas, () => {
    const G = geo(), c = G.c, mx = G.x0 + (S.at.x + 0.5) * c, items = [];
    for (const r of rows) items.push({ hit: (x, y) => (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1 ? 0 : Infinity), down: () => { S.k = r.i; } });
    items.push({ hit: (x, y) => (Math.abs(x - mx) < 1.6 * c && y > G.ys - 8 && y < G.ys + c + 32 ? 1 : Infinity), down() { lift.to(1); }, up() { lift.to(0); S.at.to(Math.round(S.at.x)); },
      move: (x) => { const i = Math.max(1, Math.min(SIG.length - 2, (x - G.x0) / c - 0.5)); S.at.snap(i); S.seen = Math.max(S.seen, Math.round(i)); } });
    return items;
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [S.at.step(dt), lift.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { S.seen = SIG.length - 2; S.at.to(SIG.length - 2); sched.wake(2000); },
    async accept() {
      let err = 0, align = 0, sum_err = 0;
      for (const K of KERNELS) for (let i = 1; i < SIG.length - 1; i++) {
        // the textbook form: Σ_j k_j · s_{i + j − 1}, written as a separate loop
        let s = 0; for (let j = 0; j < 3; j++) s += K.k[j] * SIG[i + j - 1]; s /= K.div;
        err = Math.max(err, Math.abs(s - out_at(K, i)));
        const G = geo(), mid_in = G.x0 + (i + 0.5) * G.c, mid_out = G.x0 + i * G.c + G.c / 2; align = Math.max(align, Math.abs(mid_in - mid_out));
        const parts = K.k.map((w, d) => w * SIG[i - 1 + d]); sum_err = Math.max(sum_err, Math.abs(parts.reduce((a, b) => a + b, 0) / K.div - out_at(K, i)));
      }
      const pass = err < 1e-12 && align < 1e-9 && sum_err < 1e-12;
      return { pass, value: zh ? `加权和误差 ${err.toExponential(1)}；输出格与窗口中间对齐误差 ${align.toExponential(1)} px；求和 ${sum_err < 1e-12 ? '✓' : '✗'}` : `weighted-sum error ${err.toExponential(1)}; output under the window’s middle within ${align.toExponential(1)} px; sums ${sum_err < 1e-12 ? '✓' : '✗'}` };
    },
  };
}
