// A matrix as a grid. A, B and their product C = AB are laid out the way the product is computed: A to the left of C,
// B above it, so every cell of C has its row of A to its left and its column of B above. Each cell is tinted by its
// value: one pigment for positive, another for negative, deeper for larger, so the grid can be read at a glance. Touch
// a cell of C and its row and column light up, with the sum written out; drag a number in A or B up or down to change it.
// As a building block: grid(M, { scale, product }).
import { scheduler, Spring, C, canvas2d } from '../lib/ui.js';
import { num, text, sym, drags } from '../lib/plot.js';

export const meta = {
  id: 'matrix',
  name: { zh: '矩阵格', en: 'A matrix as a grid' },
  means: { zh: 'A、B 和它们的积 C = AB 按乘法的算法摆放：A 在 C 左边，B 在 C 上面，所以 C 的每一格左边是它那一行、上面是它那一列。每格按数值着色：正数一种颜料、负数另一种，越大越深，一眼能读。碰 C 的一格，它的那一行和那一列亮起来，下面写出求和；上下拖动 A 或 B 里的数可以改它。', en: 'A, B and C = AB laid out as the product is computed: A left of C, B above it, so each cell of C has its row to the left and its column above. Cells are tinted by value, one pigment for positive, another for negative, deeper for larger. Touch a cell of C and its row and column light up with the sum written out; drag a number in A or B to change it.' },
  test: { zh: 'C 的每一格都等于那一行乘那一列（误差 < 10⁻¹²）；颜色越大越深（亮度随 |值| 单调变暗），正负对称；最深的格子里文字对比度 ≥ 4.5 : 1', en: 'Every cell of C equals its row times its column (to 10⁻¹²); tints darken monotonically with |value|, symmetric in sign; text on the deepest cell has contrast ≥ 4.5 : 1' },
  wide: true,
  aspect: '16 / 8.5',
};

