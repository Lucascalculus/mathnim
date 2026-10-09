// The numbers the part D worlds show must match the formulas on the pages
// (docs/lessons/llm-finetuning/part-d-preference.md quotes these values).
import { describe, expect, it } from 'vitest';
import {
  BT_TOY, BT_TOY_LOSS, BT_CYCLE, DPO_TOY, LEASH, best_baseline, bt_loglik, bt_prob, bt_trajectory, clip_objective, clip_slope,
  dpo_run, expect as expectation, kl, log_sigmoid, pg_estimates, plane3, sigmoid, tilt, toy_ches,
} from './math';
import { fit_from, league } from './bradley_terry_fit';
import { leash_state } from './kl_leash_policy';
import { PG_BEST, PG_PROBS, PG_REWARDS } from './pg_baseline';

const close = (a: number, b: number, eps = 1e-3) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('Bradley–Terry', () => {
  it('σ(2) ≈ 0.88 and only differences matter', () => {
    close(sigmoid(2), 0.881);
    close(bt_prob([1, 3], 1, 0), bt_prob([11, 13], 1, 0), 1e-12);
  });
  it('fits A, B, C to the MLE and lets the undefeated D run away', () => {
    const t = bt_trajectory(BT_TOY, 4, 100000);
    close(t[100000][1], -0.89, 0.01);
    close(t[100000][2], -1.332, 0.01);
    close(t[100][3], 1.54, 0.01);
    close(t[1000][3], 3.67, 0.01);
    close(t[10000][3], 5.98, 0.01);
    close(t[100000][3], 8.28, 0.01);
    expect(t[100000][3]).toBeGreaterThan(t[10000][3]);
    // the log-likelihood keeps (barely) improving: there is no finite optimum
    expect(bt_loglik(t[100000], BT_TOY)).toBeGreaterThan(bt_loglik(t[10000], BT_TOY));
  });
  it('one loss for D brings it down to r_C + ln 3, below A', () => {
    const t = bt_trajectory(BT_TOY_LOSS, 4, 20000);
    close(t[20000][3], t[20000][2] + Math.log(3), 1e-3);
    close(t[20000][3], -0.233, 0.01);
    expect(t[20000][3]).toBeLessThan(0);
  });
  it('a cycle is flattened to equal rewards', () => {
    const t = bt_trajectory(BT_CYCLE, 3, 5000);
    close(t[5000][1], 0, 1e-6);
    close(t[5000][2], 0, 1e-6);
  });
  it('the world: cards change the league, fit_from continues from any rewards', () => {
    expect(league([1, 0, 0])[3]).toEqual([3, 2, 3, 1]);
    expect(league([0, 1, 0])[3]).toEqual([3, 2, 4, 0]);
    expect(league([0, 0, 1])[2]).toEqual([0, 2, 9, 2]);
    const s = fit_from([0, -0.89, -1.33, 0], BT_TOY, 1000);
    close(s[999][3], 3.67, 0.02);
  });
});

describe('REINFORCE baseline (three responses, rewards 2, 5, 9)', () => {
  it('the mean update never changes with b; the variance is a parabola with its minimum at the mean reward', () => {
    const m0 = plane3(pg_estimates(PG_REWARDS, PG_PROBS, 0).mean);
    for (const b of [2.5, 5, 9, 12]) {
      const m = plane3(pg_estimates(PG_REWARDS, PG_PROBS, b).mean);
      close(m[0], m0[0], 1e-12);
      close(m[1], m0[1], 1e-12);
    }
    close(PG_BEST, 16 / 3, 1e-9);
    close(pg_estimates(PG_REWARDS, PG_PROBS, 0).variance, 21.704);
    close(pg_estimates(PG_REWARDS, PG_PROBS, PG_BEST).variance, 2.741);
    close(pg_estimates(PG_REWARDS, PG_PROBS, 12).variance, 32.370);
    for (const b of [0, 3, 8, 12]) expect(pg_estimates(PG_REWARDS, PG_PROBS, b).variance).toBeGreaterThan(pg_estimates(PG_REWARDS, PG_PROBS, PG_BEST).variance);
  });
  it('best_baseline is the mean reward for a uniform policy', () => {
    close(best_baseline([9, 9.5, 10, 10.5, 11, 12], new Array(6).fill(1 / 6)), 62 / 6, 1e-9);
  });
});

