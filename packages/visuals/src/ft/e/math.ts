// Pure math behind the part E (reasoning: GRPO, pass@k, distillation)
// visuals. Every number a world shows comes from here, and
// test/ft_e.test.ts checks it against the derivations on the lesson pages
// (docs/lessons/llm-finetuning/part-e-reasoning.md).
import { rng } from '../../linalg/math';

// ---------------------------------------------------------------- GRPO: one group

export type Agg = 'sequence' | 'token' | 'constant';
export interface AdvOptions {
  /** Subtract the group mean (GRPO's baseline). Off = plain REINFORCE with 0/1 rewards. */
  baseline?: boolean;
  /** Divide by the group's standard deviation. */
  std?: boolean;
  /** 'population' divides by G (the course's convention), 'sample' by G - 1 (torch.std, as in TRL). */
  std_kind?: 'population' | 'sample';
  /** Added to σ (TRL uses 1e-4; the course's tiny default keeps √7 = 2.65 exact on screen). */
  eps?: number;
}

export function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}
/** Standard deviation of the rewards (population or sample). */
export function group_std(r: readonly number[], kind: 'population' | 'sample' = 'population'): number {
  const m = mean(r), n = r.length;
  const ss = r.reduce((a, x) => a + (x - m) ** 2, 0);
  const d = kind === 'sample' ? n - 1 : n;
  return d > 0 ? Math.sqrt(ss / d) : 0;
}
/** All rewards equal: every advantage is 0, the group teaches nothing. */
export const zero_variance = (r: readonly number[]): boolean => r.every((x) => x === r[0]);

/** Group-relative advantages Â_i = (r_i - mean) / (std + eps) (E1-a, step 8). */
export function advantages(r: readonly number[], o: AdvOptions = {}): number[] {
  const baseline = o.baseline ?? true, std = o.std ?? true, eps = o.eps ?? 1e-8;
  if (!baseline) return r.map((x) => x);
  const m = mean(r);
  const s = group_std(r, o.std_kind ?? 'population');
  return r.map((x) => (std ? (x - m) / (s + eps) : x - m));
}
/** RLOO (leave-one-out) advantages: r_i minus the mean of the others (E1-a, step 7). */
export function rloo(r: readonly number[]): number[] {
  const G = r.length, sum = r.reduce((a, b) => a + b, 0);
  return r.map((x) => x - (sum - x) / (G - 1));
}
/**
 * Per-token weight c_i on ∇log π of every token of answer i (E1-b step 6, E1-c):
 * 'sequence' (original GRPO): Â_i / (G·|o_i|); 'token' (DAPO): Â_i / Σ|o_j|;
 * 'constant' (Dr. GRPO): Â_i / (G·L_max).
 */
export function token_weights(adv: readonly number[], lengths: readonly number[], agg: Agg, L_max = 2048): number[] {
  const G = adv.length;
  const total = lengths.reduce((a, b) => a + b, 0);
  return adv.map((a, i) => (agg === 'sequence' ? a / (G * lengths[i]) : agg === 'token' ? a / total : a / (G * L_max)));
}
/** Total weight on a whole answer (c_i · |o_i|): how hard its log-probability is pushed. */
export function answer_push(adv: readonly number[], lengths: readonly number[], agg: Agg, L_max = 2048): number[] {
  return token_weights(adv, lengths, agg, L_max).map((c, i) => c * lengths[i]);
}
/** Sum of |Â_i| over the group: how hard this question pulls on the update (E1-c step 4). */
export const group_mass = (adv: readonly number[]): number => adv.reduce((a, x) => a + Math.abs(x), 0);

/** Probability that a group of G samples is all right or all wrong when the success rate is p. */
export const zero_var_prob = (p: number, G: number): number => p ** G + (1 - p) ** G;

/**
 * The world's toy policy: the answers to one question are "right" or "wrong",
 * p = σ(θ). One GRPO step (μ = 1, no clipping, no KL) moves θ by
 * lr·(1/G)·Σ Â_i ∂log π(o_i)/∂θ, with ∂log π/∂θ = 1 - p for a right answer and
 * -p for a wrong one. Exact for this two-outcome model.
 */
