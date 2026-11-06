// A linear program with two decisions, solved the way the picture solves it: the feasible set is a polygon, the best
// plan is one of its corners. Pure functions (no figure), so the figure, the lessons' numbers and the tests all read
// the same arithmetic. Every limit is `a1 x1 + a2 x2  <=|>=  b` and both decisions are >= 0.
// (The general solver and the sensitivity report are apps/mathnim/public/frames/kit/lp.js; the figure never needs
// them: two decisions are corners.)
import { t, type L10n } from '@mathnim/engine';

export type XY = [number, number];
export type Op = '<=' | '>=';
export interface Limit { a: XY; op: Op; b: number; /** "Electronic hours" */ name: L10n; /** the name where room is short (a figure's number panel); defaults to name */ short?: L10n; /** "electronic" in a sentence */ unit: L10n }
export interface Problem {
  id: string;
  sense: 'max' | 'min';
  c: XY;
  limits: Limit[];
  /** What each decision counts, for the axes. */
  decisions: [L10n, L10n];
  /** What the objective is called ("profit"). */
  goal: L10n;
  /** The step the objective's level moves in (default 10). */
  zstep?: number;
  /** The picture's window (the decisions' ranges) and its ticks. */
  view: { x: XY; y: XY; x_ticks: number[]; y_ticks: number[] };
}

const EPS = 1e-9;
const dot = (a: XY, p: XY) => a[0] * p[0] + a[1] * p[1];

/** The learner's reading of a limit: how much is used at p, how much is left (negative = broken). */
export function used(l: Limit, p: XY): number { return dot(l.a, p); }
export function left(l: Limit, p: XY): number { return l.op === '<=' ? l.b - dot(l.a, p) : dot(l.a, p) - l.b; }
export function holds(l: Limit, p: XY, tol = EPS): boolean { return left(l, p) >= -tol; }
export function binds(l: Limit, p: XY, tol = 1e-7): boolean { return Math.abs(left(l, p)) <= tol; }
export function feasible(P: Problem, p: XY, tol = EPS): boolean { return p[0] >= -tol && p[1] >= -tol && P.limits.every((l) => holds(l, p, tol)); }
export const value = (P: Problem, p: XY): number => dot(P.c, p);

/** Cut a convex polygon by a half-plane  n·p <= k  (Sutherland-Hodgman). */
function clip(poly: XY[], n: XY, k: number): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = k - dot(n, p), dq = k - dot(n, q);
    if (dp >= -EPS) out.push(p);
    if ((dp > EPS && dq < -EPS) || (dp < -EPS && dq > EPS)) {
      const s = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s]);
    }
  }
  return out;
}

/** The feasible set inside the picture's window, counter-clockwise (empty when no plan keeps every limit). */
export function polygon(P: Problem): XY[] {
  const { x, y } = P.view;
  let poly: XY[] = [[x[0], y[0]], [x[1], y[0]], [x[1], y[1]], [x[0], y[1]]];
  for (const l of P.limits) {
    poly = l.op === '<=' ? clip(poly, l.a, l.b) : clip(poly, [-l.a[0], -l.a[1]], -l.b);
    if (poly.length < 3) return [];
  }
  return poly;
}

/** Where two lines  a·p = b  meet, or null if they are parallel. */
export function meet(a1: XY, b1: number, a2: XY, b2: number): XY | null {
  const det = a1[0] * a2[1] - a1[1] * a2[0];
  if (Math.abs(det) < EPS) return null;
  return [(b1 * a2[1] - b2 * a1[1]) / det, (a1[0] * b2 - a2[0] * b1) / det];
}

/** The corners of the feasible set (all pairs of limit lines and axes that meet inside it), nearest-first by angle. */
export function corners(P: Problem): XY[] {
  const lines: { a: XY; b: number }[] = [{ a: [1, 0], b: 0 }, { a: [0, 1], b: 0 }, ...P.limits.map((l) => ({ a: l.a, b: l.b }))];
  const out: XY[] = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const p = meet(lines[i].a, lines[i].b, lines[j].a, lines[j].b);
    if (p && feasible(P, p, 1e-7) && !out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6)) out.push([Math.max(0, p[0]), Math.max(0, p[1])]);
  }
  const cx = out.reduce((s, p) => s + p[0], 0) / (out.length || 1), cy = out.reduce((s, p) => s + p[1], 0) / (out.length || 1);
  return out.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
}

