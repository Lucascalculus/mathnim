// M6: why a terminal set keeps every later QP solvable (the shift argument), in the phase plane. The plan made at
// some instant (terminal-set MPC, N = 8, the moment it starts braking) ends at x_N inside X_f. One step later, a
// candidate plan is ready without solving anything: the old plan without its first step, plus one step of the
// terminal controller ("brake to rest") from x_N. Because X_f is invariant under that controller, the new end x_{N+1}
// is again in X_f, and every limit still holds: so the next QP has a solution (maybe a better one).
// Real numbers from the toy-cart simulation. No handles. (On the engine: the words name their marks in the marks'
// own colours, and on a phone the steps stack under the plane.)
import { Dots, Figure, Marker, Path, Region, column, over, reveal, row, set, t, together, wait, type XY } from '@mathnim/engine';
import { define_figure } from '../visual';
import { cart_step } from './math';
import { C_TERM, brake_to_rest, term_run } from './terminal_math';
import { LANG_SPEC, figure_lang } from './kit';

export interface ShiftTailParams extends Record<string, unknown> {
  N: number;
  lang: string;
}

/** The plan the figure shows, and the candidate one step later. */
export function shift_tail_data(N: number): { k: number; plan: number[][]; next: number[] } {
  const r = term_run(N, 'set');
  const k = r.shown_k;
  const plan = r.plans[k]!;
  const xN = plan[plan.length - 1];
  const next = cart_step(xN, brake_to_rest(xN[1])).x;
  return { k, plan, next };
}

