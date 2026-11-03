// Probability as area. Everything that can happen is one square of area 1. A takes a slice of it, a tinted sheet;
// within A and within not-A, B takes a part, a hatched sheet laid over the first. Where the two sheets overlap (tint
// and hatching together) is “A and B”. Given B, only the B sheet is left: P(A | B) is the overlap’s share of it, pulled out on the
// right as one bar. Drag the three edges. As a building block: areas({ a, b_given_a, b_given_not_a }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { num, text, sym, tint, hatch, glass_bead, drags, brace } from '../lib/plot.js';

export const meta = {
  id: 'bayes',
  name: { zh: '概率是面积', en: 'Probability as area' },
  means: { zh: '所有可能是一个面积为 1 的方块。A 占其中一条，是一张淡色的纸；在 A 里和 A 外，B 各占一部分，是一张画着斜线的纸，叠在上面。两张纸重叠的地方（又有颜色又有斜线）就是“A 且 B”。已知 B，就只剩 B 那张纸：P(A | B) 是重叠部分在它里面所占的份额，右边把它拉出来成一根条。拖三条边。', en: 'All that can happen is one square of area 1. A takes a slice, a tinted sheet; inside A and outside it, B takes a part, a hatched sheet over the first. Where they overlap is A and B. Given B only the B sheet is left: P(A | B) is the overlap’s share of it, pulled out on the right as one bar.' },
  test: { zh: '四块面积之和恰好为 1；条上的份额 = 重叠面积 / B 的面积 = 贝叶斯公式（误差 < 10⁻¹²）；屏幕上的面积与概率成同一比例', en: 'The four areas add up to exactly 1; the bar’s share = overlap / area of B = Bayes’ formula (to 10⁻¹²); areas on screen are in the same ratio as the probabilities' },
  wide: true,
};

