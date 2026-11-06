// The decision trees of lesson 11 rolled back: every node's value is the double common.py's roll() computes (printed by
// Python from the trees l11_sample_info.py builds), and the chosen branches are the paper's.
import { describe, expect, it } from 'vitest';
import { TREES, defaults, flatten, fmt_value, roll } from '../src/mgmt/tree';

// (preorder, as Python's repr printed them)
const PY = {
  carpool: [26.630999999999997, 25.4, 30, 30, 30, 25.4, 25, 45, 29.2, 30.000000000000004, 30, 30, 29.2, 25, 45, 30, 30, 30, 30, 45, 25, 45],
  pdc: [15.934699999999998, 15.934699999999998, 18.259999999999998, 7.9399999999999995, 8, 7, 13.46, 14, 5, 18.259999999999998, 20, -9,
    8.149999999999999, 7.35, 8, 7, 8.149999999999999, 14, 5, 1.1499999999999995, 20, -9, 14.2, 7.800000000000001, 8, 7, 12.200000000000001, 14, 5, 14.2, 20, -9],
};

describe('rolling back as common.py does', () => {
  for (const id of ['carpool', 'pdc'] as const)
    it(`${id}: every node's value is Python's, to the last bit`, () => {
      const tree = TREES[id], flat = flatten(tree.root), r = roll(flat, tree.sense, defaults(tree));
      expect(r.v).toEqual(PY[id]);
    });
  it('the carpool strategy: expressway if clear or overcast, Queen City Avenue if it rains; 26.6 minutes', () => {
    const tree = TREES.carpool, flat = flatten(tree.root), r = roll(flat, 'min', defaults(tree));
    const routes = flat.filter((f) => f.k === 'decision').map((f) => (f.node.k === 'decision' ? f.node.kids[r.best[f.i]].e.en : ''));
    expect(routes).toEqual(['EW', 'EW', 'QC']);
    expect(fmt_value(r.v[0], tree.dp)).toBe('26.6');
  });
  it('PDC: conduct the study; large if favourable, medium if not; 15.93 (14.2 without the study)', () => {
    const tree = TREES.pdc, flat = flatten(tree.root), r = roll(flat, 'max', defaults(tree));
    const picks = flat.filter((f) => f.k === 'decision').map((f) => (f.node.k === 'decision' ? f.node.kids[r.best[f.i]].e.en : ''));
    expect(picks).toEqual(['Conduct', 'Large', 'Medium', 'Large']);
    expect([fmt_value(r.v[0], 2), fmt_value(r.v[22], 2)]).toEqual(['15.93', '14.2']);
  });
  it('a hand on P(open | overcast) flips the overcast route at 0.75 (a tie keeps the first branch, as roll() does)', () => {
    const tree = TREES.carpool, flat = flatten(tree.root), o = flat.find((f) => f.e?.en === 'Overcast')!;
    const at = (q: number) => roll(flat, 'min', { ...defaults(tree), qO: q }).best[o.i];
    expect([at(0.79), at(0.76), at(0.75), at(0.74), at(0.2)]).toEqual([1, 1, 0, 0, 0]);
  });
  it('a hand on P(strong | favourable): the study stops paying below 0.87, and large gives way to medium below 0.70', () => {
    const tree = TREES.pdc, flat = flatten(tree.root), fav = flat.find((f) => f.e?.en === 'Favourable')!;
    const at = (q: number) => {
      const r = roll(flat, 'max', { ...defaults(tree), qF: q });
      return [r.best[0], r.best[fav.i]];
    };
    expect([at(0.94), at(0.87), at(0.86), at(0.71), at(0.69)]).toEqual([[0, 2], [0, 2], [1, 2], [1, 2], [1, 1]]);
  });
  it('the heights put the payoffs first and the root last', () => {
    const flat = flatten(TREES.pdc.root);
    expect(flat[0].height).toBe(4);
    expect(flat.filter((f) => f.height === 1)).toHaveLength(9);
  });
});
