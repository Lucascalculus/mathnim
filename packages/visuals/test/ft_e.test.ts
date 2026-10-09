// Part E of the fine-tuning course: the numbers the worlds show must match the
// derivations on the pages (part-e-reasoning.md: E1-a/b/c, E2-a, E3-a/c).
import { describe, expect, it } from 'vitest';
import {
  advantages, answer_push, crossing_k, descend, group_mass, kl_forward, kl_reverse, moment_match, pass_at_k, pass_at_k_estimate,
  pass_at_k_plugin, question_set, rloo, sample_group, sharpen, sigmoid, ties, token_weights, toy_step, zero_var_prob, zero_variance, logit,
} from '../src/ft/e/math';

const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol);
const group = (k: number, G = 8) => Array.from({ length: G }, (_, i) => (i < k ? 1 : 0));

describe('group-relative advantages (E1-a)', () => {
  it('2 of 8 right: +1.73 / -0.58 (population std), +1.62 / -0.54 (sample std)', () => {
    const a = advantages(group(2));
    near(a[0], Math.sqrt(3), 1e-3);
    near(a[7], -1 / Math.sqrt(3), 1e-3);
    const s = advantages(group(2), { std_kind: 'sample' });
    near(s[0], 1.62, 0.005);
    near(s[7], -0.54, 0.005);
  });
  it('3 of 8 right: 1.29 / -0.77; 1 of 8: sqrt(7)', () => {
    near(advantages(group(3))[0], 1.291, 1e-3);
    near(advantages(group(3))[7], -0.775, 1e-3);
    near(advantages(group(1))[0], Math.sqrt(7), 1e-3);
  });
  it('advantages always sum to zero; zero-variance groups give exactly 0', () => {
    for (let k = 0; k <= 8; k++) near(advantages(group(k)).reduce((a, b) => a + b, 0), 0, 1e-9);
    expect(zero_variance(group(8))).toBe(true);
    expect(advantages(group(8)).every((x) => x === 0)).toBe(true);
    expect(advantages(group(0)).every((x) => x === 0)).toBe(true);
  });
  it('mean baseline = RLOO × (G-1)/G (step 7)', () => {
    for (const k of [1, 2, 5]) {
      const a = advantages(group(k), { std: false }), b = rloo(group(k));
      a.forEach((x, i) => near(x, (b[i] * 7) / 8, 1e-12));
    }
  });
  it('without a baseline, wrong answers get no push at all (step 4)', () => {
    const a = advantages(group(2), { baseline: false });
    expect(a.slice(2).every((x) => x === 0)).toBe(true);
  });
  it('std normalisation reweights questions by difficulty (E1-c step 4): 0.44 vs 0.66', () => {
    const ratio = (o: { std: boolean }) => group_mass(advantages(group(1), o)) / group_mass(advantages(group(4), o));
    near(ratio({ std: false }), 0.4375, 1e-9);
    near(ratio({ std: true }), Math.sqrt(7 / 64) / 0.5, 1e-3);
  });
});

describe('aggregation and length bias (E1-c)', () => {
  const lengths = [220, 180, 300, 260, 100, 1000, 240, 280];
  const adv = advantages(group(2));
  it("'sequence': a 10× longer wrong answer gets 1/10 of the per-token push", () => {
    const c = token_weights(adv, lengths, 'sequence');
    near(c[5] / c[4], 0.1, 1e-12);
    // ...but the same push on the whole answer
    const w = answer_push(adv, lengths, 'sequence');
    near(w[5], w[4], 1e-12);
  });
  it("'token' and 'constant': equal per-token push for equal advantages", () => {
    for (const agg of ['token', 'constant'] as const) {
      const c = token_weights(adv, lengths, agg);
      near(c[5], c[4], 1e-15);
    }
  });
});

describe('zero-variance groups (E1 segment 7-8)', () => {
  it('p = 0.9, G = 8: 0.43; G = 7 is the smallest group with a signal half the time', () => {
    near(zero_var_prob(0.9, 8), 0.4305, 1e-4);
    near(zero_var_prob(0.5, 8), 0.0078, 1e-4);
    expect(1 - zero_var_prob(0.9, 7)).toBeGreaterThanOrEqual(0.5);
    expect(1 - zero_var_prob(0.9, 6)).toBeLessThan(0.5);
  });
  it('seeded groups are reproducible', () => {
    expect(sample_group(0.4, 8, 11)).toEqual(sample_group(0.4, 8, 11));
  });
});

describe('toy policy update (the world\'s "update one step")', () => {
  it('raises p when some answers are right, does nothing on a zero-variance group', () => {
    const th = logit(0.3);
    expect(sigmoid(toy_step(th, group(3), {}, 1))).toBeGreaterThan(0.3);
    expect(toy_step(th, group(8), {}, 1)).toBe(th);
    expect(toy_step(th, group(0), {}, 1)).toBe(th);
  });
  it('without a baseline only right answers move θ (and θ still rises)', () => {
    const th = logit(0.3), p = 0.3;
    near(toy_step(th, group(2), { baseline: false }, 1) - th, (2 * (1 - p)) / 8, 1e-12);
  });
});

