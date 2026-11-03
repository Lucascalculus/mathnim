// M4 on the engine: the cart's plan cut to two decisions (a₁ for the first second, a₂ for the second) so the QP can
// be drawn (the maths is qp2d.ts, the same as before; qp_plane.ts keeps the shared view and the manim pieces other
// visuals reuse). Left, the plan plane: the ellipses of equal cost around the no-limits plan ×, one line per limit
// (motor ink, speed gold, wall coral; dashed until it binds, then thick), the feasible polygon, and the best plan ●
// where the smallest ellipse touches it. Right, the cart on its rail with the best plan's predicted positions, and
// its state (p₀, v₀) on a pad the learner drags.
//
// On a desktop it is the manim scene's picture: every block sits in the rectangle the scene gave it (place(), the
// manim frame), with the scene's colours, line widths, dashes and sizes (the style overrides: manim text size s is
// about 0.66 s px and stroke w about 0.69 w px on a 984 px stage), laid out at that design width and drawn scaled
// to the real stage like the scene. A phone gets its own composition of the same things, one column in reading order.
import {
  Figure, Marker, Path, Region, beat, column, derive, over, place, reveal, row, set, t, together, wait,
  type Param, type Step, type XY,
} from '@mathnim/engine';
import { define_figure } from '../visual';
import { Q2, ROWS, contour, predicted, radius, row_segment, type Family } from './qp2d';
import { LIM, PAD, qp_view } from './qp_plane';
import { LANG_SPEC, figure_lang } from './kit';
import { cart_mark, flag_mark, position_dots, speed_arrow, track_plot, unit_of, wall_mark } from './track';

export interface QpFigureParams extends Record<string, unknown> {
  story: string;
  p0: number;
  v0: number;
  clip: boolean;
  lang: string;
}

/** manim sizes → px on the desktop stage (see the header). */
const FS = (s: number) => +(s * 0.66).toFixed(1);
const SW = (w: number) => +(w * 0.69).toFixed(2);
/** The old scene's dashes (0.16 on, 0.1 off, in units of 69 px). */
const DASH: [number, number] = [11, 6.9];

