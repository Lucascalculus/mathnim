// M4 on the engine: the cart's plan cut to two decisions (a₁ for the first second, a₂ for the second) so the QP can
// be drawn (the maths is qp2d.ts, the same as before; qp_plane.ts keeps the shared view and the manim pieces other
// visuals reuse). Left, the plan plane: the cost bowl around the no-limits plan × (shaded on the GPU, its level lines
// the equal-cost ellipses), one line per limit in its noun's colour (motor ink, speed teal, wall ochre), the feasible
// polygon, and the best plan ● where the smallest ellipse touches it, with the active limits drawn thick. Right, the
// cart on its rail with the best plan's predicted positions, and its state (p₀, v₀) on a pad the learner drags.
//
// What changed from the manim version (docs/design/ENGINE.md §11): no coordinates anywhere (rows, columns, attached
// labels); the legend sits outside the plot and each entry comes in with its line; on a phone the panels stack and
// every word stays at its size; the contours are one GPU field instead of six polylines rebuilt per frame.
import {
  Figure, Field, Marker, Path, Region, beat, column, derive, optional, over, quadratic, reveal, row, set, t, together, wait,
  type Param, type Step, type XY,
} from '@mathnim/engine';
import { define_figure } from '../visual';
import { COST, Q2, ROWS, contour, predicted, radius, row_segment, type Family } from './qp2d';
import { LIM, PAD, qp_view } from './qp_plane';
import { LANG_SPEC, figure_lang } from './kit';
import { cart_mark, flag_mark, position_dots, speed_arrow, track_plot, wall_mark } from './track';

export interface QpFigureParams extends Record<string, unknown> {
  story: string;
  p0: number;
  v0: number;
  clip: boolean;
  lang: string;
}

const FAMILIES: { f: Family; noun: string; k: number; tex: string; en: string; zh: string }[] = [
  { f: 'input', noun: 'motor', k: 1, tex: '|a| \\le 1', en: 'motor', zh: '电机' },
  { f: 'speed', noun: 'speed', k: 2, tex: '|v| \\le 2', en: 'speed', zh: '速度' },
  { f: 'wall', noun: 'wall', k: 3, tex: 'p \\le 10', en: 'wall', zh: '墙' },
];
const row_tex = (id: string): string => ROWS.find((r) => r.id === id)!.tex;
const inside = (p: readonly number[]) => Math.abs(p[0]) <= LIM && Math.abs(p[1]) <= LIM;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** The figure, with what the world and the doctor act on. */
export class QpFigure extends Figure {
  p0!: Param<number>;
  v0!: Param<number>;
  /** Set the state (snapped to the pad's grid): the world's solve() and the doctor use it. */
  set_state(p: number, v: number): void {
    this.p0.set(Math.round(Math.max(PAD.p[0], Math.min(PAD.p[1], p)) * 20) / 20, true);
    this.v0.set(Math.round(Math.max(PAD.v[0], Math.min(PAD.v[1], v)) * 20) / 20, true);
  }
  emit_released(): void {
    this.emit('released', this.report());
  }
}