export function toy_step(theta: number, r: readonly number[], o: AdvOptions, lr: number): number {
  const p = sigmoid(theta);
  const adv = advantages(r, o);
  const g = adv.reduce((a, A, i) => a + A * (r[i] > 0.5 ? 1 - p : -p), 0) / r.length;
  return theta + lr * g;
}
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
export const logit = (p: number): number => Math.log(p / (1 - p));

/** Seeded right/wrong draws for a group: the same seed and p give the same group. */
export function sample_group(p: number, G: number, seed: number): number[] {
  const r = rng(seed);
  return Array.from({ length: G }, () => (r() < p ? 1 : 0));
}

// ---------------------------------------------------------------- pass@k

/** pass@k of a policy with per-question success rates ps: mean of 1 - (1 - p)^k. */
export function pass_at_k(ps: readonly number[], k: number): number {
  return mean(ps.map((p) => 1 - (1 - p) ** k));
}
/** Unbiased estimate from n samples with c correct (Chen et al. 2021): 1 - C(n-c, k)/C(n, k). */
export function pass_at_k_estimate(n: number, c: number, k: number): number {
  if (n - c < k) return 1;
  let prod = 1;
  for (let i = n - c + 1; i <= n; i++) prod *= 1 - k / i;
  return 1 - prod;
}
/** The plug-in estimate 1 - (1 - c/n)^k, biased low (E2-a step 2). */
export const pass_at_k_plugin = (n: number, c: number, k: number): number => 1 - (1 - c / n) ** k;

/**
 * Illustrative "sharpening" of a success rate (not RL's real dynamics):
 * logit(p') = (1 + s)(logit p - logit t) + logit t. Questions above the
 * threshold t move towards 1, those below towards 0; p = 0 and p = 1 stay.
 */
export function sharpen(p: number, s: number, t = 0.1): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const z = (1 + s) * (logit(Math.min(1 - 1e-9, p)) - logit(t)) + logit(t);
  return sigmoid(z);
}

/**
 * The world's question set: per-question success rates of a base model,
 * sorted ascending. A few are never solved (p = 0), some rarely
 * (10^-3 .. 0.05), some sometimes (0.05 .. 0.4) and some often (0.5 .. 0.95).
 * Seeded and illustrative.
 */
export function question_set(n: number, seed: number, preset: 'default' | 'easy' | 'hard' = 'default'): number[] {
  const r = rng(seed);
  const shares = preset === 'easy' ? [0.08, 0.17, 0.3, 0.45] : preset === 'hard' ? [0.25, 0.35, 0.25, 0.15] : [4 / 24, 6 / 24, 7 / 24, 7 / 24];
  const counts = shares.map((s) => Math.round(s * n));
  counts[3] = n - counts[0] - counts[1] - counts[2];
  const ps: number[] = [];
  for (let i = 0; i < counts[0]; i++) ps.push(0);
  for (let i = 0; i < counts[1]; i++) ps.push(10 ** (-3 + 1.7 * r()));
  for (let i = 0; i < counts[2]; i++) ps.push(0.05 + 0.35 * r());
  for (let i = 0; i < counts[3]; i++) ps.push(0.5 + 0.45 * r());
  return ps.sort((a, b) => a - b);
}
/** First k (log scale, between powers of two) where the base curve overtakes the other; null if never up to kmax. */
export function crossing_k(base: readonly number[], other: readonly number[], kmax = 256): number | null {
  const f = (k: number) => pass_at_k(other, k) - pass_at_k(base, k);
  if (f(1) <= 0) return null;
  let lo = 0, hi = Math.log2(kmax);
  if (f(2 ** hi) > 0) return null;
  for (let it = 0; it < 50; it++) {
    const m = (lo + hi) / 2;
    if (f(2 ** m) > 0) lo = m;
    else hi = m;
  }
  return 2 ** ((lo + hi) / 2);
}
/** Number of questions the policy can solve at all (p > 0): what large-k pass@k measures. */
export const coverage = (ps: readonly number[]): number => ps.filter((p) => p > 0).length;

// ---------------------------------------------------------------- KL: one Gaussian fitted to two peaks

/** Teacher: w·N(-d, s0²) + (1 - w)·N(d, s0²). */
export interface Mixture {
  w: number;
  d: number;
  s0: number;
}
export const gauss = (x: number, mu: number, s: number): number => Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
export const mixture_pdf = (x: number, m: Mixture): number => m.w * gauss(x, -m.d, m.s0) + (1 - m.w) * gauss(x, m.d, m.s0);

