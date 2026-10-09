// The numbers the part A worlds show must match the formulas on the lesson pages.
import { describe, expect, it } from 'vitest';
import { break_even, per_request } from './cost_crossover';
import { angle_deg, grad_docs, grad_query, loss, push_shares, sgd_step, unit, weights } from './infonce';
import { best_sizes, hits, status } from './chunk_size_recall';
import { CHUNK_DATA } from './data/chunk_recall';

describe('cost model (A1, derivation in part-a-map-rag.md)', () => {
  it('reproduces the worked example: c_A = 0.0135, c_B = 0.0003, N* ≈ 1,515', () => {
    const a = per_request(3000, 3, 300, 15);
    const b = per_request(300, 0.2, 300, 0.8);
    expect(a).toBeCloseTo(0.0135, 10);
    expect(b).toBeCloseTo(0.0003, 10);
    expect(break_even(a, b, 20)).toBeCloseTo(20 / 0.0132, 6);
  });
  it('caching lowers A (input only) and moves N* right', () => {
    const a0 = per_request(3000, 3, 300, 15), a8 = per_request(3000, 3, 300, 15, 0.8, 0.1);
    expect(a8).toBeCloseTo(3000 * 3 * (1 - 0.8 + 0.08) / 1e6 + 300 * 15 / 1e6, 12);
    expect(break_even(a8, 0.0003, 20)).toBeGreaterThan(break_even(a0, 0.0003, 20));
  });
  it('B is never cheaper when c_A <= c_B; F = 0 gives N* = 0', () => {
    expect(break_even(0.001, 0.002, 20)).toBe(Infinity);
    expect(break_even(0.01, 0.001, 0)).toBe(0);
  });
  it('case 9 numbers: c_A = 0.0105, N* ≈ 9,524 at F = 100', () => {
    const a = per_request(2500, 3, 200, 15);
    expect(a).toBeCloseTo(0.0105, 10);
    expect(break_even(a, 0, 100)).toBeCloseTo(100 / 0.0105, 6);
  });
});

describe('InfoNCE (A2b, derivation D-A2-5)', () => {
  const q = unit(Math.PI / 2);
  const docs = [128, 108, 57, 12, -42, 205].map((d) => unit((d * Math.PI) / 180));
  it('weights are a softmax of q·d/τ and the loss is -log w_0', () => {
    const w = weights(q, docs, 0.5);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(loss(q, docs, 0.5)).toBeCloseTo(-Math.log(w[0]), 12);
  });
  it('analytic gradients match finite differences', () => {
    const tau = 0.3, h = 1e-6;
    const g = grad_docs(q, docs, tau);
    for (let j = 0; j < docs.length; j++) for (const k of [0, 1]) {
      const plus = docs.map((d, i) => (i === j ? (k === 0 ? [d[0] + h, d[1]] : [d[0], d[1] + h]) : d)) as any;
      const minus = docs.map((d, i) => (i === j ? (k === 0 ? [d[0] - h, d[1]] : [d[0], d[1] - h]) : d)) as any;
      expect(g[j][k]).toBeCloseTo((loss(q, plus, tau) - loss(q, minus, tau)) / (2 * h), 5);
    }
    const gq = grad_query(q, docs, tau);
    for (const k of [0, 1]) {
      const qp: any = k === 0 ? [q[0] + h, q[1]] : [q[0], q[1] + h], qm: any = k === 0 ? [q[0] - h, q[1]] : [q[0], q[1] - h];
      expect(gq[k]).toBeCloseTo((loss(qp, docs, tau) - loss(qm, docs, tau)) / (2 * h), 5);
    }
  });
  it('the push on negative j is w_j/τ · q, so the shares are w_j renormalised over the negatives', () => {
    const s = push_shares(q, docs, 0.5), w = weights(q, docs, 0.5);
    const neg = w.slice(1).reduce((a, b) => a + b, 0);
    s.slice(1).forEach((x, i) => expect(x).toBeCloseTo(w[i + 1] / neg, 12));
  });
  it('lower τ concentrates the push on the most similar negative (Q-A2-5 numbers)', () => {
    const sims = [0.9, 0.5, 0.3, 0.1, -0.2];
    const share = (tau: number) => Math.exp(0.9 / tau) / sims.reduce((a, s) => a + Math.exp(s / tau), 0);
    expect(share(0.5)).toBeCloseTo(0.4847, 3);
    expect(share(0.05)).toBeGreaterThan(0.999);
  });
  it('one step pulls the positive toward q and pushes negatives away; filtered ones do not move', () => {
    const th = [128, 108, 57, 12, -42, 205].map((d) => (d * Math.PI) / 180), tq = Math.PI / 2;
    const s = sgd_step(tq, th, 0.1, 0.01);
    expect(angle_deg(tq, s.docs[0])).toBeLessThan(angle_deg(tq, th[0]));
    expect(angle_deg(tq, s.docs[1])).toBeGreaterThan(angle_deg(tq, th[1]));
    const f = sgd_step(tq, th, 0.1, 0.01, [true, false, true, true, true, true]);
    expect(f.docs[1]).toBe(th[1]);
  });
});

describe('chunk size under a budget (A2, real data)', () => {
  it('k = floor(B / size); a chunk too big for the budget does not fit', () => {
    for (let q = 0; q < 12; q++) expect(status('en', 1024, 512, 0, q)).toBe('nofit');
  });
  it('the data has 12 questions and every configuration', () => {
    for (const lang of ['en', 'zh']) {
      expect(CHUNK_DATA[lang].questions.length).toBe(12);
      for (const s of [64, 128, 256, 512, 1024]) for (const o of [0, 10, 20]) expect(CHUNK_DATA[lang].configs[`${s}/${o}`].q.length).toBe(12);
    }
  });
  it('at budget 512 the best size is in the middle in both languages', () => {
    for (const lang of ['en', 'zh'] as const) {
      const best = best_sizes(lang, 512, 0);
      expect(best.every((s) => s > 64 && s < 1024)).toBe(true);
      expect(hits(lang, 64, 512, 0)).toBeLessThan(hits(lang, best[0], 512, 0));
    }
  });
});