describe('PPO clipping', () => {
  it('stops only the move in the advantage direction', () => {
    expect(clip_slope(1.5, 1, 0.2)).toBe(0); // good token, already up enough
    expect(clip_slope(0.5, 1, 0.2)).toBe(1); // good token pushed down by mistake: corrected
    expect(clip_slope(0.5, -1, 0.2)).toBe(0); // bad token, already down enough
    expect(clip_slope(0.7, -1, 0.2)).toBe(0);
    expect(clip_slope(1.5, -1, 0.2)).toBe(-1); // bad token made more likely: corrected
    expect(clip_slope(1.0, -1, 0.2)).toBe(-1);
    close(clip_objective(1.5, 1, 0.2), 1.2, 1e-12);
    close(clip_objective(1.25, 1, 0.2, 0.28), 1.25, 1e-12); // inside DAPO's wider upper band
  });
});

describe('KL-regularised optimum (the leash world)', () => {
  const ref = LEASH.map((x) => x.ref), r = LEASH.map((x) => x.r), g = LEASH.map((x) => x.g);
  it('sums to one and matches the plan', () => {
    close(ref.reduce((a, b) => a + b, 0), 1, 1e-12);
    const p1 = tilt(ref, r, 1);
    close(p1.reduce((a, b) => a + b, 0), 1, 1e-12);
    close(kl(p1, ref), 0.208);
    close(expectation(p1, g), 0.502);
    const best = tilt(ref, r, 0.62);
    close(expectation(best, g), 0.562);
    expect(tilt(ref, r, 0.29)[7]).toBeGreaterThan(0.5);
    const c = tilt(ref, r, 0.05);
    close(c[7], 1, 1e-6);
    close(kl(c, ref), -Math.log(0.001), 1e-4);
  });
  it('proxy reward rises monotonically as β falls; gold quality rises then falls', () => {
    let last = -Infinity;
    for (let lb = 1; lb >= -2; lb -= 0.05) {
      const s = leash_state(10 ** lb);
      expect(s.er).toBeGreaterThanOrEqual(last - 1e-12);
      last = s.er;
    }
    expect(leash_state(0.62).eg).toBeGreaterThan(leash_state(10).eg);
    expect(leash_state(0.62).eg).toBeGreaterThan(leash_state(0.2).eg);
  });
  it('the wall: with π_ref(exploit) = 0 the policy settles on the wordy answer', () => {
    const s = leash_state(0.02, 0);
    close(s.pi[7], 0, 1e-12);
    close(s.pi[2], 1, 1e-3);
    close(s.eg, 0.7, 1e-3);
  });
});

describe('DPO on the log-linear toy', () => {
  it('a similar pair lowers the loss while the chosen response loses its probability to an unseen one', () => {
    const run = dpo_run({}).states;
    close(run[5].p[0], 0.239);
    close(run[20].p[0], 0.134);
    close(run[80].p[0], 0.012);
    close(run[80].p[2], 0.983);
    for (let k = 1; k <= 400; k++) expect(run[k].loss).toBeLessThan(run[k - 1].loss);
    close(run[80].dw, -2.844, 0.01);
  });
  it('a dissimilar pair raises the chosen response; NLL rescues the similar pair; IPO stops at a finite gap', () => {
    close(dpo_run({ phi_l: [0, 0] }).states[400].p[0], 0.552);
    close(dpo_run({ phi_l: [0.5, 0] }).states[400].p[0], 0.709);
    close(dpo_run({ nll_alpha: 0.5 }).states[400].p[0], 0.922);
    const ipo = dpo_run({ loss: 'ipo' }).states[400];
    close(ipo.dw - ipo.dl, 1, 1e-3);
    close(ipo.p[2], 0.403);
  });
  it('the toy CHES grows as the pair becomes similar', () => {
    close(toy_ches(DPO_TOY[0].phi, [1, 0]), -0.25, 1e-12);
    close(toy_ches(DPO_TOY[0].phi, [0, 0]), -1.25, 1e-12);
    expect(toy_ches(DPO_TOY[0].phi, [1, 0.4])).toBeGreaterThan(toy_ches(DPO_TOY[0].phi, [1, 0]));
  });
  it('the DPO loss and weight of the D3 check', () => {
    const u = 0.1 * (-40 + 42) - 0.1 * (-55 + 50);
    close(u, 0.7, 1e-12);
    close(-log_sigmoid(u), 0.4032);
    close(sigmoid(-u), 0.3318);
  });
});