/** Can the objective improve forever? A direction d >= 0 that keeps every limit true (for any size) and improves it. */
export function runs_away(P: Problem): boolean {
  const better = (d: XY) => (P.sense === 'max' ? dot(P.c, d) > EPS : dot(P.c, d) < -EPS);
  const ok = (d: XY) => d[0] >= -EPS && d[1] >= -EPS && P.limits.every((l) => (l.op === '<=' ? dot(l.a, d) <= EPS : dot(l.a, d) >= -EPS));
  const dirs: XY[] = [[1, 0], [0, 1]];
  for (const l of P.limits) dirs.push([-l.a[1], l.a[0]], [l.a[1], -l.a[0]]);
  return dirs.some((d) => ok(d) && better(d));
}

export interface Solution {
  status: 'optimal' | 'infeasible' | 'unbounded';
  /** The best corner (the first, when several tie). */
  best?: XY;
  /** Every corner that ties for best (two = a whole edge of best plans). */
  ties: XY[];
  z?: number;
}

export function solve(P: Problem): Solution {
  const cs = corners(P);
  if (!cs.length) return { status: 'infeasible', ties: [] };
  if (runs_away(P)) return { status: 'unbounded', ties: [] };
  const sign = P.sense === 'max' ? 1 : -1;
  const z = Math.max(...cs.map((p) => sign * value(P, p))) * sign;
  const ties = cs.filter((p) => Math.abs(value(P, p) - z) < 1e-7);
  return { status: 'optimal', best: ties[0], ties, z };
}

/** The line  c·p = z  cut to a box, or null if it misses the box. */
export function line_in(a: XY, z: number, x: XY, y: XY): [XY, XY] | null {
  const pts: XY[] = [];
  const push = (p: XY) => { if (!pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9)) pts.push(p); };
  const near = (v: number, lo: number, hi: number) => v >= lo - 1e-9 && v <= hi + 1e-9;
  if (Math.abs(a[1]) > EPS) for (const xx of x) { const yy = (z - a[0] * xx) / a[1]; if (near(yy, y[0], y[1])) push([xx, yy]); }
  if (Math.abs(a[0]) > EPS) for (const yy of y) { const xx = (z - a[1] * yy) / a[0]; if (near(xx, x[0], x[1])) push([xx, yy]); }
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}

/** The part of the line  c·p = z  that lies in the feasible set: the plans that earn exactly z. Null when it misses. */
export function level_in_feasible(P: Problem, z: number): [XY, XY] | null {
  const full = line_in(P.c, z, [-1e6, 1e6], [-1e6, 1e6]);
  if (!full) return null;
  const poly = polygon(P);
  if (poly.length < 3) return null;
  // clip the infinite line to the convex polygon: parametrise p(s) = p0 + s d and keep the s inside every edge
  const [p0, p1] = full, d: XY = [p1[0] - p0[0], p1[1] - p0[1]];
  let lo = -Infinity, hi = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const n: XY = [-(b[1] - a[1]), b[0] - a[0]]; // inward normal of a counter-clockwise polygon
    const num = dot(n, [p0[0] - a[0], p0[1] - a[1]]), den = dot(n, d);
    if (Math.abs(den) < EPS) { if (num < -1e-9) return null; continue; }
    const s = -num / den;
    if (den > 0) lo = Math.max(lo, s); else hi = Math.min(hi, s);
  }
  if (!(lo <= hi + 1e-12)) return null;
  return [[p0[0] + lo * d[0], p0[1] + lo * d[1]], [p0[0] + hi * d[0], p0[1] + hi * d[1]]];
}