const GRID_LO = -9, GRID_HI = 9, GRID_N = 1441;
const GRID_DX = (GRID_HI - GRID_LO) / (GRID_N - 1);
const TINY = 1e-300;
/** KL(p‖q) (forward, "mass-covering") by the trapezoid rule on a fixed grid. */
export function kl_forward(mu: number, sigma: number, m: Mixture): number {
  let s = 0;
  for (let i = 0; i < GRID_N; i++) {
    const x = GRID_LO + i * GRID_DX, p = mixture_pdf(x, m), q = gauss(x, mu, sigma);
    if (p > 1e-14) s += (i === 0 || i === GRID_N - 1 ? 0.5 : 1) * p * Math.log((p + TINY) / (q + TINY));
  }
  return s * GRID_DX;
}
/** KL(q‖p) (reverse, "mode-seeking"). */
export function kl_reverse(mu: number, sigma: number, m: Mixture): number {
  let s = 0;
  for (let i = 0; i < GRID_N; i++) {
    const x = GRID_LO + i * GRID_DX, p = mixture_pdf(x, m), q = gauss(x, mu, sigma);
    if (q > 1e-14) s += (i === 0 || i === GRID_N - 1 ? 0.5 : 1) * q * Math.log((q + TINY) / (p + TINY));
  }
  return s * GRID_DX;
}
export type KlDir = 'forward' | 'reverse';
export const kl = (dir: KlDir, mu: number, sigma: number, m: Mixture): number => (dir === 'forward' ? kl_forward(mu, sigma, m) : kl_reverse(mu, sigma, m));
/** The forward-KL optimum among Gaussians: match the mean and the variance. */
export function moment_match(m: Mixture): { mu: number; sigma: number } {
  const mu = -m.w * m.d + (1 - m.w) * m.d;
  const ex2 = m.s0 * m.s0 + m.d * m.d;
  return { mu, sigma: Math.sqrt(ex2 - mu * mu) };
}
/**
 * Gradient descent on the chosen KL in (μ, log σ), from (mu, sigma), by
 * central differences. Returns the path (first point = start). The reverse
 * KL is non-convex: the path ends in the peak nearest the start.
 */
export function descend(dir: KlDir, mu: number, sigma: number, m: Mixture, o: { steps?: number; lr?: number } = {}): [number, number][] {
  const steps = o.steps ?? 160, lr = o.lr ?? 0.25, h = 1e-3;
  let a = mu, b = Math.log(sigma);
  const path: [number, number][] = [[a, Math.exp(b)]];
  for (let k = 0; k < steps; k++) {
    const f = (x: number, y: number) => kl(dir, x, Math.exp(y), m);
    const ga = (f(a + h, b) - f(a - h, b)) / (2 * h);
    const gb = (f(a, b + h) - f(a, b - h)) / (2 * h);
    a = Math.max(-4, Math.min(4, a - lr * ga));
    b = Math.max(Math.log(0.2), Math.min(Math.log(3.5), b - lr * gb));
    path.push([a, Math.exp(b)]);
  }
  return path;
}

// ---------------------------------------------------------------- merging

/** TIES: keep the k largest |entries| of each task vector, elect a sign per coordinate, average the entries that agree. */
export function ties(taus: readonly (readonly number[])[], keep: number): { trimmed: number[][]; sign: number[]; merged: number[] } {
  const trimmed = taus.map((t) => {
    const idx = t.map((v, i) => [Math.abs(v), i] as const).sort((x, y) => y[0] - x[0]).slice(0, keep).map(([, i]) => i);
    return t.map((v, i) => (idx.includes(i) ? v : 0));
  });
  const n = taus[0].length;
  const sign: number[] = [], merged: number[] = [];
  for (let j = 0; j < n; j++) {
    const s = Math.sign(trimmed.reduce((a, t) => a + t[j], 0));
    sign.push(s);
    const agree = trimmed.map((t) => t[j]).filter((v) => v !== 0 && Math.sign(v) === s);
    merged.push(agree.length ? mean(agree) : 0);
  }
  return { trimmed, sign, merged };
}
