// A decision tree rolled back the way the exam does it: at a chance node (a circle) the expected value of what follows,
// at a decision node (a square) the better branch. Pure functions (no figure), so the figure, the tests and the
// lessons read the same arithmetic. The rule and its order of operations are common.py's roll() exactly (the same sums
// in the same order, ties go to the first branch), and the trees are l11_sample_info.py's, with the paper's
// probabilities rounded to two places before they are used (0.98, not 0.9784), as the paper's answer does.
import { t, type L10n } from '@mathnim/engine';

/** A probability on a chance branch: a number as printed, or a named one (which a hand may move), or its complement. */
export type Prob = number | { v: string; not?: boolean };
export type TreeNode =
  | { k: 'leaf'; value: number }
  | { k: 'chance'; label?: L10n; kids: { e: L10n; p: Prob; node: TreeNode }[] }
  | { k: 'decision'; label?: L10n; kids: { e: L10n; node: TreeNode }[] };

export interface Tree {
  id: string;
  sense: 'max' | 'min';
  root: TreeNode;
  /** The named probabilities (two-way chance nodes: the complement is 1 − p, rounded as the paper rounds). */
  vars: Record<string, { value: number; says: L10n }>;
  /** The probability a hand moves by default. */
  hand: string;
  /** Decimals the values are shown with (the paper's: 26.6 minutes, 15.93 million). */
  dp: number;
  /** What the root's value is, beside the number. */
  goal: L10n;
  /** What the tree is and where it is from (small print under the figure). */
  source: L10n;
}

/** Python's round(v, d): the exact decimal value of the double, ties to even (JS's toFixed sends ties away from zero). */
export function round_py(v: number, d = 2): number {
  if (!Number.isFinite(v)) return v;
  // (toFixed(100) writes a double's exact expansion for |v| above 1e-14; smaller values round to 0 at any d used here)
  const s = Math.abs(v).toFixed(100), [ip, fp] = s.split('.');
  let n = BigInt(ip + fp.slice(0, d));
  const rest = fp.slice(d), half = '5'.padEnd(rest.length, '0');
  if (rest > half || (rest === half && n % 2n === 1n)) n += 1n;
  const r = Number(n) / 10 ** d;
  return v < 0 && r !== 0 ? -r : r;
}

/** The value of a probability given the named ones (each rounded to two places, as a hand snaps them). */
export function prob(p: Prob, vars: Record<string, number>): number {
  if (typeof p === 'number') return p;
  const v = round_py(vars[p.v] ?? 0, 2);
  return p.not ? round_py(1 - v, 2) : v;
}

/** A node of the tree flattened in reading order (preorder), with what the layout and the script need. */
export interface Flat {
  i: number;
  k: TreeNode['k'];
  node: TreeNode;
  parent: number;
  /** Its place among its parent's branches. */
  slot: number;
  depth: number;
  /** Distance from the payoffs (a leaf 0; a node whose branches all end in payoffs 1): the order it is rolled back in. */
  height: number;
  kids: number[];
  /** The branch into it: its name and, under a chance node, its probability. */
  e?: L10n;
  p?: Prob;
  /** The decision branches on the way from the root to it (parent index, slot), for cuts that grey it out. */
  above: { at: number; slot: number }[];
}

export function flatten(root: TreeNode): Flat[] {
  const out: Flat[] = [];
  const walk = (node: TreeNode, parent: number, slot: number, depth: number, e: L10n | undefined, p: Prob | undefined, above: Flat['above']): number => {
    const i = out.length;
    const f: Flat = { i, k: node.k, node, parent, slot, depth, height: 0, kids: [], e, p, above };
    out.push(f);
    if (node.k === 'chance') node.kids.forEach((c, s) => f.kids.push(walk(c.node, i, s, depth + 1, c.e, c.p, above)));
    else if (node.k === 'decision') node.kids.forEach((c, s) => f.kids.push(walk(c.node, i, s, depth + 1, c.e, undefined, [...above, { at: i, slot: s }])));
    f.height = f.kids.length ? 1 + Math.max(...f.kids.map((k) => out[k].height)) : 0;
    return i;
  };
  walk(root, -1, 0, 0, undefined, undefined, []);
  return out;
}

export interface Rolled {
  /** Each node's value (flattened order): a payoff, an expected value, or the better branch's value. */
  v: number[];
  /** At each decision node, the branch chosen (its slot); -1 elsewhere. */
  best: number[];
}

/** common.py's roll(): the same sums in the same order (so the same doubles), ties to the first branch. */
export function roll(flat: Flat[], sense: 'max' | 'min', vars: Record<string, number>): Rolled {
  const v = new Array<number>(flat.length).fill(0), best = new Array<number>(flat.length).fill(-1);
  for (let i = flat.length - 1; i >= 0; i--) {
    const f = flat[i], n = f.node;
    if (n.k === 'leaf') v[i] = n.value;
    else if (n.k === 'chance') v[i] = n.kids.reduce((s, c, j) => s + prob(c.p, vars) * v[f.kids[j]], 0);
    else {
      let b = 0;
      for (let j = 1; j < f.kids.length; j++) {
        const a = v[f.kids[j]], cur = v[f.kids[b]];
        if (sense === 'max' ? a > cur : a < cur) b = j;
      }
      best[i] = b;
      v[i] = v[f.kids[b]];
    }
  }
  return { v, best };
}

