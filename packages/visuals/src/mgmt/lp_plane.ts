// MGMT90141 lesson 1 on the engine: the plan plane of a linear program with two decisions. A point is a whole plan;
// each limit is a wall with a side that is allowed; what the walls leave is the feasible set; the profit line is a
// level of the objective, and the best plan is where it leaves the set last. One figure, four hands (`tool`):
//   look   no hand, the picture only
//   plan   drag a plan: what it earns, what each limit says about it (used / available), whether it is allowed
//   sweep  drag the profit line along its normal: the plans on it that are allowed are drawn thick; it dies at the best plan
//   walls  drag a limit's wall: the region, the best plan and what it earns follow (the limits that hold the best plan are thick)
// The arithmetic is lp2d.ts (tested); the figure only draws it.
import {
  Figure, Handle, Marker, Path, Region, beat, column, derive, over, reveal, row, set, t, wait,
  type Param, type Step, type XY,
} from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../mpc/kit';
import * as LP from './lp2d';

export interface LpPlaneParams extends Record<string, unknown> {
  problem: string;
  tool: string;
  story: string;
  plan: number[];
  level: number;
  best: boolean;
  corners: boolean;
  lang: string;
}

const NOUN = ['limit-a', 'limit-b', 'limit-c', 'limit-d'];
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const snap = (x: number, step: number) => Math.round(x / step) * step;
// (a thousand separator in TeX: 216{,}000)
const group = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');
const num = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? (Math.abs(v) >= 10000 ? group(String(Math.round(v))) : String(Math.round(v))) : v.toFixed(1));
const money = (v: number) => `\\$${num(v)}`;
const coef = (a: number, v: string) => (a === 1 ? v : a === 0 ? '' : `${num(a)}${v}`);
/** "4x_1 + 3x_2 \le 240" */
const limit_tex = (l: LP.Limit, b: number) => {
  const parts = [coef(l.a[0], 'x_1'), coef(l.a[1], 'x_2')].filter(Boolean);
  return `${parts.join(' + ')} ${l.op === '<=' ? '\\le' : '\\ge'} ${num(b)}`;
};

export class LpFigure extends Figure {
  x1!: Param<number>;
  x2!: Param<number>;
  /** The state for the world and the doctor (snapped to the grid). */
  set_plan(a: number, b: number): void {
    this.x1.set(a, true);
    this.x2.set(b, true);
  }
}