export function qp_figure(p: QpFigureParams): QpFigure {
  const lang = figure_lang(p.lang);
  const full = p.story === 'full';
  // ---- state: the cart's state, and what the story shows of the picture
  const fig = new QpFigure({ lang });
  const p0 = (fig.p0 = fig.param('p0', p.p0, { range: PAD.p, step: 0.05, doc: "the cart's position now (m)" }));
  const v0 = (fig.v0 = fig.param('v0', p.v0, { range: PAD.v, step: 0.05, doc: "the cart's speed now (m/s)" }));
  const fam = fig.param('families', full ? 0 : 3, { range: [0, 3], doc: 'limit families shown (motor, speed, wall)' });
  const grow = fig.param('grow', full ? 0 : 1, { range: [0, 1], doc: 'the best ellipse grows from the centre' });
  // the QP is solved once per state (and per number of families shown), however many things read it
  const fam_n = derive(() => Math.round(fam.value), 'families shown');
  const V = derive(() => qp_view([p0.value, v0.value], fam_n.value), 'qp view');
  const view = () => V.value;
  const L = (en: string, zh: string) => (lang === 'zh' ? zh : en);
  const grown = () => grow.value > 0.999;
  const clip_on = () => p.clip && grown() && fam.value > 2.5;

  // ---- the plan plane
  const plane = fig.plot({
    id: 'plane', x: [-LIM, LIM], y: [-LIM, LIM], x_ticks: [-2, -1, 0, 1, 2], y_ticks: [-2, -1, 0, 1, 2], aspect: 'equal',
    x_label: 'a_1\\;(0\\text{–}1\\,\\mathrm{s})', y_label: 'a_2\\;(1\\text{–}2\\,\\mathrm{s})', priority: 2,
    says: t('计划平面：每个点是一份完整的计划 (a₁, a₂)', 'the plan plane: each point is a whole plan (a₁, a₂)'),
  });
  // the cost bowl: its level lines are the ellipses of equal cost around the no-limits plan
  const H = COST.H;
  const bowl = plane.add(new Field(quadratic(() => {
    const c = view().center;
    return [c[0], c[1], H[0][0], H[0][1], H[1][1]];
  }), { id: 'contours', role: 'noun:cost', levels: [1, 2, 3, 4.5, 6, 8], range: [0, 9], fill: 0.07, line: 0.3, says: t('等代价椭圆：同一圈上的计划代价相同', 'ellipses of equal cost') }));
  const feasible = plane.add(new Region(() => (view().poly.length >= 3 ? view().poly : []), { id: 'feasible', role: 'region:plan', says: t('守住所有限制的计划', 'the plans that keep every limit') }));
  // one line per limit, in its noun's colour; thick when the best plan touches it
  const lines = FAMILIES.flatMap(({ f, noun, k }) => {
    const rows = ROWS.map((r, i) => (r.family === f ? i : -1)).filter((i) => i >= 0);
    const segs = (active: boolean) => () => {
      const v = view();
      if (fam.value < k - 0.999) return [];
      return rows.filter((i) => v.plan.active.includes(i) === active).map((i) => row_segment(i, v.x0, -LIM, LIM)).filter((s): s is [[number, number], [number, number]] => !!s) as XY[][];
    };
    const thin = plane.add(new Path(segs(false), { id: `limit_${noun}`, role: `noun:${noun}`, z: 2.2 }));
    const thick = plane.add(new Path(segs(true), { id: `active_${noun}`, role: `active:${noun}`, z: 2.4 }));
    return [thin, thick];
  });
  void lines;
  // the best plan's ellipse (grown from the centre in the story), and the clipped plan's (dashed: it costs more)
  const best_contour = plane.add(new Path(() => {
    const v = view(), r = v.r * grow.value;
    return r > 0.02 ? contour(v.x0, r, 160) : [];
  }, { id: 'best_contour', role: 'noun:best-plan', width: 3.25, z: 2.6 }));
  const clip_contour = plane.add(new Path(() => {
    const v = view();
    if (!clip_on() || !v.feasible || Math.hypot(v.clip[0] - v.plan.z[0], v.clip[1] - v.plan.z[1]) < 0.05) return [];
    return contour(v.x0, radius(v.clip, v.x0), 160);
  }, { id: 'clip_contour', role: 'ghost:plan', z: 2.5 }));
  // markers: × the no-limits plan (an arrow on the border when it is off the chart), □ clipped, ● best
  const center_x = plane.add(new Marker(() => (inside(view().center) ? (view().center as XY) : null), { id: 'center', role: 'text', shape: 'cross', says: t('不管限制时的计划', 'the plan without limits') }));
  const center_arrow = plane.add(new Marker(() => {
    const c = view().center;
    if (inside(c)) return null;
    const s = LIM / Math.max(Math.abs(c[0]), Math.abs(c[1]));
    return [c[0] * s * 0.985, c[1] * s * 0.985];
  }, { id: 'center_arrow', role: 'text', shape: 'arrow', dir: () => view().center as XY }));
  const clip_mark = plane.add(new Marker(() => {
    const v = view();
    if (!clip_on()) return null;
    if (v.feasible && Math.hypot(v.clip[0] - v.plan.z[0], v.clip[1] - v.plan.z[1]) < 0.05) return null;
    return v.clip as XY;
  }, { id: 'clipped', role: 'ghost:plan', shape: 'square', says: t('截断的计划', 'the clipped plan') }));
  const best = plane.add(new Marker(() => (view().feasible && grown() ? (view().plan.z as XY) : null), { id: 'best', role: 'noun:best-plan', shape: 'dot', says: t('限制内的最优计划', 'the best plan within the limits') }));
  // words on the chart
  const center_word = fig.label(() => {
    const v = view();
    if (!v.feasible && fam.value > 2.5) return '';
    return inside(v.center) ? L('no limits', '不管限制') : L('no limits (off the chart)', '不管限制（在图外）');
  }, () => center_x.where() ?? center_arrow.where(), { id: 'center_word', own: [center_x, center_arrow], sides: ['above-right', 'below-right', 'above-left', 'below-left', 'right', 'left', 'above', 'below'], within: () => plane.data });
  const none_word = fig.label(() => (!view().feasible && fam.value > 2.5 ? L('no plan keeps every limit', '没有任何计划能守住所有限制') : ''), () => [plane.data.x + plane.data.w / 2, plane.data.y + plane.data.h * 0.38] as XY, { id: 'no_plan', role: 'noun:wall', sides: ['below', 'above'], weight: 600, within: () => plane.data });
  void none_word;

  // the key: each family comes in with its line; the markers with the best plan
  const legend = fig.legend([
    ...FAMILIES.map(({ noun, k, tex, en, zh }) => ({ role: `noun:${noun}`, text: t(zh, en), tex, mark: 'line' as const, show: () => clamp01(fam.value - (k - 1)) })),
    { role: 'noun:best-plan', text: t('最优计划', 'best plan'), mark: 'dot' as const, show: () => (grown() ? 1 : 0) },
    ...(p.clip ? [{ role: 'ghost:plan', text: t('截断的计划', 'clipped plan'), mark: 'square' as const, show: () => (clip_on() ? 1 : 0) }] : []),
  ], { id: 'legend' });
  // the best plan's numbers and the limits that hold it
  const a_of = (i: 0 | 1) => () => (view().feasible ? view().plan.z[i] : NaN);
  const readout = fig.readout([{ tex: 'a_1 =' }, { value: a_of(0), decimals: 2, template: '−0.00' }, { gap: 1.1 }, { tex: 'a_2 =' }, { value: a_of(1), decimals: 2, template: '−0.00' }, { tex: '\\mathrm{m/s^2}' }], { id: 'readout', role: 'noun:best-plan', says: t('最优计划的两步加速度', "the best plan's two accelerations") });
  const active = fig.readout([
    { text: t('起作用的限制：', 'active:') },
    { tex: () => {
      const v = view();
      if (!v.feasible) return '\\text{---}';
      return v.ids.length ? v.ids.map(row_tex).join(',\\;\\; ') : '\\varnothing';
    } },
    { text: () => {
      const v = view();
      if (fam.value < 2.5) return '';
      if (!v.feasible) return L('infeasible', '无解');
      return v.ids.length ? '' : L('(none: as with no limits)', '（没有：和不管限制时一样）');
    } },
  ], { id: 'active', kind: 'caption', says: t('最优计划碰到的限制', 'the limits the best plan touches') });

  // ---- the cart and its state
  const track = track_plot({ id: 'track', p: [PAD.p[0], 10.4], ticks: [4, 5, 6, 7, 8, 9, 10] });
  const cart = track.add(cart_mark(() => p0.value));
  const wall = track.add(wall_mark(10));
  const flag = track.add(flag_mark(Q2.p_ref));
  const dots = track.add(position_dots(() => {
    const v = view();
    if (!grown()) return [];
    return predicted(v.x0, v.feasible ? v.plan.z : [-1, -1]).map((s) => s[0]).filter((q) => q <= 10);
  }));
  const dots_bad = track.add(position_dots(() => (!view().feasible ? predicted(view().x0, [-1, -1]).map((s) => s[0]).filter((q) => q > 10 && q < 10.4) : []), { id: 'plan_dots_bad', role: 'noun:wall' }));
  const arrow = track.add(speed_arrow(() => p0.value, () => v0.value));
  // (v₀ is always shown, as before: beside its arrow - first behind it, where the track is usually empty - or above
  // the cart while it stands still)
  const speed_word = fig.label(() => `v_0 = ${v0.value.toFixed(2)}\\,\\mathrm{m/s}`, () => (arrow.box.w ? arrow.box : cart.box.w ? { x: cart.box.x, y: cart.box.y - 14, w: cart.box.w, h: 10 } : null), { id: 'speed_word', tex: true, role: 'noun:speed', sides: ['left', 'right', 'above'], own: [arrow], within: () => track.box });
  const track_key = fig.legend([{ role: 'noun:plan', text: t('最优计划在接下来 2 秒里让小车到达的位置', 'where the best plan takes the cart in the next 2 s'), mark: 'dot', show: () => (grown() ? 1 : 0) }], { id: 'track_key' });
  const pad = fig.plot({
    id: 'pad', x: [PAD.p[0], 10], y: PAD.v, x_ticks: [4, 5, 6, 7, 8, 9, 10], y_ticks: [0, 1, 2], aspect: 2.4, phone_aspect: 3.4,
    x_label: 'p_0\\;(\\mathrm{m})', y_label: 'v_0\\;(\\mathrm{m/s})', says: t('小车此刻的状态', "the cart's state now"),
  });
  const state = pad.add(new Marker(() => [p0.value, v0.value], { id: 'state', role: 'noun:state', shape: 'dot', clip: false, says: t('小车此刻的状态 (p₀, v₀)', "the cart's state (p₀, v₀)") }));
  const handle = fig.handle(pad, p0, v0, { id: 'state_handle', says: t('小车的状态 (p₀, v₀)', "the cart's state (p₀, v₀)"), on_end: () => fig.emit_released() });
  void handle;
  const pad_title = fig.caption(t('小车此刻的状态', "the cart's state now"), { id: 'pad_title', kind: 'label' });
  fig.aside(t('玩具小车，QP 精确求解；计划每秒只换一次加速度', 'toy cart, exact QP; the plan holds one acceleration per second'));

  // ---- layout: plan plane beside the cart; on a phone, one above the other
  // (the plane takes the whole height of its side; its result - the numbers and the active limits - heads the other
  // side, above the cart it moves; on a phone it is all one column in reading order)
  fig.layout(row([
    column([legend, plane], { gap: 8 }),
    column([readout, active, track, optional(track_key), optional(pad_title), pad], { gap: 8 }),
  ], { weights: [1.08, 1], gap: 28 }), {
    // a phone: the pad the hand moves sits right under the plane it changes (both on one screen); the cart after
    phone: column([legend, plane, readout, pad, active, track, track_key], { gap: 10 }),
  });

  // ---- report (the world and the doctor read it)
  fig.report_with(() => {
    const v = qp_view([p0.peek(), v0.peek()]);
    return { p0: v.x0[0], v0: v.x0[1], feasible: v.feasible, active: v.ids.join(','), wall: v.wall, speed: v.speed, flip: v.flip, a1: v.plan.z[0], a2: v.plan.z[1] };
  });
  // (a clipped plan that keeps every limit is a candidate, so the best plan can only cost less; one that breaks a
  // speed or wall limit may cost less, which is the point of the lesson)
  const keeps = (z: readonly number[], x0: readonly number[]) => ROWS.every((r) => r.g[0] * z[0] + r.g[1] * z[1] <= r.w + r.e[0] * x0[0] + r.e[1] * x0[1] + 1e-6);
  // what must hold at the end of the script: the best plan keeps every limit, and costs no more than the clipped one
  fig.check('best keeps the limits', () => {
    const v = qp_view([p0.peek(), v0.peek()]);
    if (!v.feasible) return null;
    const z = v.plan.z, ok = keeps(z, v.x0);
    return ok ? null : `the best plan (${z[0].toFixed(2)}, ${z[1].toFixed(2)}) breaks a limit`;
  });
  fig.check('a clipped plan that keeps the limits costs at least as much', () => {
    const v = qp_view([p0.peek(), v0.peek()]);
    if (!v.feasible || !keeps(v.clip, v.x0)) return null;
    return v.J_clip >= v.J_best - 1e-6 ? null : `clipped ${v.J_clip.toFixed(2)} < best ${v.J_best.toFixed(2)}`;
  });

  // ---- the script (one section per beat of the narration), with the original scene's timings, so the picture
  // keeps its pace against the same recorded voice
  const all = [plane, legend, track, cart, wall, flag, pad, state, pad_title, arrow, speed_word];
  const move = (p_: number, v_: number, dur: number) => over(dur, together(set(p0, p_, 'travel'), set(v0, v_, 'travel')));
  const steps: Step[] = full
    ? [
        over(1.2, reveal(...all)),
        beat(),
        over(1.8, reveal(center_x, center_arrow, center_word, bowl, feasible)),
        wait(1.2),
        beat(),
        over(1.2, set(fam, 1, 'travel')),
        wait(0.8),
        beat(),
        over(2.2, set(grow, 1, 'grow')),
        over(0.8, reveal(readout, active, dots, track_key, best)),
        wait(1),
        beat(),
        over(0.8, set(fam, 2, 'travel')),
        over(0.8, set(fam, 3, 'travel')),
        wait(p.clip ? 0.6 : 0.1),
        move(6.4, 1.5, 1.6),
        wait(0.4),
        move(7.1, 1.9, 1.6),
        wait(0.4),
        beat(),
        move(9.3, 1.8, 2.4),
        wait(1),
        move(p.p0, p.v0, 1.4),
        wait(0.5),
      ]
    : [over(1, reveal(...all, center_x, center_arrow, center_word, bowl, feasible, readout, active, dots, track_key, best)), wait(0.4)];
  fig.script(...steps);
  void [feasible, best_contour, clip_contour, clip_mark, dots_bad];
  return fig;
}

