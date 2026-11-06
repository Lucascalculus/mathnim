// MGMT90141 lesson 11 on the engine: a decision tree rolled back, right to left. The tree is the exam's (squares are
// decisions, circles are chances, payoffs at the ends); the point is the rollback. At a circle, each branch's value
// times its probability travels into the circle and adds up to its expected value; at a square, the branches' values
// travel in, the better one is kept and the others are cut (the exam's double stroke) and greyed with everything behind
// them. Then a hand on one probability recomputes every value and every choice live, so a decision flips where it
// should. The arithmetic is tree.ts (common.py's roll(), tested); the figure only draws it.
//
// One tree, two compositions of the same things. Wide: the tree as the exam draws it, time running left to right, every
// payoff in a column at the right; a branch's name sits on its line (the line breaks for it, as a dimension line does on
// a drawing) and a node's value stands above the node, where the numbers travel to. On a phone: the tree laid out top to
// bottom as an outline, one node per row, depth by indent, every value in one column at the right, where the numbers
// travel up into their node. A big tree (PDC's 18 payoffs) is laid out at a design width and drawn to the stage's size,
// so its words never fall under 12 px on the page's 16:9 stage.
import {
  Figure, Label, Marker, Path, Plot, Spacer, beat, column, derive, font_of, hide, over, reveal, row, set, t, text_width, together, wait,
  type Param, type Step, type XY,
} from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../mpc/kit';
import * as TR from './tree';

export interface TreeParams extends Record<string, unknown> {
  tree: string;
  story: string;
  hand: string;
  lang: string;
}

export class TreeFigure extends Figure {
  q: Param<number> | null = null;
  /** The probability under the hand, for the world and the doctor. */
  set_prob(v: number): void {
    this.q?.set(v, true);
  }
}

/** A node's half size (CSS px): squares and circles alike. */
const R = 8;
/** Wide: from a node's edge to its trunk, and from the trunk to a branch's name (the cut stands between). */
const TRUNK = 12, CUT_ROOM = 17;

interface Geo {
  /** Each node's point (CSS px in the data area). */
  at: XY[];
  /** The pieces of each node's trunk and of the branch into each node (polylines, CSS px). */
  trunk: XY[][][];
  branch: XY[][][];
  /** Each node's value: the right end of its words, at their middle (its label stands to the left of that point): wide,
   * above the node; on a phone, in the column at the right. */
  value_at: XY[];
  /** A leaf's payoff and a branch's name: the left end of the words, at their middle. */
  pay_at: XY[];
  name_at: XY[];
  /** Where the cut on the branch into a node stands. */
  cut_at: XY[];
  /** The root's question: the right end of its words, at their middle. */
  question_at: XY;
}

/** The first share u of polylines, by their total length (a tree being drawn on, piece after piece). */
function cut_pieces(pieces: XY[][], u: number): XY[][] {
  if (u >= 1) return pieces;
  const len = (pl: XY[]) => pl.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pl[i][0], p[1] - pl[i][1]), 0);
  let left = Math.max(0, u) * pieces.reduce((s, pl) => s + len(pl), 0);
  const out: XY[][] = [];
  for (const pl of pieces) {
    if (left <= 0) break;
    const kept: XY[] = [pl[0]];
    for (let i = 1; i < pl.length && left > 0; i++) {
      const L = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
      kept.push(L <= left ? pl[i] : [pl[i - 1][0] + ((pl[i][0] - pl[i - 1][0]) * left) / L, pl[i - 1][1] + ((pl[i][1] - pl[i - 1][1]) * left) / L]);
      left -= L;
    }
    out.push(kept);
  }
  return out;
}