const FAMILIES: { f: Family; color: string; k: number; tex: string; en: string; zh: string }[] = [
  { f: 'input', color: 'ink', k: 1, tex: '|a| \\le 1', en: 'motor', zh: '电机' },
  { f: 'speed', color: 'gold', k: 2, tex: '|v| \\le 2', en: 'speed', zh: '速度' },
  { f: 'wall', color: 'coral', k: 3, tex: 'p \\le 10', en: 'wall', zh: '墙' },
];
const NOUN: Record<Family, string> = { input: 'motor', speed: 'speed', wall: 'wall' };
const row_tex = (id: string): string => ROWS.find((r) => r.id === id)!.tex;
const inside = (p: readonly number[]) => Math.abs(p[0]) <= LIM && Math.abs(p[1]) <= LIM;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const num_tex = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '\\text{---}');

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
  const p0 = (fig.p0 = fig.param('p0', p.p0, { range: PAD.p, step: 0.05, doc: "the cart's position now (m)", says: t("the cart's position p₀ (m)", '小车此刻的位置 p₀（米）') }));
  const v0 = (fig.v0 = fig.param('v0', p.v0, { range: PAD.v, step: 0.05, doc: "the cart's speed now (m/s)", says: t("the cart's speed v₀ (m/s)", '小车此刻的速度 v₀（米/秒）') }));
  const fam = fig.param('families', full ? 0 : 3, { range: [0, 3], doc: 'limit families shown (motor, speed, wall)' });
  const grow = fig.param('grow', full ? 0 : 1, { range: [0, 1], doc: 'the best ellipse grows from the centre' });
  const drawn = fig.param('contours_drawn', full ? 0 : 1, { range: [0, 1], doc: 'how much of the cost ellipses is drawn' });
  const clip_key = fig.param('clip_key', full ? 0 : 1, { range: [0, 1], doc: 'the clipped plan in the key' });
  // the QP is solved once per state (and per number of families shown), however many things read it
  const fam_n = derive(() => Math.round(fam.value), 'families shown');
  const V = derive(() => qp_view([p0.value, v0.value], fam_n.value), 'qp view');
  const view = () => V.value;
  const L = (en: string, zh: string) => (lang === 'zh' ? zh : en);
  const grown = () => grow.value > 0.999;
  const clip_on = () => p.clip && grown() && fam.value > 2.5;
  const muted = { color: 'muted', text: 'muted' };

  // ---- the plan plane
  const plane = fig.plot({
    id: 'plane', x: [-LIM, LIM], y: [-LIM, LIM], x_ticks: [-2, -1, 0, 1, 2], y_ticks: [-2, -1, 0, 1, 2], aspect: 'equal', data_box: true,
    x_label: 'a_1\\;(0\\text{–}1\\,\\mathrm{s})', y_label: 'a_2\\;(1\\text{–}2\\,\\mathrm{s})', priority: 2, number_tex: true, label_px: FS(26),
    grid_at: { x: [-1, 0, 1], y: [-1, 0, 1, 2] }, tick_marks: { x: 'cross', y: 'none', len: 8.3 }, style: { ...muted, width: SW(2), size: FS(22) },
    says: t('the plan plane: each point is a whole plan (a₁, a₂)', '计划平面：每个点是一份完整的计划 (a₁, a₂)'),
  });
  // the feasible polygon (all of the plane before any limit is shown)
  const feasible = plane.add(new Region(() => (view().poly.length >= 3 ? view().poly : []), { id: 'feasible', role: 'region:plan', style: { color: 'accent', fill_alpha: 0.13, width: SW(2.5), alpha: 1 }, says: t('the plans that keep every limit', '守住所有限制的计划') }));
  // the ellipses of equal cost around the no-limits plan (drawn on, as the scene's Create did)
  const contours = plane.add(new Path(() => [1, 2, 3, 4.5, 6, 8].map((r) => contour(view().x0, r, 120)), { id: 'contours', role: 'noun:cost', upto: drawn, style: { color: 'accent', width: SW(1.8), alpha: 0.35 }, says: t('ellipses of equal cost', '等代价椭圆：同一圈上的计划代价相同') }));
  // one line per limit in its family's colour: thin (dashed, but the motor's) while inactive, thick when it binds
  const limit_paths: Path[] = [];
  for (const { f, color, k } of FAMILIES) {
    const rows = ROWS.map((r, i) => (r.family === f ? i : -1)).filter((i) => i >= 0);
    const segs = (active: boolean) => () => {
      const v = view();
      if (fam.value < k - 0.5) return [];
      return rows.filter((i) => v.plan.active.includes(i) === active).map((i) => row_segment(i, v.x0, -LIM, LIM)).filter((s): s is [[number, number], [number, number]] => !!s) as XY[][];
    };
    limit_paths.push(
      plane.add(new Path(segs(false), { id: `limit_${NOUN[f]}`, role: `noun:${NOUN[f]}`, z: 2.2, style: { color, width: SW(2.5), alpha: f === 'input' ? 0.75 : 0.9, dash: f === 'input' ? null : DASH } })),
      plane.add(new Path(segs(true), { id: `active_${NOUN[f]}`, role: `active:${NOUN[f]}`, z: 2.4, style: { color, width: SW(6), alpha: 1, dash: null } })),
    );
  }
  // the best plan's ellipse (grown from the centre in the story), and the clipped plan's (dashed: it costs more)
  const best_contour = plane.add(new Path(() => {
    const v = view(), r = v.r * grow.value;
    return r > 0.02 ? contour(v.x0, r, 160) : [];
  }, { id: 'best_contour', role: 'noun:best-plan', z: 2.6, style: { color: 'accent', width: SW(3.5) } }));
  const clip_contour = plane.add(new Path(() => {
    const v = view();
    if (!clip_on() || !v.feasible || Math.hypot(v.clip[0] - v.plan.z[0], v.clip[1] - v.plan.z[1]) < 0.05) return [];
    return contour(v.x0, radius(v.clip, v.x0), 160);
  }, { id: 'clip_contour', role: 'ghost:plan', z: 2.5, style: { color: 'muted', width: SW(2.5), alpha: 1, dash: DASH } }));
  // markers: × the no-limits plan (an arrow on the border when it is off the chart), □ clipped, ● best
  const center_x = plane.add(new Marker(() => (inside(view().center) ? (view().center as XY) : null), { id: 'center', role: 'text', shape: 'cross', r: 9, style: { color: 'ink', width: SW(4) }, says: t('the plan without limits', '不管限制时的计划') }));
  const center_arrow = plane.add(new Marker(() => {
    const c = view().center;
    if (inside(c)) return null;
    const s = LIM / Math.max(Math.abs(c[0]), Math.abs(c[1]));
    return [c[0] * s * 0.985, c[1] * s * 0.985];
  }, { id: 'center_arrow', role: 'text', shape: 'arrow', dir: () => view().center as XY, style: { color: 'ink', width: SW(4) } }));
  const clipped = plane.add(new Marker(() => {
    const v = view();
    if (!clip_on()) return null;
    if (v.feasible && Math.hypot(v.clip[0] - v.plan.z[0], v.clip[1] - v.plan.z[1]) < 0.05) return null;
    return v.clip as XY;
  }, { id: 'clipped', role: 'ghost:plan', shape: 'square', r: 8.3, style: { color: 'muted', width: SW(3.5) }, says: t('the clipped plan', '截断的计划') }));
  const best = plane.add(new Marker(() => (view().feasible && grown() ? (view().plan.z as XY) : null), { id: 'best', role: 'noun:best-plan', shape: 'dot', r: 7.4, style: { color: 'accent', width: 2 }, says: t('the best plan within the limits', '限制内的最优计划') }));
  // words on the chart (on a paper backing: they sit over lines and ellipses)
  const center_word = fig.label(() => {
    const v = view();
    if (!v.feasible && fam.value > 2.5) return '';
    return inside(v.center) ? L('no limits', '不管限制') : L('no limits (off the chart)', '不管限制（在图外）');
  }, () => center_x.where() ?? center_arrow.where(), {
    id: 'center_word', own: [center_x, center_arrow], sides: ['above-right', 'above-left', 'below-right', 'below-left', 'above', 'below', 'right', 'left'],
    within: () => plane.data, gap: 9, style: { size: FS(20), weight: 400, color: 'ink', backing: 0.85 },
  });
  const no_plan = fig.label(() => (!view().feasible && fam.value > 2.5 ? L('no plan keeps every limit', '没有任何计划能守住所有限制') : ''), () => [plane.data.x + plane.data.w / 2, plane.data.y + plane.data.h * 0.38] as XY, {
    id: 'no_plan', role: 'noun:wall', sides: ['center'], avoid: false, within: () => plane.data, style: { size: FS(24), weight: 400, color: 'coral', backing: 0.9 },
  });
  // the key to the limits, in the plane's top-left corner (on a paper card); each family comes in with its line
  const limits_key = fig.legend(FAMILIES.map(({ f, color, k, tex, en, zh }) => ({
    role: `noun:${NOUN[f]}`, text: t(en, zh), tex, mark: 'line' as const, show: () => clamp01(fam.value - (k - 1)), style: { color, width: f === 'input' ? SW(2.5) : SW(4), dash: null },
  })), { id: 'legend', stack: true, swatch: 24, line_h: 1.72, style: { size: FS(22), backing: 0.88 } });
  plane.inset(limits_key, 'top-left', { pad: 8 });
  // the key to the markers, above the numbers
  const key = fig.legend([
    { role: 'noun:best-plan', text: t('best plan within the limits', '限制内的最优计划'), mark: 'dot', style: { color: 'accent' } },
    ...(p.clip ? [{ role: 'ghost:plan', text: t('clipped plan', '截断的计划'), mark: 'square' as const, show: () => clip_key.value, style: { ...muted, width: SW(3) } }] : []),
  ], { id: 'key', gap: 26, swatch: 14, style: { size: FS(20) } });
  // the best plan's numbers (TeX, as the scene set them) and the limits that hold it
  const a_of = (i: 0 | 1) => () => num_tex(view().feasible ? view().plan.z[i] : NaN);
  const ra1 = fig.readout([{ tex: 'a_1 =' }, { gap: 0.12 }, { tex: a_of(0) }], { id: 'readout', role: 'noun:best-plan', style: { size: FS(26), color: 'accent' }, says: t("the best plan's first acceleration", '最优计划的第一步加速度') });
  const ra2 = fig.readout([{ tex: 'a_2 =' }, { gap: 0.12 }, { tex: a_of(1) }], { id: 'readout_2', role: 'noun:best-plan', style: { size: FS(26), color: 'accent' }, says: t("the best plan's second acceleration", '最优计划的第二步加速度') });
  const unit = fig.readout([{ tex: '\\mathrm{m/s^2}' }], { id: 'readout_unit', style: { size: FS(22), ...muted } });
  const active = fig.readout([
    { text: t('active:', '起作用的限制：'), size: FS(22) },
    { gap: 0.3 },
    { tex: () => {
      const v = view();
      if (fam.value < 0.5) return '';
      if (!v.feasible) return '\\text{---}';
      return v.ids.length ? v.ids.map(row_tex).join(',\\;\\; ') : '\\varnothing';
    } },
    { gap: 0.3 },
    { text: () => {
      const v = view();
      if (fam.value < 2.5) return '';
      if (!v.feasible) return L('infeasible', '无解');
      return v.ids.length ? '' : L('(none: same as with no limits)', '（没有：和不管限制时一样）');
    }, size: FS(20), color: 'muted' },
  ], { id: 'active', style: { size: FS(26), color: 'ink' }, says: t('the limits the best plan touches', '最优计划碰到的限制') });

  // ---- the cart and its state
  const track = track_plot({ id: 'track', p: [PAD.p[0], 10] });
  const cart = track.add(cart_mark(() => p0.value));
  const wall = track.add(wall_mark(10));
  const flag = track.add(flag_mark(Q2.p_ref));
  const dots = track.add(position_dots(() => {
    const v = view();
    if (!grown()) return [];
    return predicted(v.x0, v.feasible ? v.plan.z : [-1, -1]).map((s) => Math.min(s[0], 10));
  }));
  const bad_dots = track.add(position_dots(() => (!view().feasible ? predicted(view().x0, [-1, -1]).map((s) => s[0]).filter((q) => q > 10).map(() => 10) : []), { id: 'plan_dots_bad', role: 'noun:wall', color: 'coral' }));
  const arrow = track.add(speed_arrow(() => p0.value, () => v0.value));
  // v₀ beside the arrow's tip (always shown, as before); pushed left and up when it would run off the stage
  const speed_word = fig.label(() => `v_0 = ${v0.value.toFixed(2)}\\,\\mathrm{m/s}`, () => {
    const u = unit_of(track);
    if (!u) return null;
    const x = track.X(p0.value) - 0.45 * u + Math.max(0.02, v0.value * 0.6) * u + 0.12 * u, y = track.Y(0) - 1.18 * u;
    const w = speed_word.size(lang).w, right = track.data.x + (6.9 - 0.95) * u;
    return x + w > right ? [right - w, y - 0.32 * u] : [x, y];
  }, { id: 'speed_word', tex: true, role: 'noun:speed', sides: ['right'], avoid: false, gap: 0, style: { size: FS(22), color: 'ink' } });
  const plan_word = fig.caption(t('dots: where the best plan puts the cart over the next 2 s', '圆点：最优计划在接下来 2 秒里让小车到达的位置'), { id: 'track_key', style: { size: FS(20), color: 'accent' } });
  const pad = fig.plot({
    id: 'pad', x: [PAD.p[0], 10], y: PAD.v, x_ticks: [4, 5, 6, 7, 8, 9, 10], y_ticks: [0, 1, 2], aspect: 5.5 / 3.1, phone_aspect: 3.4, data_box: true,
    x_label: 'p_0\\;(\\mathrm{m})', y_label: 'v_0\\;(\\mathrm{m/s})', number_tex: true, label_px: FS(26), grid_at: { x: [], y: [1, 2] },
    tick_marks: { x: 'cross', y: 'none', len: 8.3 }, style: { ...muted, width: SW(2), size: FS(22) }, says: t("the cart's state now", '小车此刻的状态'),
  });
  const state = pad.add(new Marker(() => [p0.value, v0.value], { id: 'state', role: 'noun:state', shape: 'dot', r: 7.6, clip: false, style: { color: 'ink', width: 0 }, says: t("the cart's state (p₀, v₀)", '小车此刻的状态 (p₀, v₀)') }));
  fig.handle(pad, p0, v0, { id: 'state_handle', says: t("the cart's state (p₀, v₀)", '小车的状态 (p₀, v₀)'), on_end: () => fig.emit_released() });
  const pad_title = fig.caption(t("the cart's state now", '小车此刻的状态'), { id: 'pad_title', style: { size: FS(20), color: 'ink' } });
  fig.aside(t('toy cart, exact QP; the plan holds one acceleration per second', '玩具小车，QP 精确求解；计划每秒只换一次加速度'));

  // ---- layout: on a desktop, the scene's own rectangles (manim units, y up); on a phone, one column
  // (a readout or a caption's rectangle starts at its top: the scene centred them on these heights)
  const at_y = (cy: number, px: number, k = 1.5): [number, number] => [cy - (px * k) / 69.2 / 2, cy + (px * k) / 69.2 / 2];
  fig.layout(place([
    [key, [-6.14, -0.5, ...at_y(3.6, FS(20), 1.7)]],
    [ra1, [-6.12, -4.0, ...at_y(3.12, FS(26))]],
    [ra2, [-3.97, -2.0, ...at_y(3.12, FS(26))]],
    [unit, [-1.87, -1.0, ...at_y(3.12, FS(22))]],
    [plane, [-6.15, -1.05, -2.75, 2.35]],
    [active, [-6.12, 1.0, ...at_y(-3.68, FS(26))]],
    [track, [0.95, 6.45, 1.72, 3.05]],
    [plan_word, [0.95, 6.95, ...at_y(1.0, FS(20), 1.55)]],
    [pad_title, [2.7, 6.45, ...at_y(0.5, FS(20), 1.55)]],
    [pad, [0.95, 6.45, -2.85, 0.25]],
  ]), {
    // (laid out on the 984 px stage the scene was made for, and drawn scaled to the real one, text and all)
    pad: 0,
    design_w: 984,
    // a phone: the pad the hand moves sits right under the plane it changes (both on one screen); the cart after
    phone: column([key, row([ra1, ra2, unit], { phone: 'row', weights: [1.2, 1.2, 0.6], gap: 8 }), plane, pad_title, pad, active, track, plan_word], { gap: 10 }),
  });

  // ---- report (the world and the doctor read it)
  fig.report_with(() => {
    const v = qp_view([p0.peek(), v0.peek()]);
    return { p0: v.x0[0], v0: v.x0[1], feasible: v.feasible, active: v.ids.join(','), wall: v.wall, speed: v.speed, flip: v.flip, a1: v.plan.z[0], a2: v.plan.z[1] };
  });
  // (a clipped plan that keeps every limit is a candidate, so the best plan can only cost less; one that breaks a
  // speed or wall limit may cost less, which is the point of the lesson)
  const keeps = (z: readonly number[], x0: readonly number[]) => ROWS.every((r) => r.g[0] * z[0] + r.g[1] * z[1] <= r.w + r.e[0] * x0[0] + r.e[1] * x0[1] + 1e-6);
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

  // ---- the script: the scene's own steps and timings (one section per beat of the narration)
  const base = [plane, track, cart, wall, flag, pad, state, pad_title, arrow, speed_word];
  const quiet = [...limit_paths, best_contour, best, clip_contour, clipped, no_plan, bad_dots];
  const move = (p_: number, v_: number, dur: number) => over(dur, together(set(p0, p_, 'travel'), set(v0, v_, 'travel')));
  const steps: Step[] = full
    ? [
        over(1.2, reveal(...base)),
        over(0.001, reveal(feasible, ...quiet)),
        beat(),
        over(1.8, together(reveal(center_x, center_arrow, center_word, contours), set(drawn, 1, 'draw'))),
        wait(1.2),
        beat(),
        over(1.2, together(set(fam, 1, 'travel'), reveal(limits_key))),
        wait(0.8),
        beat(),
        over(2.2, set(grow, 1, 'grow')),
        over(0.8, reveal(ra1, ra2, unit, key, active, dots, plan_word)),
        wait(1),
        beat(),
        over(0.8, set(fam, 2, 'travel')),
        over(0.8, set(fam, 3, 'travel')),
        ...(p.clip ? [over(0.5, set(clip_key, 1, 'travel'))] : []),
        wait(0.1),
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
    : [over(1, reveal(...base, ...quiet, feasible, contours, center_x, center_arrow, center_word, limits_key, ra1, ra2, unit, key, active, dots, plan_word)), wait(0.4)];
  fig.script(...steps);
  return fig;
}

