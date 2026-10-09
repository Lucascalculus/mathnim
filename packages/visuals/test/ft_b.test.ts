// The numbers the part B lessons state, checked against the visuals' pure math.
import { describe, expect, it } from 'vitest';
import { collate, eos_targets, outcome } from '../src/ft/b/pad_eos_trap';
import { cross_fraction, padding_waste, position_ids } from '../src/ft/b/attention_mask_packing';
import { coverage, expected_kept, rs_yield } from '../src/ft/b/rejection_sampling_yield';
import { flip_prob, n_for_flip, phi, se_gap, simulate_gap } from '../src/ft/b/eval_noise';
import { L_new, L_old, gd } from '../src/ft/b/two_valleys_forgetting';
import { is_assistant_only, loss_share, parts_of } from '../src/ft/b/token_loss_mask';
import { TOKEN_SAMPLES } from '../src/ft/b/token_data';
import { parse_series, preset_curves } from '../src/ft/b/training_curves';

describe('pad = EOS trap (B1)', () => {
  it('masking by id with pad = <|eot_id|> removes every EOS target', () => {
    expect(eos_targets(collate(true, true))).toBe(0);
    expect(eos_targets(collate(false, true))).toBe(2);
    expect(eos_targets(collate(true, false))).toBe(2);
  });
  it('outcomes: never stops / stops / emits but generator ignores', () => {
    expect(outcome(true, true, true)).toBe(1);
    expect(outcome(false, true, true)).toBe(0);
    expect(outcome(false, true, false)).toBe(2);
  });
});