describe('pass@k (E2-a)', () => {
  it('unbiased estimator: n=16, c=2, k=4 gives 0.45; plug-in gives 0.41', () => {
    near(pass_at_k_estimate(16, 2, 4), 1 - 1001 / 1820, 1e-12);
    near(pass_at_k_plugin(16, 2, 4), 0.414, 1e-3);
    expect(pass_at_k_estimate(8, 0, 8)).toBe(0);
    expect(pass_at_k_estimate(8, 1, 8)).toBe(1);
  });
  it('sharpening keeps p = 0 at 0, raises p above the threshold, lowers p below it', () => {
    expect(sharpen(0, 2)).toBe(0);
    expect(sharpen(0.5, 1)).toBeGreaterThan(0.5);
    expect(sharpen(0.02, 1)).toBeLessThan(0.02);
    near(sharpen(0.3, 0), 0.3, 1e-12);
  });
  it('the default question set: sharpening raises pass@1, lowers pass@256, and the curves cross', () => {
    const base = question_set(24, 3);
    expect(base.length).toBe(24);
    expect(base.filter((p) => p === 0).length).toBe(4);
    const rl = base.map((p) => sharpen(p, 1, 0.1));
    expect(pass_at_k(rl, 1)).toBeGreaterThan(pass_at_k(base, 1) + 0.08);
    expect(pass_at_k(rl, 256)).toBeLessThan(pass_at_k(base, 256));
    const k = crossing_k(base, rl, 256)!;
    expect(k).toBeGreaterThan(2);
    expect(k).toBeLessThan(128);
  });
  it('lifting one unsolved question from 0 to 0.01 adds about 1/24 · 0.92 at k = 256 and almost nothing at k = 1', () => {
    const base = question_set(24, 3);
    const lifted = base.slice();
    lifted[0] = 0.01;
    near(pass_at_k(lifted, 256) - pass_at_k(base, 256), (1 - 0.99 ** 256) / 24, 1e-9);
    expect(pass_at_k(lifted, 1) - pass_at_k(base, 1)).toBeLessThan(0.001);
  });
});

describe('forward and reverse KL on two peaks (E3 world)', () => {
  const even = { w: 0.5, d: 2, s0: 0.6 }, uneven = { w: 0.7, d: 2, s0: 0.6 };
  it('forward KL is minimised by moment matching: μ = 0, σ ≈ 2.09, KL ≈ 0.555', () => {
    const m = moment_match(even);
    near(m.mu, 0, 1e-12);
    near(m.sigma, 2.088, 1e-3);
    near(kl_forward(m.mu, m.sigma, even), 0.555, 0.003);
    // and nearby points are worse
    expect(kl_forward(0.3, 2.088, even)).toBeGreaterThan(kl_forward(0, 2.088, even));
    expect(kl_forward(0, 1.7, even)).toBeGreaterThan(kl_forward(0, 2.088, even));
  });
  it('reverse KL sits on one peak (≈ ln 2) and is large at the moment-matched fit', () => {
    near(kl_reverse(2, 0.6, even), Math.LN2, 0.003);
    near(kl_reverse(0, 2.088, even), 1.273, 0.01);
    near(kl_forward(2, 0.6, even), 10.42, 0.1);
  });
  it('descent on reverse KL from the right ends on the right peak even when the left peak is heavier', () => {
    const path = descend('reverse', 2.5, 1, uneven);
    const [mu, s] = path[path.length - 1];
    near(mu, 2, 0.1);
    near(s, 0.6, 0.1);
    near(kl_reverse(mu, s, uneven), 1.20, 0.03);
    const left = descend('reverse', -2.5, 1, uneven).at(-1)!;
    near(kl_reverse(left[0], left[1], uneven), 0.356, 0.02);
  });
  it('descent on forward KL ends at the moment match from either side', () => {
    const m = moment_match(uneven);
    for (const mu0 of [-3, 3]) {
      const [mu, s] = descend('forward', mu0, 0.8, uneven, { steps: 400 }).at(-1)!;
      near(mu, m.mu, 0.05);
      near(s, m.sigma, 0.05);
    }
  });
});

describe('TIES (E3-c, Q3)', () => {
  it('reproduces the worked example', () => {
    const r = ties([[0.8, -0.1, 0.5, 0.02], [0.6, 0.3, -0.7, 0.01], [-0.1, 0.4, -0.2, 0.9]], 2);
    expect(r.sign).toEqual([1, 1, -1, 1]);
    r.merged.forEach((v, j) => near(v, [0.7, 0.4, -0.7, 0.9][j], 1e-12));
  });
});
