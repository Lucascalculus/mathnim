// The tangent, developed: the secant through P and a second point Q, as Q comes in by halving h. Each secant passed is
// left on the paper in transparent ink (the engine's Cases), so the early ones scatter into a pale fan and the late ones
// fall on each other; where they all agree the ink is deepest, and that is the tangent. Q is hollow (it is only an
// approximation), the secant through it dashed; at the end the tangent itself converges from dashed to solid (the
// engine's certainty), and the readout's name turns from Δy/Δx to f′. Nobody draws the tangent: it develops.
import { Cases, Figure, Gap, Marker, Path, beat, column, derive, guess, parse_expr, reveal, row, set, t, timer, together, wait, type Readable, type XY } from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../ft/f/kit';

export interface TangentDevelopParams extends Record<string, unknown> {
  fn: string;
  x0: number;
  predict: boolean;
  lang: string;
}

const DEFAULT_FN = '0.15x^3 - 0.9x + 0.6';
const COUNT = 44;

export function tangent_develop_figure(p: Partial<TangentDevelopParams> = {}): Figure {
  const lang = figure_lang(p.lang);
  const L = (en: string, zh: string) => (lang === 'zh' ? zh : en);
  let fn = (p.fn ?? DEFAULT_FN).trim(), f: (x: number) => number;
  try {
    const e = parse_expr(fn);
    if ([...e.vars].some((v) => v !== 'x')) throw new Error('only x');
    f = (x) => e.f({ x });
  } catch {
    fn = DEFAULT_FN;
    const e = parse_expr(fn);
    f = (x) => e.f({ x });
  }
  const x0 = p.x0 ?? -2, h0 = 2;
  const fp = (x: number) => (f(x + 1e-6) - f(x - 1e-6)) / 2e-6;
  const level = (j: number) => h0 * 2 ** (-j / 4);
  // the window: the point and two units either side; the height of the curve there, with room
  const a = Math.floor(x0 - 2.6), b = Math.ceil(x0 + h0 + 1.2);
  const XS = Array.from({ length: 201 }, (_, i) => a + ((b - a) * i) / 200);
  const ys = XS.map(f).filter(Number.isFinite), lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.12 + 0.3;
  const fig = new Figure({ lang });
  // (played: the script develops the fan; predict: letting go of the guess does, on a timer)
  const n_p = fig.param('n', 0, { range: [0, COUNT] }), k_p = fig.param('k', 0, { range: [0, 1] });
  const tm = p.predict ? timer(fig, 'develop', 5) : null;
  const ease = (u: number) => u * u * (3 - 2 * u);
  const n: Readable<number> = tm ? derive(() => COUNT * ease(Math.min(1, tm.t.value / 0.72)), 'n') : n_p;
  const k: Readable<number> = tm ? derive(() => ease(Math.max(0, Math.min(1, (tm.t.value - 0.76) / 0.2))), 'k') : k_p;
  const h = derive(() => level(n.value));
  const P = fig.plot({ id: 'graph', x: [a, b], y: [lo - pad, hi + pad], axes: 'origin', x_label: 'x', y_label: 'y', priority: 2 });
  const line = (m: number): XY[] => [[a, f(x0) + m * (a - x0)], [b, f(x0) + m * (b - x0)]];
  const slope = (hh: number) => (f(x0 + hh) - f(x0)) / hh;
  const curve = P.add(new Path(XS.map((u): XY => [u, f(u)]), { id: 'curve', role: 'noun:function' }));
  const fan = P.add(new Cases((j) => line(slope(level(j))), { id: 'secants', role: 'noun:value', count: COUNT, upto: n }));
  // (predict: no separate secant - the fan's last case, fading in, is the one on its way)
  const secant = P.add(new Path(() => (tm ? [] : line(slope(h.value))), { id: 'secant', role: 'noun:value', certain: 0.15 }));
  // (predict: the tangent is not there until it develops - a dashed tangent before the guess would give it away)
  const tangent = P.add(new Path(tm ? () => (k.value > 1e-3 ? line(fp(x0)) : []) : line(fp(x0)), { id: 'tangent', role: 'noun:value', width: 2.6, certain: k }));
  // (predict: Q comes in only once the guess is made: the secants are the answer's own story)
  const q = P.add(new Marker(() => (tm && tm.t.value <= 0 ? null : [x0 + h.value, f(x0 + h.value)]), { id: 'q', role: 'noun:value', certain: 0 }));
  // (predict: before the guess is made the readout is the slope being guessed)
  let asked: { committed: Readable<number>; guessed: Readable<number> } | null = null;
  const guessing = () => !!asked && !asked.committed.value;
  const pt = P.add(new Marker([x0, f(x0)], { id: 'p', role: 'noun:function' }));
  const exact = derive(() => k.value > 0.5);
  const ro = fig.readout([
    { tex: () => (guessing() ? 'm =' : exact.value ? "f'(x_0) =" : '\\dfrac{\\Delta y}{\\Delta x} =') },
    { value: () => (guessing() ? asked!.guessed.value : exact.value ? fp(x0) : slope(h.value)), decimals: 2, template: '−00.00' },
  ], { id: 'slope', role: 'noun:value', kind: 'display' });
  fig.layout(row([P, column([ro])], { weights: [3, 1], align: 'center' }), { phone: column([ro, P]) });
  if (tm) {
    // predict first: the learner tilts a hollow line through P to the slope they expect; letting go develops the fan,
    // the tangent turns solid, and the gap between the two lines, where the hand held the guess, is said
    const y0 = f(x0), truth = fp(x0), tol = 0.08 * Math.max(1, Math.abs(truth));
    // (the hand holds the line where the true tangent is still inside the plot, so the gap there can be drawn; the
    // guess is kept inside it too)
    const ylo = lo - pad, yhi = hi + pad, H = yhi - ylo, room = truth > 0 ? yhi - y0 : y0 - ylo;
    const dx = Math.max(0.4, Math.min(1.4, b - 0.4 - x0, (0.8 * room) / Math.max(1e-6, Math.abs(truth)))), hx = x0 + dx;
    const m0 = Math.abs(truth) > 0.5 ? 0 : truth + 1.2;
    const m = fig.param('m', m0, { range: [-12, 12], doc: 'the guessed slope' });
    const g = guess(fig, P, m, {
      id: 'slope_guess', role: 'guess:value', at: (v) => [hx, y0 + v * (hx - x0)], to: (d) => (Math.max(ylo + 0.05 * H, Math.min(yhi - 0.05 * H, d[1])) - y0) / dx, truth, tolerance: tol,
      says: t('your guess of the tangent: tilt it, let go to see', '你猜的切线：转动它，松手看答案'),
    });
    asked = { committed: g.committed, guessed: g.guessed };
    const guessed = P.add(new Path(() => line(g.guessed.value), { id: 'guessed', role: 'guess:value', certain: 0, says: t('your guess of the tangent', '你猜的切线') }));
    g.on_commit(() => tm.play());
    const gap = P.add(new Gap(() => [hx, y0 + g.guessed.value * (hx - x0)], () => [hx, y0 + truth * (hx - x0)], {
      id: 'gap', role: 'noun:value', shown: k,
      text: () => (g.right.value ? L('right', '对了') : L(`slope off by ${Math.abs(g.error.value).toFixed(2)}`, `斜率差 ${Math.abs(g.error.value).toFixed(2)}`)),
      says: t('how far the guessed slope was from the tangent', '猜的斜率和切线差多少'),
    }));
    fig.script(g.fresh(tm.sim.clock, tm.sim.running), reveal(P, curve, pt, q, fan, tangent, guessed, g.ring, gap, ro), wait(0.8));
    return fig;
  }
  fig.script(
    reveal(P, curve, pt, q, secant),
    wait(0.8),
    beat(), set(n_p, COUNT, 'linear', 3.6),
    beat(), together(set(k_p, 1, 'converge', 1.1), reveal(tangent)), wait(1.2),
  );
  fig.check('the fan closes onto the tangent: the last secant is within a pixel of it across the plot', () => {
    const m = slope(level(COUNT - 1)), dy = Math.abs(m - fp(x0)) * Math.max(Math.abs(a - x0), Math.abs(b - x0)) * (P.P([0, 1])[1] - P.P([0, 0])[1]);
    return Math.abs(dy) < 1 ? null : `the last secant is ${Math.abs(dy).toFixed(1)} px off the tangent`;
  });
  return fig;
}

