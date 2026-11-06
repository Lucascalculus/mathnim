// The tangent, developed: the secant through P and a second point Q, as Q comes in by halving h. Each secant passed is
// left on the paper in transparent ink (the engine's Cases), so the early ones scatter into a pale fan and the late ones
// fall on each other; where they all agree the ink is deepest, and that is the tangent. Q is hollow (it is only an
// approximation), the secant through it dashed; at the end the tangent itself converges from dashed to solid (the
// engine's certainty), and the readout's name turns from Δy/Δx to f′. Nobody draws the tangent: it develops.
import { Cases, Figure, Marker, Path, beat, column, derive, parse_expr, reveal, row, set, together, wait, type XY } from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../ft/f/kit';

export interface TangentDevelopParams extends Record<string, unknown> {
  fn: string;
  x0: number;
  lang: string;
}

const DEFAULT_FN = '0.15x^3 - 0.9x + 0.6';
const COUNT = 44;

export function tangent_develop_figure(p: Partial<TangentDevelopParams> = {}): Figure {
  const lang = figure_lang(p.lang);
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
  const n = fig.param('n', 0, { range: [0, COUNT] }), k = fig.param('k', 0, { range: [0, 1] });
  const h = derive(() => level(n.value));
  const P = fig.plot({ id: 'graph', x: [a, b], y: [lo - pad, hi + pad], axes: 'origin', x_label: 'x', y_label: 'y', priority: 2 });
  const line = (m: number): XY[] => [[a, f(x0) + m * (a - x0)], [b, f(x0) + m * (b - x0)]];
  const slope = (hh: number) => (f(x0 + hh) - f(x0)) / hh;
  const curve = P.add(new Path(XS.map((u): XY => [u, f(u)]), { id: 'curve', role: 'noun:function' }));
  const fan = P.add(new Cases((j) => line(slope(level(j))), { id: 'secants', role: 'noun:value', count: COUNT, upto: n }));
  const secant = P.add(new Path(() => line(slope(h.value)), { id: 'secant', role: 'noun:value', certain: 0.15 }));
  const tangent = P.add(new Path(line(fp(x0)), { id: 'tangent', role: 'noun:value', width: 2.6, certain: k }));
  const q = P.add(new Marker(() => [x0 + h.value, f(x0 + h.value)], { id: 'q', role: 'noun:value', certain: 0 }));
  const pt = P.add(new Marker([x0, f(x0)], { id: 'p', role: 'noun:function' }));
  const exact = derive(() => k.value > 0.5);
  const ro = fig.readout([
    { tex: () => (exact.value ? "f'(x_0) =" : '\\dfrac{\\Delta y}{\\Delta x} =') },
    { value: () => (exact.value ? fp(x0) : slope(h.value)), decimals: 2, template: '−00.00' },
  ], { id: 'slope', role: 'noun:value', kind: 'display' });
  fig.layout(row([P, column([ro])], { weights: [3, 1], align: 'center' }), { phone: column([ro, P]) });
  fig.script(
    reveal(P, curve, pt, q, secant),
    wait(0.8),
    beat(), set(n, COUNT, 'linear', 3.6),
    beat(), together(set(k, 1, 'converge', 1.1), reveal(tangent)), wait(1.2),
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
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { fn: 'x^2', x0: 1 }, { fn: '\\sin x', x0: 0.5 }],
  ids: ['graph', 'curve', 'secants', 'secant', 'tangent', 'q', 'p', 'slope'],
  figure: (p) => tangent_develop_figure(p),
});
