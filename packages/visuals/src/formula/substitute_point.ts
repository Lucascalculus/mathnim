// Putting a number into a function, in one figure: the graph on the left, the formula steps on the right - the engine's
// Steps as one block of the layout, driven by the same script as the graph. When the steps put the number in, the
// point stands on the axis at that x; when they work it out, it rises onto the curve, to the value the last line says.
// The number put in is drawn in the point's colour, so "this is that" needs no words. On a phone the steps go above.
import { look, color_of } from '@mathnim/look';
import { Figure, Marker, Path, Steps, beat, column, parse_expr, reveal, review_steps, row, set, together, wait, type XY } from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../ft/f/kit';

export interface SubstitutePointParams extends Record<string, unknown> {
  fn: string;
  x0: number;
  lang: string;
}

const DEFAULT_FN = 'x^2 - 2x';
/** A number as a line of the steps writes it: whole, or to three places (then the line says ≈). */
const as_tex = (v: number): { tex: string; exact: boolean } => {
  const r = Math.round(v * 1000) / 1000;
  const exact = Math.abs(r - v) < 1e-9;
  return { tex: (Number.isInteger(r) ? String(r) : String(r)).replace(/^-/, '-'), exact };
};

/** The lines: y = f(x), the number put in (in the point's colour), the value. */
export function substitute_lines(fn: string, x0: number, lang: 'en' | 'zh', colour: string): { tex: string; why: string | null }[] {
  const put = `\\color{${colour}}{(${x0})}`;
  const sub = fn.replace(/(?<![\\a-zA-Z])x(?![a-zA-Z])/g, put);
  const v = parse_expr(fn).f({ x: x0 }), out = as_tex(v);
  return [
    { tex: `y = ${fn}`, why: null },
    { tex: `y = ${sub}`, why: lang === 'zh' ? `代入 x = ${x0}` : `put in x = ${x0}` },
    { tex: `y ${out.exact ? '=' : '\\approx'} ${out.tex}`, why: lang === 'zh' ? '算出来' : 'work it out' },
  ];
}

export function substitute_figure(p: Partial<SubstitutePointParams> = {}): Figure {
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
  const x0 = p.x0 ?? 3, y0 = f(x0);
  // the window: the point and a little either side, the origin in view; the height is the point's (the curve may
  // leave the top where it climbs away), so the rise from the axis to the value is what the eye sees
  const a = Math.min(-1, Math.floor(x0 - 3)), b = Math.max(1, Math.ceil(x0 + 3));
  const XS = Array.from({ length: 241 }, (_, i) => a + ((b - a) * i) / 240);
  const ys = XS.map(f).filter(Number.isFinite);
  const low = Math.min(0, y0, ...ys), reach = Math.max(2, Math.abs(y0) * 1.6, -low * 1.2);
  const lo = Math.max(low, Math.min(0, y0) - reach * 0.5), hi = Math.max(0, y0) + reach * 0.6;
  const pad = (hi - lo) * 0.08;
  const fig = new Figure({ lang });
  const rise = fig.param('rise', 0, { range: [0, 1] });
  const P = fig.plot({ id: 'graph', x: [a, b], y: [lo - pad, hi + pad], axes: 'origin', x_ticks: [x0], y_ticks: y0 ? [y0] : [], x_label: 'x', y_label: 'y', priority: 2 });
  const curve = P.add(new Path(() => XS.map((u): XY => [u, f(u)]).filter(([, v]) => Number.isFinite(v) && v >= lo - pad * 2 && v <= hi + pad * 2), { id: 'curve', role: 'noun:function' }));
  const guide = P.add(new Path([[x0, 0], [x0, y0]], { id: 'guide', role: 'noun:value', upto: rise, style: { dash: [4, 4], width: 1.4 } }));
  const dot = P.add(new Marker(() => [x0, y0 * rise.value], { id: 'point', role: 'noun:value', shape: 'dot' }));
  const lines = substitute_lines(fn, x0, lang, color_of('noun:value', look()));
  const st = new Steps(lines, { id: 'steps', why: true });
  fig.layout(row([P, column([st])], { weights: [3, 2], align: 'center' }), { phone: column([st, P]) });
  fig.script(
    reveal(P, curve),
    wait(0.9),
    beat(), together(st.go(1), reveal(dot)), wait(1.1),
    beat(), together(st.go(2), set(rise, 1, 'travel', 1.3), reveal(guide)), wait(1.2),
  );
  const r = review_steps(lines.map((l) => `${l.tex}${l.why ? ` % ${l.why}` : ''}`).join('\n'));
  fig.check('the steps follow line by line', () => (r.ok ? null : r.issues.join('; ')));
  // the picture and the formula say the same: where the point lands is the number the last line gives
  const said = Number(/(-?[\d.]+)$/.exec(lines[2].tex)?.[1]);
  fig.check('the point lands where the last line says', () => {
    if (rise.peek() < 1) return null;
    const [, py] = (dot.pos as () => XY)();
    return Math.abs(py - f(x0)) < 1e-9 && Math.abs(said - py) < 5e-4 ? null : `the point is at ${py}, the steps say ${said}`;
  });
  return fig;
}

export const substitute_point = define_figure<SubstitutePointParams>({
  name: 'substitute_point',
  summary: 'Putting a number into a function: the graph of y = f(x) beside the formula steps y = f(x) → the number put in → the value; as the steps put x in, the point stands on the axis at x, and as they work it out it rises onto the curve. The number put in and the point share a colour.',
  topics: ['function', 'substitution', 'evaluate', 'graph', 'value of a function', 'derivation', 'algebra'],
  params: {
    fn: { type: 'text', max_length: 120, default: DEFAULT_FN, doc: 'the function of x in TeX, without y = (e.g. x^2 - 2x, \\frac{12}{x}, 2^{x}, \\sin x)' },
    x0: { type: 'number', min: -10, max: 10, default: 3, doc: 'the number put in for x' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { fn: '\\frac{12}{x} + 1', x0: 4 }, { fn: '0.5x^2 - 3x + 2', x0: -2, lang: 'zh' }],
  ids: ['graph', 'curve', 'guide', 'point', 'steps'],
  figure: (p) => substitute_figure(p),
});