export function lp_plane_figure(p: LpPlaneParams): LpFigure {
  const lang = figure_lang(p.lang);
  const prob = LP.PROBLEMS[p.problem] ?? LP.PROBLEMS.shader;
  const tool = ['look', 'plan', 'sweep', 'walls'].includes(p.tool) ? p.tool : 'look';
  const build = p.story === 'build';
  const L = (en: string, zh: string) => (lang === 'zh' ? zh : en);
  const fig = new LpFigure({ lang });
  const { view } = prob;

  // ---- state: the plan the learner holds, the profit level, and each limit's right-hand side
  const x1 = (fig.x1 = fig.param('x1', clamp(p.plan[0], view.x[0], view.x[1]), { range: view.x, step: 1, doc: 'plan: first decision', says: prob.decisions[0] }));
  const x2 = (fig.x2 = fig.param('x2', clamp(p.plan[1], view.y[0], view.y[1]), { range: view.y, step: 1, doc: 'plan: second decision', says: prob.decisions[1] }));
  const c = prob.c, cc = c[0] * c[0] + c[1] * c[1];
  // the objective's level: its handle moves a free point, the level is that point's value, snapped
  const zstep = prob.zstep ?? 10;
  const zmax = Math.floor(Math.min(view.x[1] * cc / Math.max(c[0], 1e-9), view.y[1] * cc / Math.max(c[1], 1e-9)) / zstep) * zstep;
  const sx = fig.param('sx', (p.level * c[0]) / cc, { range: view.x, doc: 'the profit line: handle x' });
  const sy = fig.param('sy', (p.level * c[1]) / cc, { range: view.y, doc: 'the profit line: handle y' });
  const level = derive(() => (tool === 'sweep' ? clamp(snap(c[0] * sx.value + c[1] * sy.value, zstep), 0, zmax) : p.level), 'profit level');
  // each wall: a free point on it; moving it changes the limit's right-hand side (snapped)
  const bstep = (b: number) => (b >= 150 ? 10 : 5);
  const wx = prob.limits.map((l, i) => fig.param(`wx${i}`, 0, { range: view.x, doc: `wall ${i + 1}: handle x` }));
  const wy = prob.limits.map((l, i) => fig.param(`wy${i}`, 0, { range: view.y, doc: `wall ${i + 1}: handle y` }));
  const first = prob.limits.map((l) => LP.line_in(l.a, l.b, view.x, view.y));
  prob.limits.forEach((l, i) => {
    const seg = first[i];
    if (seg) { wx[i].set((seg[0][0] + seg[1][0]) / 2, true); wy[i].set((seg[0][1] + seg[1][1]) / 2, true); }
  });
  const rhs = prob.limits.map((l, i) => derive(() => (tool === 'walls' ? clamp(snap(l.a[0] * wx[i].value + l.a[1] * wy[i].value, bstep(l.b)), 0.3 * l.b, 1.7 * l.b) : l.b), `limit ${i + 1}`));
  const PR = derive((): LP.Problem => ({ ...prob, limits: prob.limits.map((l, i) => ({ ...l, b: rhs[i].value })) }), 'the problem');
  const SOL = derive(() => LP.solve(PR.value), 'the solution');
  const POLY = derive(() => LP.polygon(PR.value), 'the feasible set');
  // (the corners the picture shows: a corner out of the window, which a wall pushed far out can make, is not drawn)
  const COR = derive(() => LP.corners(PR.value).filter((q) => q[0] <= view.x[1] + 1e-9 && q[1] <= view.y[1] + 1e-9), 'the corners');
  const plan = (): LP.XY => [x1.value, x2.value];
  // what the picture talks about: the learner's plan, or the best plan
  // (the best plan is the answer a lesson asks the learner to predict: it is only shown when the lesson says so)
  const shows_best = p.best || tool === 'walls';
  const focus = (): LP.XY | null => (tool === 'plan' ? plan() : shows_best ? SOL.value.best ?? null : null);
  const draw = prob.limits.map((l, i) => fig.param(`draw${i}`, build ? 0 : 1, { range: [0, 1], doc: `wall ${i + 1} drawn` }));

  // ---- the plane
  const plane = fig.plot({
    id: 'plane', x: view.x, y: view.y, x_ticks: view.x_ticks, y_ticks: view.y_ticks, priority: 2,
    phone_aspect: 1.05, x_label: { text: { en: `x₁ · ${prob.decisions[0].en}`, zh: `x₁ · ${prob.decisions[0].zh}` } }, y_label: { text: { en: `x₂ · ${prob.decisions[1].en}`, zh: `x₂ · ${prob.decisions[1].zh}` } },
    says: t('the plan plane: each point is a whole plan (x₁, x₂)', '计划平面：每个点是一份完整的计划 (x₁, x₂)'),
  });
  const region = plane.add(new Region(() => POLY.value, { id: 'feasible', role: 'region:feasible', says: t('the plans that keep every limit', '守住所有限制的计划') }));

  // a wall's words stand on the side nobody is allowed on, at the stand along the wall where they hide least
  type Side = 'above-right' | 'above-left' | 'below-right' | 'below-left';
  const outward = (l: LP.Limit): Side => {
    const d: LP.XY = l.op === '<=' ? [l.a[0], l.a[1]] : [-l.a[0], -l.a[1]];
    return `${d[1] >= 0 ? 'above' : 'below'}-${d[0] >= 0 ? 'right' : 'left'}` as Side;
  };
  // one wall per limit: thin when it has room, thick when it holds the plan the picture talks about
  const walls: Path[] = [], holds: Path[] = [], words: ReturnType<typeof fig.label>[] = [];
  prob.limits.forEach((l, i) => {
    const seg = () => {
      const s = LP.line_in(l.a, rhs[i].value, view.x, view.y);
      return s ? [s] : [];
    };
    const tight = () => {
      const f = focus();
      return f && LP.binds({ ...l, b: rhs[i].value }, f) ? seg() : [];
    };
    walls.push(plane.add(new Path(seg, { id: `limit_${i + 1}`, role: `noun:${NOUN[i]}`, upto: draw[i], says: l.name })));
    holds.push(plane.add(new Path(tight, { id: `holds_${i + 1}`, role: `active:${NOUN[i]}`, z: 2.4 })));
    words.push(fig.label(() => limit_tex(l, rhs[i].value), walls[i], { id: `word_${i + 1}`, tex: true, role: `noun:${NOUN[i]}`, along: true, sides: [outward(l), 'above-right', 'above-left', 'below-right', 'below-left'], gap: 8, style: { size: 15 } }));
  });

  // the profit line: the whole line thin, the allowed part of it thick (the plans that earn exactly this much)
  const profit_line = plane.add(new Path(() => {
    if (tool !== 'sweep' && !(p.level > 0)) return [];
    const s = LP.line_in(c, level.value, view.x, view.y);
    return s && level.value > 0 ? [s] : [];
  }, { id: 'profit_line', role: 'noun:profit', says: t('a profit line: every plan on it earns the same', '利润线：线上每个计划赚的一样多') }));
  const profit_ok = plane.add(new Path(() => {
    if (tool !== 'sweep' && !(p.level > 0)) return [];
    const s = LP.level_in_feasible(PR.value, level.value);
    return s && level.value > 0 ? [s] : [];
  }, { id: 'profit_allowed', role: 'active:profit', z: 2.5 }));

  // corners: the candidates, with what each earns
  const MAXC = 6;
  const corner_marks: Marker[] = [];
  for (let k = 0; k < MAXC; k++) {
    corner_marks.push(plane.add(new Marker(() => (p.corners && POLY.value.length ? ((COR.value[k] as XY) ?? null) : null), { id: `corner_${k + 1}`, role: 'noun:feasible', shape: 'dot', r: 5, says: t('a corner of the feasible set', '可行域的一个角') })));
    fig.label(() => {
      const q = COR.value[k];
      return q ? money(LP.value(PR.value, q as LP.XY)) : '';
    }, () => (p.corners && POLY.value.length ? ((COR.value[k] as XY) ?? null) : null), { id: `corner_value_${k + 1}`, own: [corner_marks[k]], tex: true, role: 'text', sides: ['above-right', 'above-left', 'below-right', 'below-left', 'right', 'above', 'below', 'left'], on: plane, within: () => plane.data, gap: 6, style: { size: 14 } });
  }

  // the best plan (a truth, solid) and the plan in hand (a guess, hollow)
  const best = plane.add(new Marker(() => (shows_best && SOL.value.best ? (SOL.value.best as XY) : null), { id: 'best', role: 'truth:best-plan', shape: 'dot', r: 8, says: t('the best plan', '最优计划') }));
  const mine = plane.add(new Marker(() => (tool === 'plan' ? plan() : null), { id: 'plan', role: 'guess:plan', shape: 'dot', r: 8, says: t('the plan in hand', '手里的计划') }));

  // ---- the hands
  const hand = (id: string, px: Param<number>, py: Param<number>, says: ReturnType<typeof t>, at?: () => XY): Handle => {
    const h = new Handle(px, py, { id, says, at, on_move: () => fig.emit('dragged', fig.report()) });
    h.opacity.set(0);
    plane.add(h);
    fig.handles.push(h);
    return h;
  };
  if (tool === 'plan') hand('plan_handle', x1, x2, t('the plan (x₁, x₂)', '计划 (x₁, x₂)'));
  if (tool === 'sweep') hand('profit_handle', sx, sy, t('the profit line', '利润线'), () => plane.P([(level.value * c[0]) / cc, (level.value * c[1]) / cc]));
  // (each wall's handle sits a different share of the way along it, so two handles never crowd the corner they share)
  const along = [0.25, 0.75, 0.4, 0.6];
  if (tool === 'walls') prob.limits.forEach((l, i) => hand(`wall_handle_${i + 1}`, wx[i], wy[i], t(`the ${l.name.en.toLowerCase()} wall`, `${l.name.zh}的墙`), () => {
    const s = LP.line_in(l.a, rhs[i].value, view.x, view.y);
    return plane.P(s ? [s[0][0] + along[i] * (s[1][0] - s[0][0]), s[0][1] + along[i] * (s[1][1] - s[0][1])] : [0, 0]);
  }));

  // ---- the numbers beside the plane
  const earns = fig.readout([
    { text: () => (tool === 'look' && !shows_best ? '' : prob.goal[lang]), size: 17, color: 'ink2' },
    { gap: 0.4 },
    { tex: () => {
      if (tool === 'plan') return money(LP.value(PR.value, plan()));
      if (tool === 'sweep') return level.value > 0 ? money(level.value) : '';
      if (!shows_best) return '';
      const s = SOL.value;
      return s.status === 'optimal' ? money(s.z!) : '\\text{---}';
    } },
  ], { id: 'goal', role: 'noun:profit', style: { size: 30, weight: 600 }, says: t('what the plan earns', '这个计划赚多少') });
  const here = (i: 0 | 1) => (): string => {
    const f = focus();
    return f ? num(f[i]) : '';
  };
  const where = fig.readout([
    { tex: () => (focus() ? 'x_1 =' : '') }, { gap: 0.15 }, { tex: here(0) },
    { gap: 0.7 },
    { tex: () => (focus() ? 'x_2 =' : '') }, { gap: 0.15 }, { tex: here(1) },
  ], { id: 'where', style: { size: 20 }, says: t('the plan', '计划') });
  const bound = (l: LP.Limit, i: number) => {
    const f = focus();
    return !!f && LP.binds({ ...l, b: rhs[i].value }, f);
  };
  // a limit's colour follows what the plan does to it: its own, thick when the plan uses it up, vermilion (the wall's) when broken
  const limit_role = (l: LP.Limit, i: number) => () => {
    const f = focus();
    if (f && !LP.holds({ ...l, b: rhs[i].value }, f, 1e-7)) return 'noun:wall';
    return bound(l, i) ? `active:${NOUN[i]}` : `noun:${NOUN[i]}`;
  };
  const used_tex = (l: LP.Limit, i: number) => () => {
    const f = focus();
    return f ? `${num(LP.used(l, f))}\\,/\\,${num(rhs[i].value)}` : '';
  };
  const status = (l: LP.Limit, i: number) => () => {
    const f = focus();
    if (!f) return '';
    const room = LP.left({ ...l, b: rhs[i].value }, f);
    if (room < -1e-7) return L(`over by ${num(-room)}`, `超出 ${num(-room)}`);
    return Math.abs(room) < 1e-7 ? L('all used', '用完') : L(`${num(room)} to spare`, `剩 ${num(room)}`);
  };
  // (two limits: a name over its numbers and what is left; more do not fit a column of a 16:9 stage, so one line each,
  // the colour saying over / used up / room)
  const one_line = prob.limits.length > 2;
  const limit_things: ReturnType<typeof fig.readout>[][] = prob.limits.map((l, i) => one_line
    ? [fig.readout([{ text: () => (l.short ?? l.name)[lang], size: 15 }, { gap: 0.5 }, { tex: used_tex(l, i) }], { id: `limit_row_${i + 1}`, role: limit_role(l, i), style: { size: 16 }, says: l.name })]
    : [
        fig.readout([{ text: () => (l.short ?? l.name)[lang] }], { id: `limit_name_${i + 1}`, role: limit_role(l, i), style: { size: 16 }, says: l.name }),
        fig.readout([{ tex: used_tex(l, i) }, { gap: 0.5 }, { text: status(l, i), size: 15, color: 'ink2' }], { id: `limit_row_${i + 1}`, role: limit_role(l, i), style: { size: 18 } }),
      ]);
  const limit_blocks = limit_things.map((ts) => (ts.length === 1 ? ts[0] : column(ts, { gap: 2 })));
  const verdict = fig.readout([
    { text: () => {
      if (tool === 'plan') return LP.feasible(PR.value, plan()) ? L('allowed: keeps every limit', '允许：守住所有限制') : L('not allowed: breaks a limit', '不允许：破坏了某条限制');
      const s = SOL.value;
      if (tool === 'sweep' && level.value > 0) return LP.level_in_feasible(PR.value, level.value) ? L('allowed plans reach it', '有允许的计划能达到') : L('no allowed plan reaches it', '没有允许的计划能达到');
      if (!shows_best) return '';
      if (s.status === 'infeasible') return L('no plan keeps every limit', '没有任何计划能守住所有限制');
      if (s.status === 'unbounded') return L('the profit has no top', '利润没有上限');
      if (s.ties.length > 1) return L('a whole edge of best plans', '一整条边上都是最优计划');
      return '';
    } },
  ], { id: 'verdict', role: () => {
    if (tool === 'plan') return LP.feasible(PR.value, plan()) ? 'noun:feasible' : 'noun:wall';
    if (tool === 'sweep') return LP.level_in_feasible(PR.value, level.value) ? 'noun:feasible' : 'noun:wall';
    return SOL.value.status === 'optimal' ? 'noun:feasible' : 'noun:wall';
  }, style: { size: 17 } });

  // (while the learner is still predicting the best plan, the sweep and the picture have no use for the plan's numbers)
  const numbers_on = tool === 'plan' || shows_best;
  const limits_block = column(limit_blocks, { gap: one_line ? 6 : 14 });
  const side = [earns, ...(numbers_on ? [where, limits_block] : []), verdict];
  fig.layout(row([plane, column(side, { gap: 14 })], { weights: [1.7, 1], gap: 24 }), {
    phone: column([plane, ...side], { gap: 10 }),
  });

  // ---- report and checks
  fig.report_with(() => {
    const pr = LP.polygon(PR.peek());
    const s = LP.solve(PR.peek());
    return { problem: prob.id, tool, plan: [x1.peek(), x2.peek()], allowed: LP.feasible(PR.peek(), [x1.peek(), x2.peek()]), value: LP.value(PR.peek(), [x1.peek(), x2.peek()]), level: level.peek(), best: s.best ?? null, best_value: s.z ?? null, status: s.status, corners: pr.length };
  });
  fig.check('the best plan is allowed and no corner beats it', () => {
    const s = LP.solve(PR.peek());
    if (s.status !== 'optimal') return null;
    if (!LP.feasible(PR.peek(), s.best!)) return 'the best plan breaks a limit';
    const sign = prob.sense === 'max' ? 1 : -1;
    for (const q of LP.corners(PR.peek())) if (sign * LP.value(PR.peek(), q) > sign * s.z! + 1e-7) return `corner (${q}) beats the best`;
    return null;
  });

  // ---- the script: axes, then the walls one by one, then the set they leave, then the corners
  const steps: Step[] = build
    ? [
        over(0.8, reveal(plane)),
        ...prob.limits.flatMap((_, i): Step[] => [over(0.9, set(draw[i], 1, 'draw')), over(0.4, reveal(words[i], holds[i], ...(numbers_on ? limit_things[i] : []))), beat()]),
        over(0.8, reveal(region, earns, ...(numbers_on ? [where] : []), verdict, mine, best, profit_line, profit_ok, ...corner_marks)),
        wait(0.4),
      ]
    : [over(0.6, reveal(plane, region, ...walls, ...holds, ...words, earns, ...(numbers_on ? [where, ...limit_things.flat()] : []), verdict, mine, best, profit_line, profit_ok, ...corner_marks)), wait(0.2)];
  fig.script(...steps);
  return fig;
}