// ------------------------------------------------------------------ the problems the lessons use
const CE_VIEW = { x: [0, 40] as XY, y: [0, 45] as XY, x_ticks: [0, 10, 20, 30, 40], y_ticks: [0, 10, 20, 30, 40] };
const SHADER_VIEW = { x: [0, 65] as XY, y: [0, 105] as XY, x_ticks: [0, 10, 20, 30, 40, 50, 60], y_ticks: [0, 20, 40, 60, 80, 100] };
const ELECTRONIC: Limit = { a: [4, 3], op: '<=', b: 240, name: t('Electronic hours', '电子工时'), unit: t('electronic hours', '电子工时') };
const ASSEMBLY: Limit = { a: [2, 1], op: '<=', b: 100, name: t('Assembly hours', '装配工时'), unit: t('assembly hours', '装配工时') };
const XPOD = t('x-pods made', '生产的 x-pod 数');
const BLUEBERRY = t('BlueBerrys made', '生产的 BlueBerry 数');
const PROFIT = t('profit', '利润');

export const PROBLEMS: Record<string, Problem> = {
  // Shader Electronics (Week 1): the lecturer's running example. Best plan 30 x-pods and 40 BlueBerrys, $410.
  shader: { id: 'shader', sense: 'max', c: [7, 5], limits: [ELECTRONIC, ASSEMBLY], decisions: [XPOD, BLUEBERRY], goal: PROFIT, view: SHADER_VIEW },
  // The same limits, but the profit line is parallel to the electronic wall: a whole edge of best plans.
  alternative: { id: 'alternative', sense: 'max', c: [4, 3], limits: [ELECTRONIC, ASSEMBLY], decisions: [XPOD, BLUEBERRY], goal: PROFIT, view: SHADER_VIEW },
  // Plus a promise that cannot be kept: at least 60 x-pods, though assembly only allows 50.
  infeasible: {
    id: 'infeasible', sense: 'max', c: [7, 5], decisions: [XPOD, BLUEBERRY], goal: PROFIT, view: SHADER_VIEW,
    limits: [ELECTRONIC, ASSEMBLY, { a: [1, 0], op: '>=', b: 60, name: t('Contract: at least 60 x-pods', '合同：至少 60 个 x-pod'), unit: t('x-pods', 'x-pod') }],
  },
  // Only minimums: nothing stops the plan from growing, so the profit grows with it.
  unbounded: {
    id: 'unbounded', sense: 'max', c: [7, 5], decisions: [XPOD, BLUEBERRY], goal: PROFIT, view: SHADER_VIEW,
    limits: [
      { a: [1, 1], op: '>=', b: 30, name: t('Order: at least 30 in all', '订单：合计至少 30 件'), unit: t('units', '件') },
      { a: [1, 0], op: '>=', b: 10, name: t('Contract: at least 10 x-pods', '合同：至少 10 个 x-pod'), unit: t('x-pods', 'x-pod') },
    ],
  },
  // An extra packing limit that no plan ever reaches: it changes nothing.
  redundant: {
    id: 'redundant', sense: 'max', c: [7, 5], decisions: [XPOD, BLUEBERRY], goal: PROFIT, view: SHADER_VIEW,
    limits: [ELECTRONIC, ASSEMBLY, { a: [1, 1], op: '<=', b: 120, name: t('Packing capacity', '包装能力'), unit: t('units packed', '包装件数') }],
  },
  // Consolidated Electronics (Week 1, the minimisation): training programs for the least cost. Best plan 8 and 17, $216 000.
  consolidated: {
    id: 'consolidated', sense: 'min', c: [10000, 8000], zstep: 1000, view: CE_VIEW, goal: t('cost', '成本'),
    decisions: [t('teaming programs', '团队协作培训场数'), t('problem-solving programs', '问题解决培训场数')],
    limits: [
      { a: [3, 2], op: '<=', b: 84, name: t('Consultant days', '顾问天数'), short: t('Consultant', '顾问'), unit: t('consultant days', '顾问天数') },
      { a: [1, 0], op: '>=', b: 8, name: t('Teaming (Manager 1)', '团队协作（经理 1）'), short: t('Teaming', '团队协作'), unit: t('teaming programs', '团队协作场数') },
      { a: [0, 1], op: '>=', b: 10, name: t('Problem solving (Manager 2)', '问题解决（经理 2）'), short: t('Problem solving', '问题解决'), unit: t('problem-solving programs', '问题解决场数') },
      { a: [1, 1], op: '>=', b: 25, name: t('All programs (senior level)', '培训总场数（高层）'), short: t('All programs', '总场数'), unit: t('programs', '场') },
    ],
  },
};