export function shift_tail_figure(p: ShiftTailParams): Figure {
  const lang = figure_lang(p.lang);
  const d = shift_tail_data(p.N);
  const fig = new Figure({ lang });
  const P = fig.plot({ id: 'plane', x: [5.8, 9.2], y: [0.6, 2.25], x_ticks: [6, 7, 8, 9], y_ticks: [1, 2], x_label: 'p\\;(\\mathrm{m})', y_label: 'v\\;(\\mathrm{m/s})', priority: 2, says: t('the phase plane: position and speed', '相平面：位置和速度') });
  // the terminal set: left of its edge p + C v = 10, and within the speed limit v ≤ 2 (as the original drew it)
  const XF: XY[] = [[5.8, 0.6], [10 - C_TERM * 0.6, 0.6], [10 - C_TERM * 2, 2], [5.8, 2]];
  const xf = P.add(new Region(XF, { id: 'xf', role: 'region:terminal-set', edge: false, says: t('the terminal set', '终端集') }));
  const edge = P.add(new Path([[10 - C_TERM * 0.6, 0.6], [10 - C_TERM * 2, 2]], { id: 'xf_edge', role: 'predicted:terminal-set' }));
  // what must hold: the shaded corners are in the set, and the plan ends inside it
  fig.check('the terminal set is p + C v ≤ 10, v ≤ 2', () => {
    const bad = XF.find(([pp, vv]) => pp + C_TERM * vv > 10 + 1e-9 || vv > 2 + 1e-9);
    return bad ? `corner (${bad[0].toFixed(2)}, ${bad[1].toFixed(2)}) is outside the set` : null;
  });
  const pts = d.plan.map((q) => [q[0], q[1]] as XY);
  const drawn = fig.param('drawn', 0, { range: [0, 1] }), drawn_next = fig.param('drawn_next', 0, { range: [0, 1] });
  const plan = P.add(new Path(pts, { id: 'plan', role: 'predicted:plan', upto: drawn, says: t('the plan made at time k', '时刻 k 的计划') }));
  const plan_dots = P.add(new Dots(pts, { id: 'plan_dots', role: 'noun:plan', r: 4 }));
  const x0 = P.add(new Marker(pts[0], { id: 'x0', role: 'noun:state', shape: 'dot', r: 5.5 }));
  const xN = P.add(new Marker(pts[pts.length - 1], { id: 'xN', role: 'noun:plan', shape: 'dot', r: 5 }));
  const tail = P.add(new Path(pts.slice(1), { id: 'tail', role: 'noun:state', width: 4, says: t('the tail that is kept', '保留下来的后半段') }));
  const tail_dots = P.add(new Dots(pts.slice(1), { id: 'tail_dots', role: 'noun:state', r: 4.5 }));
  const nx = [d.next[0], d.next[1]] as XY;
  const next = P.add(new Path([pts[pts.length - 1], nx], { id: 'next', role: 'active:terminal-set', upto: drawn_next, says: t('the braking step appended', '补上的一步刹车') }));
  const x_next = P.add(new Marker(nx, { id: 'x_next', role: 'noun:terminal-set', shape: 'dot', r: 6 }));
  // names attached to what they name
  fig.label('\\mathcal X_f', [6.25, 1.2] as XY, { id: 'xf_word', tex: true, on: P, role: 'noun:terminal-set', sides: ['right'] });
  fig.label(t('edge: p + 1.95 v = 10', '边界：p + 1.95 v = 10')[lang], [5.9, 0.7] as XY, { id: 'edge_word', on: P, role: 'noun:terminal-set', sides: ['above-right', 'right'] });
  fig.label('x_0', x0, { id: 'x0_word', tex: true, role: 'noun:state', sides: ['above', 'above-left', 'left'] });
  fig.label('x_N', xN, { id: 'xN_word', tex: true, role: 'noun:plan', sides: ['left', 'above-left', 'below-left'] });
  fig.label('x_{N+1}', x_next, { id: 'x_next_word', tex: true, role: 'noun:terminal-set', sides: ['below-right', 'right', 'below'] });
  // the argument, step by step; each step names its marks in their colours
  const steps = fig.list([
    t('1. the [plan](noun:plan) at time k ends in the [terminal set](noun:terminal-set)', '1. 时刻 k 的[计划](noun:plan)，终点落在[终端集](noun:terminal-set)里'),
    t('2. at k + 1: keep its **tail**', '2. 到 k + 1：保留它的**后半段**'),
    t('3. append [one braking step](noun:terminal-set)', '3. 末尾补[一步刹车](noun:terminal-set)'),
  ], { id: 'steps', kind: 'caption' });
  const conclusion = fig.caption(t('Braking never leaves the terminal set, so the new end is inside it again: this candidate keeps every limit, so the next QP has a solution.', '刹车永远不会离开终端集，所以新的终点仍在集合里：这个候选计划满足每一条限制，因此下一次的 QP 必然有解。'), { id: 'conclusion', role: 'muted' });
  fig.aside(t(`toy-cart simulation: terminal-set MPC, N = ${p.N}, the plan made at t = ${(d.k * 0.1).toFixed(1)} s`, `玩具小车的模拟：终端集 MPC，N = ${p.N}，t = ${(d.k * 0.1).toFixed(1)} 秒时做的计划`));
  fig.layout(row([P, column([steps, conclusion], { gap: 18, align: 'center' })], { weights: [1.35, 1], gap: 30 }));
  const [s1, s2, s3] = steps.items;
  const by = (id: string) => fig.labels.find((l) => l.id === id)!;
  // (the original scene's timings; the plan and the braking step draw themselves on)
  fig.script(
    over(1, reveal(P, xf, edge, by('xf_word'), by('edge_word'))),
    over(1.4, together(reveal(plan, plan_dots, x0, xN, by('x0_word'), by('xN_word'), s1), set(drawn, 1, 'draw'))),
    over(1, reveal(tail, tail_dots, s2)),
    over(1, together(reveal(next, x_next, by('x_next_word'), s3), set(drawn_next, 1, 'draw'))),
    over(0.8, reveal(conclusion)),
    wait(3),
  );
  return fig;
}

export const mpc_shift_tail = define_figure<ShiftTailParams>({
  name: 'mpc_shift_tail',
  summary: 'The shift argument for recursive feasibility in the phase plane (p, v): a terminal-set plan x_0..x_N ending in X_f; one step later the candidate x_1..x_N plus one braking step from x_N, which stays in X_f because X_f is invariant under braking. Toy-cart simulation, static figure.',
  topics: ['mpc', 'terminal set', 'recursive feasibility', 'invariant set', 'control'],
  params: { N: { type: 'integer', min: 3, max: 12, default: 8, doc: 'horizon of the terminal-set MPC whose plan is shown' }, lang: LANG_SPEC },
  examples: [{}, { lang: 'zh' }, { N: 5 }],
  ids: ['plane', 'xf', 'plan', 'xN', 'tail', 'next', 'steps.0', 'conclusion'],
  figure: shift_tail_figure,
});