/** The probabilities' defaults. */
export const defaults = (tree: Tree): Record<string, number> => Object.fromEntries(Object.entries(tree.vars).map(([k, x]) => [k, x.value]));

// ------------------------------------------------------------------ writing numbers as the paper does
/** A value: the tree's decimals, trailing zeros dropped, a true minus sign (26.6, 30, −9, 15.93). */
export function fmt_value(v: number, dp: number): string {
  const r = round_py(v, dp);
  return String(r === 0 ? 0 : r).replace('-', '−');
}
/** A probability as printed on a branch (0.695, 0.09, 0, 1). */
export const fmt_prob = (p: number): string => String(round_py(p, 3));

// ------------------------------------------------------------------ the trees the lessons use
const leaf = (value: number): TreeNode => ({ k: 'leaf', value });
const OPEN = t('Open', '畅通'), JAMMED = t('Jammed', '堵车');
const STRONG = t('Strong', '强'), WEAK = t('Weak', '弱');

// The 2025 exam, Question 4: the weather first (its probabilities from Bayes, three places), then the route, then the
// traffic with the posterior for that weather (two places). Queen City Avenue takes 30 minutes whatever the traffic;
// the expressway 25 when open, 45 when jammed. Minutes: the smaller is better.
const route = (q: string): TreeNode => ({
  k: 'decision',
  kids: [
    { e: t('QC', 'QC'), node: { k: 'chance', kids: [{ e: OPEN, p: { v: q }, node: leaf(30) }, { e: JAMMED, p: { v: q, not: true }, node: leaf(30) }] } },
    { e: t('EW', 'EW'), node: { k: 'chance', kids: [{ e: OPEN, p: { v: q }, node: leaf(25) }, { e: JAMMED, p: { v: q, not: true }, node: leaf(45) }] } },
  ],
});
const CARPOOL: Tree = {
  id: 'carpool', sense: 'min', dp: 1, hand: 'qO',
  root: {
    k: 'chance', label: t('Weather', '天气'),
    kids: [
      { e: t('Clear', '晴'), p: 0.695, node: route('qC') },
      { e: t('Overcast', '阴'), p: 0.215, node: route('qO') },
      { e: t('Rain', '雨'), p: 0.09, node: route('qR') },
    ],
  },
  vars: {
    qC: { value: 0.98, says: t('P(open | clear)', 'P(畅通 | 晴)') },
    qO: { value: 0.79, says: t('P(open | overcast)', 'P(畅通 | 阴)') },
    qR: { value: 0, says: t('P(open | rain)', 'P(畅通 | 雨)') },
  },
  goal: t('expected minutes', '期望分钟数'),
  source: t('The 2025 exam, Question 4 (minutes on the road). QC = Queen City Avenue, EW = expressway. Posteriors rounded to two places, as the paper does.',
    '2025 年考题第 4 题（路上的分钟数）。QC = Queen City 大道，EW = 高速公路。后验概率和试卷一样取两位小数。'),
};

// PDC (the lecture, week 6): pay for the market study or not. With the study, the report comes first (favourable 0.77),
// then the size of the complex, then demand with the posterior for that report; without it, the prior (strong 0.8).
// $ millions: the larger is better. Rolled back: 15.93 with the study, 14.2 without.
const sizes = (p: Prob, q: Prob): TreeNode => ({
  k: 'decision',
  kids: ([[t('Small', '小'), 8, 7], [t('Medium', '中'), 14, 5], [t('Large', '大'), 20, -9]] as const).map(([e, a, b]) => ({
    e, node: { k: 'chance' as const, kids: [{ e: STRONG, p, node: leaf(a) }, { e: WEAK, p: q, node: leaf(b) }] },
  })),
});
const PDC: Tree = {
  id: 'pdc', sense: 'max', dp: 2, hand: 'qF',
  root: {
    k: 'decision', label: t('Research?', '做不做调研？'),
    kids: [
      {
        e: t('Conduct', '做调研'),
        node: {
          k: 'chance', label: t('Conduct the study', '做调研'),
          kids: [
            { e: t('Favourable', '有利'), p: { v: 'pF' }, node: sizes({ v: 'qF' }, { v: 'qF', not: true }) },
            { e: t('Unfavourable', '不利'), p: { v: 'pF', not: true }, node: sizes({ v: 'qU' }, { v: 'qU', not: true }) },
          ],
        },
      },
      { e: t('No study', '不做'), node: sizes({ v: 'q0' }, { v: 'q0', not: true }) },
    ],
  },
  vars: {
    pF: { value: 0.77, says: t('P(favourable report)', 'P(报告有利)') },
    qF: { value: 0.94, says: t('P(strong | favourable)', 'P(需求强 | 有利)') },
    qU: { value: 0.35, says: t('P(strong | unfavourable)', 'P(需求强 | 不利)') },
    q0: { value: 0.8, says: t('P(strong demand)', 'P(需求强)') },
  },
  goal: t('expected value, $ millions', '期望值（百万美元）'),
  source: t('PDC, the lecture’s example ($ millions). Posteriors rounded to two places, as in the lecture.',
    'PDC，课上的例子（单位：百万美元）。后验概率和课上一样取两位小数。'),
};

export const TREES: Record<string, Tree> = { carpool: CARPOOL, pdc: PDC };