const posterior = (a, p, q) => (a * p) / (a * p + (1 - a) * q);

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  // a disease test: 10% have it (A); the test finds 90% of them (B | A) and wrongly flags 15% of the rest (B | not A)
  const S = { a: 0.1, p: 0.9, q: 0.15 };
  const L = { a: new Spring(0), p: new Spring(0), q: new Spring(0) };
  const box = () => { const { W, H } = cv, s = Math.min(H - 110, W * 0.5); return { x: 56, y: 62, s }; };
  // the square's regions in canvas px (B is the lower part of each column)
  function regions(T = S) {
    const B = box(), wa = B.s * T.a, top = B.y, bot = B.y + B.s;
    return { B, A: [B.x, top, wa, B.s], nA: [B.x + wa, top, B.s - wa, B.s], AB: [B.x, bot - B.s * T.p, wa, B.s * T.p], nAB: [B.x + wa, bot - B.s * T.q, B.s - wa, B.s * T.q] };
  }

  function draw() {
    const { W, H } = cv, R = regions(), B = R.B, post = posterior(S.a, S.p, S.q);
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the square of everything
    g.strokeStyle = GR(0.5); g.lineWidth = 1; g.strokeRect(B.x, B.y, B.s, B.s);
    // the A sheet, then the B sheet over it: their overlap is A and B
    const sheetB = (r) => hatch(g, () => { g.beginPath(); g.rect(...r); }, { spacing: 5, color: 'rgba(200,134,26,0.75)', width: 1 });
    g.fillStyle = 'rgba(47,91,210,0.18)'; g.fillRect(...R.A);
    sheetB(R.AB); sheetB(R.nAB);
    g.strokeStyle = C.cobalt; g.lineWidth = 1.4; g.strokeRect(...R.A);
    g.strokeStyle = C.ochre; g.lineWidth = 1.4; g.strokeRect(...R.AB); g.strokeRect(...R.nAB);
    // names and numbers at the edges that set them
    const xa = B.x + B.s * S.a;
    glass_bead(g, xa, B.y, 10, L.a.x, { dir: 0, core: C.cobalt });
    sym(g, 'A', B.x + Math.max(4, B.s * S.a / 2 - 5), B.y - 16, { size: 16, color: C.cobalt, halo: 3 });
    text(g, num(S.a, 2), xa + 14, B.y - 14, { size: 12.5, weight: 650, color: C.cobalt, tabular: true, halo: 3 });
    const yp = B.y + B.s * (1 - S.p), yq = B.y + B.s * (1 - S.q);
    glass_bead(g, B.x + B.s * S.a / 2, yp, 9, L.p.x, { dir: Math.PI / 2, core: C.ochre });
    glass_bead(g, xa + B.s * (1 - S.a) / 2, yq, 10, L.q.x, { dir: Math.PI / 2, core: C.ochre });
    sym(g, 'B', B.x + B.s + 10, B.y + B.s - 10, { size: 16, color: '#8a5a0c', halo: 3 });
    text(g, num(S.p, 2), B.x - 8, yp + 4, { size: 12.5, weight: 650, color: '#8a5a0c', tabular: true, align: 'right', halo: 3 });
    text(g, num(S.q, 2), B.x + B.s + 10, yq + 4, { size: 12.5, weight: 650, color: '#8a5a0c', tabular: true, halo: 3 });
    // given B: the B sheet alone, its two pieces side by side, and the overlap's share
    const bx = B.x + B.s + 120, bw = W - bx - 40, pAB = S.a * S.p, pnAB = (1 - S.a) * S.q, pB = pAB + pnAB, by = B.y + B.s / 2 - 22, w1 = bw * pAB / pB;
    if (bw > 120) {
      g.fillStyle = 'rgba(47,91,210,0.18)'; g.fillRect(bx, by, w1, 44);
      sheetB([bx, by, bw, 44]);
      g.strokeStyle = C.ochre; g.lineWidth = 1.4; g.strokeRect(bx, by, bw, 44); g.strokeStyle = C.cobalt; g.strokeRect(bx, by, w1, 44);
      const tip = brace(g, [bx + w1, by - 6], [bx, by - 6], C.cobalt, 10);
      let tx = tip[0] - 52; const ty = tip[1] - 12;
      tx += sym(g, 'P(A | B)', tx, ty, { size: 16, halo: 3 }); tx += text(g, ' = ', tx, ty, { size: 15, halo: 3 });
      text(g, num(post, 2), tx, ty, { size: 17, weight: 700, color: C.cobalt, tabular: true, halo: 3 });
      sym(g, 'B', bx + bw + 8, by + 27, { size: 16, color: '#8a5a0c' });
      // the whole of B is the two ochre pieces of the square, side by side
      g.strokeStyle = GR(0.35); g.setLineDash([3, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(B.x + B.s + 4, B.y + B.s - B.s * S.q / 2); g.lineTo(bx - 6, by + 22); g.stroke(); g.setLineDash([]);
    }
  }

  const hold = drags(canvas, () => {
    const B = box(), xa = B.x + B.s * S.a, yp = B.y + B.s * (1 - S.p), yq = B.y + B.s * (1 - S.q);
    const near = (x, y, px, py) => { const d = Math.hypot(x - px, y - py); return d < 22 ? d : Infinity; }, cl = (v) => Math.max(0.02, Math.min(0.98, Math.round(v * 100) / 100));
    return [
      { hit: (x, y) => near(x, y, xa, B.y), down() { L.a.to(1); }, up() { L.a.to(0); }, move: (x) => { S.a = cl((x - B.x) / B.s); } },
      { hit: (x, y) => near(x, y, B.x + B.s * S.a / 2, yp), down() { L.p.to(1); }, up() { L.p.to(0); }, move: (x, y) => { S.p = cl(1 - (y - B.y) / B.s); } },
      { hit: (x, y) => near(x, y, xa + B.s * (1 - S.a) / 2, yq), down() { L.q.to(1); }, up() { L.q.to(0); }, move: (x, y) => { S.q = cl(1 - (y - B.y) / B.s); } },
    ];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = Object.values(L).map((s) => s.step(dt)).some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      const rnd = (() => { let s = 29; return () => 0.02 + 0.96 * ((s = (s * 16807) % 2147483647) / 2147483647); })();
      let sum_err = 0, bayes_err = 0, px_err = 0;
      for (let i = 0; i < 500; i++) {
        const T = { a: rnd(), p: rnd(), q: rnd() }, a = T.a, p = T.p, q = T.q;
        const parts = [a * p, a * (1 - p), (1 - a) * q, (1 - a) * (1 - q)]; sum_err = Math.max(sum_err, Math.abs(parts.reduce((s, v) => s + v, 0) - 1));
        bayes_err = Math.max(bayes_err, Math.abs(parts[0] / (parts[0] + parts[2]) - posterior(a, p, q)));
        const R = regions(T), s2 = R.B.s * R.B.s, area = (r) => r[2] * r[3];
        px_err = Math.max(px_err, Math.abs(area(R.AB) / s2 - parts[0]), Math.abs(area(R.nAB) / s2 - parts[2]), Math.abs(area(R.A) / s2 - a));
      }
      const pass = sum_err < 1e-12 && bayes_err < 1e-12 && px_err < 1e-12;
      return { pass, value: zh ? `500 组：面积和误差 ${sum_err.toExponential(1)}；条的份额与贝叶斯公式相差 ${bayes_err.toExponential(1)}；屏幕面积比例误差 ${px_err.toExponential(1)}` : `500 cases: areas sum to 1 within ${sum_err.toExponential(1)}; the bar’s share vs Bayes ${bayes_err.toExponential(1)}; screen areas ${px_err.toExponential(1)}` };
    },
  };
}