export const tangent_develop = define_figure<TangentDevelopParams>({
  name: 'tangent_develop',
  summary: 'The tangent as the limit of secants: Q comes in to P by halving h, each secant passed stays in transparent ink, and the tangent develops where they all agree, then turns solid; the readout goes from Δy/Δx to f′(x₀).',
  topics: ['derivative', 'tangent', 'secant', 'limit', 'slope', 'calculus'],
  params: {
    fn: { type: 'text', max_length: 120, default: DEFAULT_FN, doc: 'the function of x in TeX, without y = (e.g. x^2, \\sin x, 0.15x^3 - 0.9x + 0.6)' },
    x0: { type: 'number', min: -6, max: 6, default: -2, doc: 'where the tangent is taken' },
    predict: { type: 'boolean', default: false, doc: 'predict first: the learner tilts a hollow line through P to the slope they expect and lets go; then the fan develops, the tangent turns solid and the gap in slope is said (and reported to the lesson)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { fn: 'x^2', x0: 1 }, { fn: '\\sin x', x0: 0.5 }, { predict: true }, { predict: true, fn: 'x^2', x0: 1, lang: 'zh' }],
  ids: ['graph', 'curve', 'secants', 'secant', 'tangent', 'q', 'p', 'slope'],
  figure: (p) => tangent_develop_figure(p),
  // (predict: the timer waits for the guess; played: nothing runs in explore)
  explore: (fig) => fig.sims.forEach((s) => s.pause()),
});