export function tree_figure(p: TreeParams): TreeFigure {
  const lang = figure_lang(p.lang);
  const tree = TR.TREES[p.tree] ?? TR.TREES.carpool;
  const story = ['roll', 'shown', 'draw'].includes(p.story) ? p.story : 'roll';
  const valued = story !== 'draw';
  const hand = !valued || p.hand === 'none' ? null : p.hand !== 'auto' && tree.vars[p.hand] ? p.hand : tree.hand;
  const fig = new TreeFigure({ lang });
  const flat = TR.flatten(tree.root), n = flat.length;
  const leaves = flat.filter((f) => f.k === 'leaf'), inner = flat.filter((f) => f.k !== 'leaf');
  const L10 = (x: { en: string; zh: string } | undefined) => (x ? x[lang] : '');
  const payoff = (i: number) => (flat[i].node as { value: number }).value;
  const root_label = (tree.root as { label?: { en: string; zh: string } }).label;

  // ---- state: the probability under the hand; every value and choice is derived from it
  const vars0 = TR.defaults(tree);
  const q = hand ? (fig.q = fig.param('q', vars0[hand], { range: [0, 1], step: 0.01, says: tree.vars[hand].says, doc: `the probability ${hand}` })) : null;
  const VARS = derive(() => (q && hand ? { ...vars0, [hand]: q.value } : vars0), 'the probabilities');
  const RB = derive(() => TR.roll(flat, tree.sense, VARS.value), 'the rollback');
  const prob_of = (i: number) => TR.prob(flat[i].p ?? 0, VARS.value);
  const uses_hand = (i: number) => !!hand && typeof flat[i].p === 'object' && (flat[i].p as { v: string }).v === hand;
  const fmt_v = (v: number) => TR.fmt_value(v, tree.dp);

  // ---- where the hand's slider goes on a wide stage: under the tree while its rows still have room for words, else
  // in the tree's emptiest corner (beside the root's first or last branch, whichever has more rows beyond it)
  const row_of: number[] = new Array(n).fill(0);
  leaves.forEach((f, j) => (row_of[f.i] = j + 0.5));
  for (let i = n - 1; i >= 0; i--) if (flat[i].kids.length) row_of[i] = flat[i].kids.reduce((s, k) => s + row_of[k], 0) / flat[i].kids.length;
  const crowded = leaves.length > 12;
  const corner = row_of[flat[0].kids[0]] > leaves.length - row_of[flat[0].kids[flat[0].kids.length - 1]] ? 'top-left' : 'bottom-left';

  // ---- the plot the tree is drawn in: its own coordinates are 0..1; every place is a rule on the box it is given
  const rh_phone = n > 24 ? 21 : 24;
  const P = fig.plot({
    id: 'tree', x: [0, 1], y: [0, 1], axes: 'none', numbers: false, grid: false, priority: 2, phone_aspect: 333 / (n * rh_phone),
    says: t('the decision tree: squares are decisions, circles are chances, payoffs at the ends', '决策树：方块是决策，圆圈是机会，末端是收益'),
  });
  const fonts = { name: () => font_of('label', { weight: 400 }), bold: () => font_of('label', { weight: 600 }), big: () => font_of('readout', { weight: 600 }) };
  const width = (s: string, f: keyof typeof fonts = 'name') => text_width(s, fonts[f]());
  // (room for the widest a probability or a value can be, so nothing moves as the hand moves)
  const prob_room = (i: number) => Math.max(width(TR.fmt_prob(TR.prob(flat[i].p ?? 0, vars0))), width('0.00'));
  const widest = Math.max(...leaves.map((f) => Math.abs(payoff(f.i))));
  const room = (parent: number) => (flat[parent].k === 'decision' ? CUT_ROOM : 7);
  const words_w = (i: number) => width(L10(flat[i].e)) + (flat[i].p !== undefined ? 6 + prob_room(i) : 0);

  const values: (Label | null)[] = new Array(n).fill(null);

  let cache = '', G: Geo | null = null;
  const geo = (): Geo => {
    const W = P.data.w, H = P.data.h, key = `${W}|${H}|${fig.phone}|${lang}|${hand ? VARS.value[hand] : ''}`;
    if (G && key === cache) return G;
    cache = key;
    const at: XY[] = new Array(n), trunk: XY[][][] = new Array(n).fill([]), branch: XY[][][] = new Array(n).fill([]);
    const value_at: XY[] = new Array(n), pay_at: XY[] = new Array(n), name_at: XY[] = new Array(n), cut_at: XY[] = new Array(n);
    let question_at: XY;
    // (the root's value is the answer: set large on a wide stage, as one value of the column on a phone)
    if (values[0]) values[0].o.kind = fig.phone ? 'label' : 'readout';
    if (!fig.phone) {
      // rows: a leaf to a row, a node at the middle of its branches
      const rh = H / leaves.length;
      for (const f of flat) at[f.i] = [0, row_of[f.i] * rh];
      // columns: each as wide as the words on its branches need, the room left over shared equally; payoffs at the right
      const deep = Math.max(...inner.map((f) => f.depth));
      const into_node = (k: number) => R + TRUNK + room(flat[k].parent) + words_w(k) + 12 + R;
      const into_leaf = (k: number) => R + TRUNK + room(flat[k].parent) + words_w(k) + 10;
      const col = Array.from({ length: deep }, (_, d) => Math.max(0, ...inner.filter((f) => f.depth === d).flatMap((f) => f.kids.filter((k) => flat[k].k !== 'leaf').map(into_node))));
      const root_w = Math.max(root_label ? width(L10(root_label), 'bold') : 0, valued ? width(`−${fmt_v(widest)}.00`, 'big') : 0);
      const x0 = root_w + 8 + R;
      const xs = [x0];
      for (let d = 0; d < deep; d++) xs.push(xs[d] + col[d]);
      const pay_w = Math.max(...leaves.map((f) => width(fmt_v(payoff(f.i)), 'bold')));
      const xL = W - pay_w - 6;
      const need = Math.max(...inner.filter((f) => f.kids.some((k) => flat[k].k === 'leaf')).map((f) => xs[f.depth] + Math.max(...f.kids.map(into_leaf))));
      const per = (xL - need) / (deep + 1);
      for (const f of inner) at[f.i][0] = xs[f.depth] + f.depth * per;
      for (const f of leaves) at[f.i][0] = xL;
      for (const f of inner) {
        const [x, y] = at[f.i], xt = x + R + TRUNK, ys = f.kids.map((k) => at[k][1]);
        trunk[f.i] = [[[x + R, y], [xt, y]], [[xt, Math.min(...ys)], [xt, Math.max(...ys)]]];
        for (const k of f.kids) {
          // (only a square's branches can be cut: a circle's names start nearer its trunk; the line breaks for the words as written)
          const yk = at[k][1], n0 = xt + room(f.i), n1 = n0 + width(L10(flat[k].e)) + (flat[k].p !== undefined ? 6 + width(TR.fmt_prob(prob_of(k))) : 0);
          const end = flat[k].k === 'leaf' ? xL : at[k][0] - R;
          name_at[k] = [n0, yk];
          cut_at[k] = [xt + 8, yk];
          if (flat[k].k === 'leaf') {
            pay_at[k] = [xL + 5, yk];
            branch[k] = [[[xt, yk], [n0 - 4, yk]], [[n1 + 4, yk], [end, yk]]];
          } else {
            // (above the node, its right end at the node's: clear of the trunk the node's own branches leave from)
            value_at[k] = [at[k][0] + R + 1, yk - 21];
            branch[k] = [[[xt, yk], [n0 - 4, yk]], [[n1 + 4, yk], [end, yk]]];
          }
        }
      }
      value_at[0] = [x0 - R - 6, at[0][1]];
      question_at = [x0 - R - 6, at[0][1] - (valued ? 27 : 0)];
    } else {
      // one node per row in reading order, depth by indent, values right-aligned in one column
      const rh = H / n, deep = Math.max(...flat.map((f) => f.depth));
      const ind = Math.min(20, (W * 0.3) / Math.max(1, deep));
      for (const f of flat) at[f.i] = [R + 2 + f.depth * ind, (f.i + 0.5) * rh];
      for (const f of flat) {
        const [x, y] = at[f.i], end = f.k === 'leaf' ? x - 4 : x - R;
        name_at[f.i] = [f.k === 'leaf' ? end + 5 : x + R + 6, y];
        value_at[f.i] = [W - 2, y];
        if (f.k === 'leaf') pay_at[f.i] = [W - 2 - width(fmt_v(payoff(f.i)), 'bold'), y];
        if (f.parent >= 0) {
          const xp = at[f.parent][0];
          cut_at[f.i] = [(xp + end) / 2, y];
          branch[f.i] = [[[xp, y], [end, y]]];
        }
        if (f.kids.length) trunk[f.i] = [[[x, y + R], [x, Math.max(...f.kids.map((k) => at[k][1]))]]];
      }
      question_at = [at[0][0] + R + 6 + (root_label ? width(L10(root_label), 'bold') : 0), at[0][1]];
    }
    G = { at, trunk, branch, value_at, pay_at, name_at, cut_at, question_at };
    return G;
  };
  // css px in the data area → the plot's coordinates, and → the figure's
  const D = (a: XY): XY => [a[0] / P.data.w, 1 - a[1] / P.data.h];
  const px = (a: XY): XY => [P.data.x + a[0], P.data.y + a[1]];

  // ---- what a cut greys out: a node behind a decision's rejected branch, once that decision has been made
  const cuts: (Path | null)[] = new Array(n).fill(null);
  const dead = (i: number) => valued && flat[i].above.some((a) => (cuts[a.at]?.opacity.value ?? 0) > 0.5 && RB.value.best[a.at] !== a.slot);
  const unless_dead = (i: number, role: string) => () => (dead(i) ? 'muted' : role);

  // ---- the tree: trunks, branches, nodes (drawn on in time order, a depth at a time)
  const deep = Math.max(...flat.map((f) => f.depth));
  const grown = Array.from({ length: deep + 1 }, (_, d) => fig.param(`grown_${d}`, story === 'shown' || d === 0 ? 1 : 0, { range: [0, 1], doc: `the branches into depth ${d} drawn` }));
  const lines = (pieces: () => XY[][], u: Param<number>) => () => cut_pieces(pieces(), u.value).map((pl) => pl.map(D));
  const trunks: Path[] = [], branches: Path[] = [], nodes: (Marker | null)[] = new Array(n).fill(null);
  for (const f of inner) {
    const path = new Path(lines(() => geo().trunk[f.i], grown[Math.min(deep, f.depth + 1)]), { id: `trunk_${f.i}`, role: 'text', width: 2 });
    path.role_of = () => (dead(f.i) ? 'scaffold' : 'text');
    trunks.push(P.add(path));
  }
  for (const f of flat) {
    if (f.parent >= 0) {
      const b = new Path(lines(() => geo().branch[f.i], grown[f.depth]), { id: `branch_${f.i}`, role: 'text', width: 2, says: f.e });
      b.role_of = () => (dead(f.i) ? 'scaffold' : 'text');
      branches.push(P.add(b));
    }
    if (f.k !== 'leaf') {
      const after = f.e ? { en: `: after ${f.e.en}`, zh: `：${f.e.zh}之后` } : { en: '', zh: '' };
      const m = new Marker(() => D(geo().at[f.i]), {
        id: `node_${f.i}`, role: 'text', shape: f.k === 'decision' ? 'square' : 'ring', r: R, clip: false,
        says: f.k === 'decision' ? t(`a decision${after.en}`, `一个决策${after.zh}`) : t(`a chance${after.en}`, `一个机会${after.zh}`),
      });
      m.role_of = () => (dead(f.i) ? 'scaffold' : 'text');
      nodes[f.i] = P.add(m);
    }
  }

  // ---- words on the tree: a branch's name and probability, the payoffs, the root's question
  const names: (Label | null)[] = new Array(n).fill(null), probs: (Label | null)[] = new Array(n).fill(null), pays: (Label | null)[] = new Array(n).fill(null);
  for (const f of flat) {
    if (f.parent < 0) continue;
    names[f.i] = fig.label(() => L10(f.e), () => px(geo().name_at[f.i]), { id: `name_${f.i}`, avoid: false, sides: ['right'], gap: 0, weight: 400 });
    names[f.i]!.role_of = unless_dead(f.i, 'text');
    if (f.p !== undefined) {
      probs[f.i] = fig.label(() => TR.fmt_prob(prob_of(f.i)), () => {
        const a = geo().name_at[f.i];
        return px([a[0] + width(L10(f.e)) + 6, a[1]]);
      }, { id: `prob_${f.i}`, avoid: false, sides: ['right'], gap: 0, weight: 400 });
      // (the probabilities under the hand keep its colour, cut or not: they are what it moves)
      probs[f.i]!.role_of = () => (uses_hand(f.i) ? 'noun:chance' : 'muted');
    }
    if (f.k === 'leaf') {
      pays[f.i] = fig.label(() => fmt_v(payoff(f.i)), () => px(geo().pay_at[f.i]), { id: `pay_${f.i}`, avoid: false, sides: ['right'], gap: 0, weight: 600 });
      pays[f.i]!.role_of = unless_dead(f.i, 'text');
    }
  }
  const question = root_label ? fig.label(() => L10(root_label), () => px(geo().question_at), { id: 'question', avoid: false, sides: ['left'], gap: 0, weight: 600 }) : null;

  // ---- the values: every node's, the numbers on their way in, the cuts
  const tokens: (Label | null)[] = new Array(n).fill(null), fly: (Param<number> | null)[] = new Array(n).fill(null);
  if (valued) {
    for (const f of inner) {
      values[f.i] = fig.label(() => fmt_v(RB.value.v[f.i]), () => px(geo().value_at[f.i]), {
        id: `value_${f.i}`, avoid: false, sides: ['left'], gap: 0, weight: 600,
        says: f.parent < 0 ? t(`the value of the best strategy (${tree.goal.en})`, `最优策略的值（${tree.goal.zh}）`) : t('its value, rolled back', '倒推出的值'),
      });
      values[f.i]!.role_of = unless_dead(f.i, 'noun:expected-value');
      if (f.k === 'decision') {
        cuts[f.i] = P.add(new Path(() => {
          const g = geo(), best = RB.value.best[f.i], out: XY[][] = [];
          f.kids.forEach((k, s) => {
            if (s === best) return;
            const [x, y] = g.cut_at[k];
            for (const dx of [-2.5, 2.5]) out.push([D([x + dx - 3, y + 6]), D([x + dx + 3, y - 6])]);
          });
          return out;
        }, { id: `cut_${f.i}`, role: 'noun:cut', width: 2.25, z: 3, says: t('the rejected branches, cut', '被舍弃的分支，划掉') }));
      }
    }
    // a number on its way into its node: a probability times a value into a circle, a value into a square
    const centre = (i: number): XY => {
      const g = geo();
      if (flat[i].k === 'leaf') return [g.pay_at[i][0] + width(fmt_v(payoff(i)), 'bold') / 2, g.pay_at[i][1]];
      return [g.value_at[i][0] - width(fmt_v(RB.value.v[i]), i === 0 && !fig.phone ? 'big' : 'bold') / 2, g.value_at[i][1]];
    };
    for (const f of flat) {
      if (f.parent < 0) continue;
      const k = (fly[f.i] = fig.param(`fly_${f.i}`, 0, { range: [0, 1], doc: `the value of node ${f.i} travelling into its parent` }));
      const par = flat[f.parent];
      tokens[f.i] = fig.label(() => {
        const v = RB.value.v[f.i], vs = fmt_v(v);
        return par.k === 'chance' ? `${TR.fmt_prob(prob_of(f.i))}×${v < 0 ? `(${vs})` : vs}` : vs;
      }, () => {
        const u = k.value, a = centre(f.i), b = centre(f.parent);
        return px([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
      }, { id: `token_${f.i}`, avoid: false, sides: ['center'], gap: 0, weight: 600, role: 'noun:expected-value' });
    }
  }

  // ---- the hand: a slider for one probability, its name in the colour of the branches it moves
  let track: Plot | null = null;
  if (q && hand) {
    track = new Plot({ id: 'prob_track', x: [0, 1], y: [0, 1], x_ticks: [0, 0.5, 1], grid: false, axes: 'x', numbers: false, aspect: 14, max_aspect: 0.12 });
    fig.handle(track, q, null, { id: 'prob_handle', says: tree.vars[hand].says });
    const T = track, line = () => T.data.y + T.data.h;
    // (wide, under the tree: the name before the track; in a corner or on a phone: the name above it)
    const name_before = () => !fig.phone && !crowded;
    const name_w = () => width(L10(tree.vars[hand].says));
    fig.label(() => L10(tree.vars[hand].says), () => (name_before() ? [T.data.x - 16, line()] : [T.data.x - 2 + name_w(), line() - 26]), { id: 'prob_name', avoid: false, sides: ['left'], gap: 0, weight: 400, role: 'noun:chance' });
    fig.label(() => q.value.toFixed(2), () => [T.data.x + T.data.w + 20, line()], { id: 'prob_value', avoid: false, sides: ['right'], gap: 0, weight: 600, role: 'noun:chance' });
    if (crowded) P.inset(track, corner, { w: 150, pad: corner === 'top-left' ? 32 : 18 });
  }

  // ---- layout
  const phone_hand = track ? [new Spacer(30), row([track, new Spacer(0)], { weights: [3, 1], phone: 'row' }), new Spacer(10)] : [];
  if (!track) fig.layout(P, crowded ? { design_w: 780 } : {});
  // (a big tree: laid out at 780 px and drawn to the stage, so 15 px words are still 12 px on a 624 px stage)
  else if (crowded) fig.layout(P, { phone: column([P, ...phone_hand], { gap: 0 }), design_w: 780 });
  else fig.layout(column([P, row([new Spacer(0), track, new Spacer(0)], { weights: [1.25, 2, 0.55], phone: 'row' }), new Spacer(8)], { gap: 10 }), { phone: column([P, ...phone_hand], { gap: 0 }) });
  fig.aside(tree.source);

  // ---- report and checks
  fig.report_with(() => {
    const r = RB.peek();
    return {
      tree: tree.id, prob: q ? q.peek() : null, value: r.v[0],
      strategy: flat.filter((f) => f.k === 'decision').map((f) => (f.node.k === 'decision' ? f.node.kids[r.best[f.i]].e.en : '')),
    };
  });
  fig.check('every chance node’s probabilities add to 1', () => {
    for (const f of inner) if (f.k === 'chance') {
      const s = f.kids.reduce((a, k) => a + prob_of(k), 0);
      if (Math.abs(s - 1) > 1e-9) return `node ${f.i}: ${s}`;
    }
    return null;
  });
  fig.check('a square keeps its better branch, a circle its expected value', () => {
    const r = RB.peek(), sign = tree.sense === 'max' ? 1 : -1;
    for (const f of inner) {
      const kv = f.kids.map((k) => r.v[k]);
      if (f.k === 'decision' && (kv.some((v) => sign * v > sign * r.v[f.i] + 1e-12) || r.v[f.i] !== kv[r.best[f.i]])) return `decision ${f.i} kept ${r.v[f.i]} of ${kv}`;
      if (f.k === 'chance' && Math.abs(f.kids.reduce((a, k) => a + prob_of(k) * r.v[k], 0) - r.v[f.i]) > 1e-9) return `chance ${f.i}`;
    }
    return null;
  });
  if (valued) fig.check('the values written are the values rolled back', () => {
    for (const f of inner) if (values[f.i]!.text(lang) !== fmt_v(RB.peek().v[f.i])) return `node ${f.i} says ${values[f.i]!.text(lang)}`;
    return null;
  });

  // ---- the script: the tree in time order, then the rollback from the payoffs back, a height at a time
  const words_of = (fs: TR.Flat[]) => fs.flatMap((f) => [names[f.i], probs[f.i], pays[f.i], nodes[f.i]]).filter(Boolean) as (Label | Marker)[];
  const first = [P, ...trunks, ...branches, ...(question ? [question] : []), ...(nodes[0] ? [nodes[0]] : [])];
  const vals = (fs: TR.Flat[]) => fs.map((f) => values[f.i]).filter(Boolean) as Label[];
  if (story === 'shown') {
    fig.script(over(0.6, reveal(...first, ...words_of(flat), ...vals(inner), ...(cuts.filter(Boolean) as Path[]))), wait(0.2));
    // (the numbers on their way in belong to the rollback: when it is not played they never show)
    for (const k of tokens) k?.opacity.set(0);
    return fig;
  }
  const drawn: Step[] = [over(0.4, reveal(...first))];
  for (let d = 1; d <= deep; d++) drawn.push(together(over(0.45, set(grown[d], 1, 'draw')), over(0.35, reveal(...words_of(flat.filter((f) => f.depth === d))))));
  if (story === 'draw') {
    fig.script(...drawn, wait(0.4));
    return fig;
  }
  const heights = [...new Set(inner.map((f) => f.height))].sort((a, b) => a - b);
  const rolled: Step[] = heights.flatMap((h, hi): Step[] => {
    const here = inner.filter((f) => f.height === h), kids = here.flatMap((f) => f.kids);
    const toks = kids.map((k) => tokens[k]!), decided = here.filter((f) => f.k === 'decision').map((f) => cuts[f.i]!);
    return [
      over(0.2, reveal(...toks)),
      together(...kids.map((k) => over(1.0, set(fly[k]!, 1, 'travel')))),
      together(over(0.3, hide(...toks)), over(0.35, reveal(...vals(here)))),
      ...(decided.length ? [over(0.45, reveal(...decided))] : []),
      wait(0.35),
      ...(hi < heights.length - 1 ? [beat()] : []),
    ];
  });
  fig.script(...drawn, beat(), ...rolled, wait(0.4));
  return fig;
}

export const mgmt_tree = define_figure<TreeParams>({
  name: 'mgmt_tree',
  summary: "A decision tree rolled back right to left (the exam's squares, circles and payoffs): at each circle the branch values times their probabilities travel in and add up to the expected value; at each square the better branch is kept and the others are cut. A hand on one probability recomputes every value and choice live, so a decision flips at its threshold. Trees: the 2025 exam's carpool (minutes, smaller is better) and PDC with the market study ($ millions).",
  topics: ['decision analysis', 'decision tree', 'expected value', 'rollback', 'sample information', 'Bayes'],
  params: {
    tree: { type: 'enum', values: Object.keys(TR.TREES), default: 'carpool', doc: "'carpool': 2025 exam Q4, weather then route (QC 30 min; EW 25 open / 45 jammed) with the rounded posteriors, min, 26.6 minutes; 'pdc': the lecture's PDC with the market study (favourable 0.77; posteriors 0.94 / 0.35; no study prior 0.8), max, 15.93 ($ millions) against 14.2" },
    story: { type: 'enum', values: ['roll', 'draw', 'shown'], default: 'roll', doc: "'roll': the tree drawn in time order, then rolled back from the payoffs (numbers travel into each node, squares cut their worse branches); 'draw': only the tree, drawn in time order (no values); 'shown': rolled back at once" },
    hand: { type: 'enum', values: ['auto', 'none', 'qC', 'qO', 'qR', 'pF', 'qF', 'qU', 'q0'], default: 'auto', doc: "the probability the slider moves: 'auto' (carpool: qO = P(open | overcast), whose route flips at 0.75; pdc: qF = P(strong | favourable): the study stops paying below 0.87, large gives way to medium below 0.70), 'none', or a name of the tree's: carpool qC qO qR; pdc pF qF qU q0" },
    lang: LANG_SPEC,
  },
  examples: [
    {}, { lang: 'zh' }, { tree: 'pdc' }, { tree: 'pdc', lang: 'zh' }, { story: 'draw' }, { tree: 'pdc', story: 'shown', hand: 'pF' },
    { story: 'shown', hand: 'none', lang: 'zh' }, { tree: 'pdc', story: 'draw', lang: 'zh' },
  ],
  ids: ['tree', 'node_0', 'branch_1', 'value_0'],
  figure: tree_figure,
  explore: () => {},
});