describe('packing (B1 D3)', () => {
  it('padding waste of 100, 300, 900, 200 is 58%', () => expect(padding_waste([100, 300, 900, 200])).toBeCloseTo(1 - 1500 / 3600, 6));
  it('4 x 256 packed naively: 75% of causal cells cross examples', () => expect(cross_fraction([256, 256, 256, 256])).toBeCloseTo(1 - 131584 / 524800, 6));
  it('one long example and three short ones: padding bad, naive packing mild', () => {
    expect(padding_waste([480, 16, 16, 16])).toBeGreaterThan(0.7);
    expect(cross_fraction([480, 16, 16, 16])).toBeLessThan(0.2);
  });
  it('position_ids restart per example only with boundaries', () => {
    expect(position_ids([2, 3], true)).toEqual([0, 1, 0, 1, 2]);
    expect(position_ids([2, 3], false)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('rejection sampling (B2 D1)', () => {
  const kinds = [{ share: 0.3, p: 0.9 }, { share: 0.4, p: 0.3 }, { share: 0.3, p: 0.02 }];
  it('without a cap, kept ∝ n·p: hard problems are ~1.5% of the data', () => {
    const y = rs_yield(kinds, 100, 8, Infinity, 1);
    expect(y.shares[0]).toBeCloseTo(216 / 316.8, 3);
    expect(y.shares[2]).toBeCloseTo(4.8 / 316.8, 3);
    expect(y.per[2].coverage).toBeCloseTo(1 - 0.98 ** 8, 6);
  });
  it('cap 1 per problem lifts hard problems to ~6%', () => {
    const y = rs_yield(kinds, 100, 8, 1, 1);
    expect(y.shares[2]).toBeCloseTo(0.062, 2);
  });
  it('E[min(X, c)] matches brute force and n·p without a cap', () => {
    expect(expected_kept(8, 0.3, Infinity)).toBeCloseTo(2.4, 9);
    expect(expected_kept(8, 0.3, 1)).toBeCloseTo(1 - 0.7 ** 8, 9);
    expect(coverage(64, 0.02)).toBeCloseTo(0.7256, 3);
    expect(coverage(16, 0.05)).toBeCloseTo(0.56, 2);
  });
  it('the world goal: budget <= 1600 and hard share >= 10% is reachable two ways', () => {
    const a = rs_yield(kinds, 100, 8, 1, 4), b = rs_yield(kinds, 100, 16, 1, 1);
    expect(a.budget).toBe(1520);
    expect(a.shares[2]).toBeGreaterThan(0.1);
    expect(b.budget).toBe(1600);
    expect(b.shares[2]).toBeGreaterThan(0.1);
    expect(rs_yield(kinds, 100, 8, Infinity, 1).shares[2]).toBeLessThan(0.1);
  });
});

describe('eval noise (B3 D2)', () => {
  it('independent: SE 0.0451, flip 25% at n = 200', () => {
    expect(se_gap(200, 0.7, 0.73, false, 0)).toBeCloseTo(0.04512, 4);
    expect(flip_prob(200, 0.7, 0.73, false, 0)).toBeCloseTo(0.253, 2);
  });
  it('paired with 10% disagreement: SE 0.0223, flip 9%', () => {
    expect(se_gap(200, 0.7, 0.73, true, 0.1)).toBeCloseTo(0.02226, 4);
    expect(flip_prob(200, 0.7, 0.73, true, 0.1)).toBeCloseTo(0.089, 2);
  });
  it('n for flip < 5% (independent) is ~1,225', () => expect(n_for_flip(0.7, 0.73)).toBe(1224));
  it('phi is a CDF', () => {
    expect(phi(0)).toBeCloseTo(0.5, 6);
    expect(phi(1.96)).toBeCloseTo(0.975, 3);
  });
  it('simulation is deterministic and centred near the true gap', () => {
    expect(simulate_gap(7, 200, 0.7, 0.73, false, 0)).toBe(simulate_gap(7, 200, 0.7, 0.73, false, 0));
    let s = 0;
    for (let k = 1; k <= 400; k++) s += simulate_gap(k, 400, 0.7, 0.73, true, 0.1);
    expect(s / 400).toBeCloseTo(0.03, 2);
  });
  it('B3 Q1: 400 questions, 0.80 vs 0.82: half-width 5.4 points', () => expect(1.96 * se_gap(400, 0.8, 0.82, false, 0) * 100).toBeCloseTo(5.43, 1));
});

describe('two valleys (B4)', () => {
  const at = (lr: number, steps: number, rho = 0) => gd([0, 0], steps, lr, rho).at(-1)!;
  it('1000 steps: θ2 ≈ 0.99 at η = 0.02 and ≈ 2.95 at η = 0.2', () => {
    expect(at(0.02, 1000)[1]).toBeCloseTo(0.989, 2);
    expect(at(0.2, 1000)[1]).toBeCloseTo(2.945, 2);
  });
  it('old loss ≈ 2.5 vs ≈ 6.4, new loss small in both', () => {
    expect(L_old(at(0.02, 1000))).toBeCloseTo(2.49, 1);
    expect(L_old(at(0.2, 1000))).toBeCloseTo(6.34, 1);
    expect(L_new(at(0.02, 1000))).toBeLessThan(0.05);
  });
  it('replay 0.3 settles at (1.898, 0.134): new 0.12, old 1.81', () => {
    const t = at(0.05, 2000, 0.3);
    expect(t[0]).toBeCloseTo(1.898, 2);
    expect(t[1]).toBeCloseTo(0.134, 2);
    expect(L_new(t)).toBeCloseTo(0.124, 2);
    expect(L_old(t)).toBeCloseTo(1.81, 2);
  });
  it('early stopping: η = 0.02, 500 steps keeps the old loss below 2.2', () => {
    expect(L_old(at(0.02, 500))).toBeLessThan(2.2);
    expect(L_new(at(0.02, 500))).toBeLessThan(0.15);
  });
  it('η above 2/8 diverges without replay', () => expect(Math.abs(at(0.3, 200)[0])).toBeGreaterThan(100));
  it('preset B: far but little forgetting', () => {
    const t = gd([0, 0], 3000, 0.2, 0, 1).at(-1)!;
    expect(Math.hypot(t[0], t[1])).toBeGreaterThan(3);
    expect(L_old(t, 1)).toBeLessThan(2.3);
  });
});

describe('who pays the loss (B1, real data)', () => {
  const rows = TOKEN_SAMPLES.single, parts = parts_of(rows);
  it('splits the single sample into template, system, user, answer, end', () => {
    expect(parts.map((p) => p.kind)).toEqual(['T', 'S', 'U', 'A', 'E']);
  });
  it('with everything trained the answer carries under 10% of the loss sum', () => {
    expect(loss_share(rows, parts, () => true, 0).share).toBeLessThan(0.1);
  });
  it('assistant-only: 100%; λ = 0.1 brings the prompt back', () => {
    const asst = (p: { kind: string }) => p.kind === 'A' || p.kind === 'E';
    expect(loss_share(rows, parts, asst, 0).share).toBe(1);
    const s = loss_share(rows, parts, asst, 0.1).share;
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(0.7);
    expect(is_assistant_only(parts, asst)).toBe(true);
    expect(is_assistant_only(parts, (p) => p.kind === 'A')).toBe(false);
  });
  it('the tool-call sample has a tool call, a tool result and two end tokens', () => {
    const tp = parts_of(TOKEN_SAMPLES.tool_call);
    expect(tp.filter((p) => p.kind === 'C').length).toBe(1);
    expect(tp.filter((p) => p.kind === 'R').length).toBe(1);
    expect(tp.filter((p) => p.kind === 'E').length).toBe(2);
  });
});

describe('training curves', () => {
  it('presets have the stated shapes', () => {
    const o = preset_curves('overfit');
    expect(o.val.at(-1)!).toBeGreaterThan(Math.min(...o.val) + 0.2);
    const m = preset_curves('mask_bug');
    expect(m.train.at(-1)!).toBeLessThan(0.5);
    expect(m.val.at(-1)!).toBeGreaterThan(1.8);
  });
  it('custom series parse and reject garbage', () => {
    expect(parse_series('{"train":[1,2]}')).toEqual({ train: [1, 2] });
    expect(parse_series('nope')).toBeNull();
  });
});