export const mpc_qp_plane = define_figure<QpFigureParams>({
  name: 'mpc_qp_plane',
  summary: "The cart's MPC cut to two decisions (a₁ for the first second, a₂ for the second) so the QP can be drawn: cost ellipses around the no-limits plan, each limit (motor, speed, wall) a straight line, the feasible polygon, and the best plan where the smallest ellipse touches it (active limits drawn thick). Drag the cart's state (p₀, v₀): the lines slide, the optimum slides along edges; fast and close, the polygon vanishes (no plan). Shows the clipped no-limits plan for comparison. Exact QP on the toy cart.",
  topics: ['mpc', 'quadratic program', 'constraints', 'active set', 'kkt', 'feasible set', 'level sets', 'control'],
  params: {
    story: { type: 'enum', values: ['full', 'setup'], default: 'full', doc: "'full': the narrated build (cost ellipses, the limits one family at a time, the smallest ellipse touching the polygon, then the state moves); 'setup': everything shown at once at (p0, v0), for a world" },
    p0: { type: 'number', min: 4, max: 9.9, default: 8, doc: 'initial position of the cart [m] (its front bumper; the wall is at 10 m, the flag at 9.5 m)' },
    v0: { type: 'number', min: 0, max: 2, default: 0, doc: 'initial speed [m/s] (the limit is 2)' },
    clip: { type: 'boolean', default: true, doc: 'show the clipped no-limits plan (□) and its cost ellipse, for comparison with the best plan' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { story: 'setup', p0: 9, v0: 0.2 }, { story: 'setup', p0: 9, v0: 0.2, lang: 'zh' }, { story: 'setup', p0: 7.1, v0: 1.9, lang: 'zh' }, { story: 'setup', p0: 9.5, v0: 1.8 }, { story: 'setup', p0: 4, v0: 0, clip: false }],
  ids: ['plane', 'contours', 'feasible', 'best_contour', 'limit_motor', 'limit_speed', 'limit_wall', 'center', 'clipped', 'best', 'legend', 'key', 'readout', 'active', 'track', 'cart', 'plan_dots', 'pad', 'state'],
  figure: qp_figure,
  explore: () => {
    // the pad's handle is part of the figure (its on_end reports 'released'); the world listens through attach()
  },
});