export const mpc_qp_plane = define_figure<QpFigureParams>({
  name: 'mpc_qp_plane',
  summary: "The cart's MPC cut to two decisions (a₁ for the first second, a₂ for the second) so the QP can be drawn: the cost bowl and its ellipses around the no-limits plan, each limit (motor, speed, wall) a straight line in its own colour, the feasible polygon, and the best plan where the smallest ellipse touches it (active limits drawn thick). Drag the cart's state (p₀, v₀): the lines slide, the optimum slides along edges; fast and close, the polygon vanishes (no plan). Shows the clipped no-limits plan for comparison. Exact QP on the toy cart.",
  topics: ['mpc', 'quadratic program', 'constraints', 'active set', 'kkt', 'feasible set', 'level sets', 'control'],
  params: {
    story: { type: 'enum', values: ['full', 'setup'], default: 'full', doc: "'full': the narrated build (cost ellipses, the limits one family at a time, the smallest ellipse touching the polygon, then the state moves); 'setup': everything shown at once at (p0, v0), for a world" },
    p0: { type: 'number', min: 4, max: 9.9, default: 8, doc: 'initial position of the cart [m] (its front bumper; the wall is at 10 m, the flag at 9.5 m)' },
    v0: { type: 'number', min: 0, max: 2, default: 0, doc: 'initial speed [m/s] (the limit is 2)' },
    clip: { type: 'boolean', default: true, doc: 'show the clipped no-limits plan (□) and its cost ellipse, for comparison with the best plan' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { story: 'setup', p0: 9, v0: 0.2 }, { story: 'setup', p0: 9, v0: 0.2, lang: 'zh' }, { story: 'setup', p0: 7.1, v0: 1.9, lang: 'zh' }, { story: 'setup', p0: 9.5, v0: 1.8 }, { story: 'setup', p0: 4, v0: 0, clip: false }],
  ids: ['plane', 'contours', 'feasible', 'best_contour', 'limit_motor', 'limit_speed', 'limit_wall', 'center', 'clipped', 'best', 'legend', 'readout', 'active', 'track', 'cart', 'plan_dots', 'pad', 'state'],
  figure: qp_figure,
  explore: () => {
    // the pad's handle is part of the figure (its on_end reports 'released'); the world listens through attach()
  },
});