export const mgmt_lp_plane = define_figure<LpPlaneParams>({
  name: 'mgmt_lp_plane',
  summary: 'The plan plane of a linear program with two decisions (Shader Electronics and its special cases): every point is a whole plan, each limit is a wall, the allowed plans are the region the walls leave, and the best plan is a corner. Hands: drag a plan (what it earns, what each limit says), drag the profit line (it dies at the best plan), drag a wall (the best plan and the profit follow).',
  topics: ['linear programming', 'feasible region', 'corner', 'optimal solution', 'constraints', 'binding constraint', 'objective function'],
  params: {
    problem: { type: 'enum', values: Object.keys(LP.PROBLEMS), default: 'shader', doc: "'shader': the lecturer's example (max 7x1+5x2, electronic 4x1+3x2<=240, assembly 2x1+x2<=100, best 30/40 = $410); 'alternative': the profit line parallel to a wall; 'infeasible'; 'unbounded'; 'redundant'; 'consolidated': the minimisation (min 10000x1+8000x2, consultant 3x1+2x2<=84, x1>=8, x2>=10, x1+x2>=25; best 8 and 17 = 216000)" },
    tool: { type: 'enum', values: ['look', 'plan', 'sweep', 'walls'], default: 'look', doc: "what the hand moves: 'look' nothing, 'plan' a plan, 'sweep' the profit line, 'walls' a limit's wall" },
    story: { type: 'enum', values: ['build', 'shown'], default: 'build', doc: "'build': the axes, then the walls one by one, then the set; 'shown': everything at once" },
    plan: { type: 'vector', length: 2, min: 0, max: 110, default: [20, 20], doc: 'the plan in hand to start with [x1, x2] (tool plan)' },
    level: { type: 'number', min: 0, max: 1000000, default: 0, doc: 'the objective line to start with (0: none; tool sweep starts there)' },
    best: { type: 'boolean', default: false, doc: 'show the best plan (hidden while the learner is still predicting it)' },
    corners: { type: 'boolean', default: false, doc: 'mark every corner of the feasible set with what it earns' },
    lang: LANG_SPEC,
  },
  examples: [
    {}, { lang: 'zh' },
    { story: 'shown', tool: 'plan', plan: [20, 20] }, { story: 'shown', tool: 'plan', plan: [40, 40], lang: 'zh' },
    { story: 'shown', tool: 'sweep', level: 300, best: true }, { story: 'shown', tool: 'walls', best: true, corners: true },
    { story: 'shown', problem: 'alternative', level: 240, best: true }, { story: 'shown', problem: 'infeasible' },
    { story: 'shown', problem: 'unbounded' }, { story: 'shown', problem: 'redundant', best: true, tool: 'walls' },
    { story: 'shown', problem: 'consolidated', tool: 'sweep', level: 300000 }, { story: 'shown', problem: 'consolidated', tool: 'plan', plan: [10, 20], lang: 'zh' }, { story: 'shown', problem: 'consolidated', tool: 'walls', best: true, corners: true },
  ],
  ids: ['plane', 'feasible', 'limit_1', 'limit_2', 'profit_line', 'best', 'plan', 'goal', 'verdict'],
  figure: lp_plane_figure,
  explore: () => {},
});