const PAPER = [251, 250, 247], POS = [47, 91, 210], NEG = [200, 134, 26], VMAX = 9;
// the tint of a value: toward cobalt when positive, toward ochre when negative, at most 45% of the way so ink stays legible
const tint_of = (v) => { const t = Math.min(1, Math.abs(v) / VMAX) * 0.45, q = v >= 0 ? POS : NEG; return PAPER.map((p, i) => Math.round(p + (q[i] - p) * t)); };
const lum = (c) => { const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)));

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { A: [[1, 2], [0, -1], [3, 1]], B: [[2, -1, 0, 1], [1, 3, -2, 0.5]], sel: [0, 1] };
  const glow = new Spring(1, 0.3, 0.9);
  const geo = () => { const { W, H } = cv, c = Math.min(72, (H - 120) / 5.4, (W - 120) / 7.6), x0 = W / 2 - c * 3.1, y0 = 40 + (H - 120 - c * 5.4) / 2; return { c, A: [x0, y0 + 2.4 * c], B: [x0 + 2.4 * c, y0], C: [x0 + 2.4 * c, y0 + 2.4 * c] }; };

  function cell(x, y, c, v, hi) {
    const col = tint_of(v);
    g.fillStyle = `rgb(${col.join(',')})`; g.fillRect(x + 1.5, y + 1.5, c - 3, c - 3);
    if (hi) { g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(x + 1.5, y + 1.5, c - 3, c - 3); }
    text(g, num(v, Number.isInteger(v) ? 0 : 1), x + c / 2, y + c / 2 + 5, { size: Math.min(16, c * 0.32), weight: 600, tabular: true, align: 'center', color: C.ink });
  }
  function draw() {
    const { W, H } = cv, G = geo(), c = G.c, Cm = mul(S.A, S.B), [i, j] = S.sel;
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the row of A and the column of B that make the touched cell, as two soft bands
    g.fillStyle = `rgba(26,27,31,${0.05 * glow.x})`;
    g.fillRect(G.A[0] - 4, G.A[1] + i * c - 2, 2 * c + 8 + 0.4 * c + 4 * c, c + 4);
    g.fillRect(G.B[0] + j * c - 2, G.B[1] - 4, c + 4, 2 * c + 8 + 0.4 * c + 3 * c);
    S.A.forEach((row, r) => row.forEach((v, k) => cell(G.A[0] + k * c, G.A[1] + r * c, c, v, r === i)));
    S.B.forEach((row, r) => row.forEach((v, k) => cell(G.B[0] + k * c, G.B[1] + r * c, c, v, k === j)));
    Cm.forEach((row, r) => row.forEach((v, k) => cell(G.C[0] + k * c, G.C[1] + r * c, c, v, r === i && k === j)));
    // names
    sym(g, 'A', G.A[0] - 24, G.A[1] + 1.5 * c + 6, { size: 19 }); sym(g, 'B', G.B[0] - 24, G.B[1] + c + 6, { size: 19 }); sym(g, 'C', G.C[0] + 4 * c + 12, G.C[1] + 1.5 * c + 6, { size: 19 });
    // the sum for the touched cell, written out under the grid
    const terms = S.A[i].map((a, k) => `${num(a, Number.isInteger(a) ? 0 : 1)}·${num(S.B[k][j], Number.isInteger(S.B[k][j]) ? 0 : 1)}`).join(' + ');
    const v = Cm[i][j], y = G.C[1] + 3 * c + 34;
    let tx = G.A[0];
    tx += sym(g, 'c', tx, y, { size: 18 }); tx += text(g, `${i + 1}${j + 1}`, tx + 1, y + 5, { size: 11, tabular: true }) + 2; tx += text(g, ' = ' + terms + ' = ', tx, y, { size: 15, tabular: true });
    text(g, num(v, Number.isInteger(v) ? 0 : 1), tx, y, { size: 16, weight: 700, tabular: true, color: v >= 0 ? C.cobalt : '#8a5a0c' });
  }

  let scrub = null;
  const hold = drags(canvas, () => {
    const G = geo(), c = G.c, items = [];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) items.push({ hit: (x, y) => (x > G.C[0] + k * c && x < G.C[0] + (k + 1) * c && y > G.C[1] + r * c && y < G.C[1] + (r + 1) * c ? 1 : Infinity), down: () => { S.sel = [r, k]; glow.snap(0).to(1); } });
    // a number in A or B: drag up for more, down for less, in halves
    const num_cell = (M, r, k, x0, y0) => items.push({ hit: (x, y) => (x > x0 && x < x0 + c && y > y0 && y < y0 + c ? 2 : Infinity), down: (x, y) => { scrub = { y, v: M[r][k] }; canvas.style.cursor = 'ns-resize'; },
      move: (x, y) => { M[r][k] = Math.max(-4, Math.min(4, Math.round((scrub.v + (scrub.y - y) / 18) * 2) / 2)); }, up: () => { scrub = null; } });
    S.A.forEach((row, r) => row.forEach((_, k) => num_cell(S.A, r, k, G.A[0] + k * c, G.A[1] + r * c)));
    S.B.forEach((row, r) => row.forEach((_, k) => num_cell(S.B, r, k, G.B[0] + k * c, G.B[1] + r * c)));
    return items;
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = glow.step(dt); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      // 1. the product against a plain triple loop, on random matrices
      const rnd = (() => { let s = 41; return () => Math.round((((s = (s * 16807) % 2147483647) / 2147483647) * 8 - 4) * 2) / 2; })();
      let err = 0;
      for (let t = 0; t < 200; t++) {
        const A = [0, 1, 2].map(() => [rnd(), rnd()]), B = [0, 1].map(() => [rnd(), rnd(), rnd(), rnd()]), Cm = mul(A, B);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 2; k++) s += A[i][k] * B[k][j]; err = Math.max(err, Math.abs(s - Cm[i][j])); }
      }
      // 2. tints: darker as |v| grows, as deep for −v as for v, and ink legible on every one
      let mono = true, sym_ok = true, worst = Infinity;
      for (let v = 0.5; v <= 12; v += 0.5) {
        if (lum(tint_of(v)) > lum(tint_of(v - 0.5)) + 1e-12 || lum(tint_of(-v)) > lum(tint_of(-v + 0.5)) + 1e-12) mono = false;
        // as deep for −v (toward ochre) as for v (toward cobalt): the same share of the way from paper
        const share = (c, q) => Math.hypot(...c.map((u, i) => u - PAPER[i])) / Math.hypot(...q.map((u, i) => u - PAPER[i]));
        if (Math.abs(share(tint_of(v), POS) - share(tint_of(-v), NEG)) > 0.01) sym_ok = false;
        worst = Math.min(worst, contrast(tint_of(v), [26, 27, 31]), contrast(tint_of(-v), [26, 27, 31]));
      }
      const pass = err < 1e-12 && mono && sym_ok && worst >= 4.5;
      return { pass, value: zh ? `200 组乘积误差 ${err.toExponential(1)}；随 |值| 变深 ${mono ? '✓' : '✗'}；正负对称 ${sym_ok ? '✓' : '✗'}；最低对比度 ${worst.toFixed(1)} : 1` : `200 products, error ${err.toExponential(1)}; darker with |value| ${mono ? '✓' : '✗'}; symmetric ${sym_ok ? '✓' : '✗'}; lowest contrast ${worst.toFixed(1)} : 1` };
    },
  };
}
