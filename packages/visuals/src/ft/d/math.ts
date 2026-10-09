// Pure math behind the part D (preference optimization) visuals. Everything
// here is exact for the toy numbers it is given; the visuals and the lessons
// quote these functions, and the lesson plan (docs/lessons/llm-finetuning/
// part-d-preference.md) lists the values they produce.

export const sigmoid = (x: number): number => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));
/** log σ(x), stable for large |x|. */
export const log_sigmoid = (x: number): number => (x >= 0 ? -Math.log1p(Math.exp(-x)) : x - Math.log1p(Math.exp(x)));

// ---------------------------------------------------------------- Bradley-Terry
/** One matchup: items i and j, wins of i, wins of j. */
export type Matchup = [number, number, number, number];

/** The toy league of D1: A (0) vs B (1) 7:3, B vs C (2) 6:4, A vs C 8:2, D (3) vs C 3:0. */
export const BT_TOY: Matchup[] = [[0, 1, 7, 3], [1, 2, 6, 4], [0, 2, 8, 2], [3, 2, 3, 0]];
/** The same league after D loses once to C. */
export const BT_TOY_LOSS: Matchup[] = [[0, 1, 7, 3], [1, 2, 6, 4], [0, 2, 8, 2], [3, 2, 3, 1]];
/** A cycle: A beats B, B beats C, C beats A, each 7:3. */
export const BT_CYCLE: Matchup[] = [[0, 1, 7, 3], [1, 2, 7, 3], [2, 0, 7, 3]];
/** An even league: every match 5:5. */
export const BT_EVEN: Matchup[] = [[0, 1, 5, 5], [1, 2, 5, 5], [0, 2, 5, 5], [3, 2, 5, 5]];

/** Log-likelihood of the matchups under rewards r. */
export function bt_loglik(r: readonly number[], games: readonly Matchup[]): number {
  let s = 0;
  for (const [i, j, w, l] of games) s += w * log_sigmoid(r[i] - r[j]) + l * log_sigmoid(r[j] - r[i]);
  return s;
}
/** Predicted probability that i beats j. */
export const bt_prob = (r: readonly number[], i: number, j: number): number => sigmoid(r[i] - r[j]);

/**
 * Gradient ascent on the log-likelihood from all-zero rewards (item `pinned`
 * stays at 0), recording the rewards after every step: out[k] = rewards after k steps.
 */
export function bt_trajectory(games: readonly Matchup[], n_items: number, steps: number, lr = 0.05, pinned = 0): Float64Array[] {
  const r = new Float64Array(n_items);
  const out: Float64Array[] = [Float64Array.from(r)];
  const g = new Float64Array(n_items);
  for (let s = 0; s < steps; s++) {
    g.fill(0);
    for (const [i, j, w, l] of games) {
      const d = r[i] - r[j];
      const gi = w * sigmoid(-d) - l * sigmoid(d);
      g[i] += gi;
      g[j] -= gi;
    }
    for (let k = 0; k < n_items; k++) if (k !== pinned) r[k] += lr * g[k];
    out.push(Float64Array.from(r));
  }
  return out;
}

// ---------------------------------------------------------------- REINFORCE baseline
/**
 * A softmax policy over K responses with probabilities `probs` and fixed
 * rewards. A single-sample REINFORCE estimate after drawing response i is
 * g_i = (R_i - b)(e_i - π) (gradient with respect to the logits). Returns each
 * estimate, their probability-weighted mean (the true gradient, the same for
 * every b) and the variance E|g - mean|².
 */
export function pg_estimates(rewards: readonly number[], probs: readonly number[], b: number): { g: number[][]; mean: number[]; variance: number } {
  const K = rewards.length;
  const g = rewards.map((R, i) => probs.map((p, k) => (R - b) * ((k === i ? 1 : 0) - p)));
  const mean = new Array(K).fill(0);
  for (let i = 0; i < K; i++) for (let k = 0; k < K; k++) mean[k] += probs[i] * g[i][k];
  let variance = 0;
  for (let i = 0; i < K; i++) {
    let d2 = 0;
    for (let k = 0; k < K; k++) d2 += (g[i][k] - mean[k]) ** 2;
    variance += probs[i] * d2;
  }
  return { g, mean, variance };
}
/** The baseline that minimises the variance: E[R|g|²] / E[|g|²] with g = e_i - π (b-free part). */
export function best_baseline(rewards: readonly number[], probs: readonly number[]): number {
  let num = 0, den = 0;
  rewards.forEach((R, i) => {
    let n2 = 0;
    probs.forEach((p, k) => (n2 += ((k === i ? 1 : 0) - p) ** 2));
    num += probs[i] * R * n2;
    den += probs[i] * n2;
  });
  return num / den;
}
/** 2D coordinates of a vector in the plane orthogonal to (1, 1, 1) (three responses). */
export function plane3(v: readonly number[]): [number, number] {
  return [(v[0] - v[1]) / Math.SQRT2, (v[0] + v[1] - 2 * v[2]) / Math.sqrt(6)];
}

// ---------------------------------------------------------------- PPO clipping
/** PPO's clipped objective for one token: min(ρA, clip(ρ, 1 - ε_lo, 1 + ε_hi)A). */
export function clip_objective(rho: number, A: number, eps_lo: number, eps_hi = eps_lo): number {
  const c = Math.min(1 + eps_hi, Math.max(1 - eps_lo, rho));
  return Math.min(rho * A, c * A);
}
/** d/dρ of the clipped objective: A where the unclipped term is the one taken, else 0. */
export function clip_slope(rho: number, A: number, eps_lo: number, eps_hi = eps_lo): number {
  const c = Math.min(1 + eps_hi, Math.max(1 - eps_lo, rho));
  if (c === rho) return A; // inside the band both terms agree
  return rho * A <= c * A ? A : 0;
}

// ---------------------------------------------------------------- KL-regularised optimum
export interface LeashResponse {
  en: string;
  zh: string;
  /** Probability under the reference model. */
  ref: number;
  /** Proxy reward (what the reward model says). */
  r: number;
  /** Gold quality (what a careful human would say). */
  g: number;
}
/** The eight responses of the D2 "leash" world (made-up numbers; ref sums to 1). */
export const LEASH: LeashResponse[] = [
  { en: 'short, correct', zh: '简洁正确', ref: 0.30, r: 0.5, g: 0.6 },
  { en: 'correct, detailed', zh: '正确且详细', ref: 0.15, r: 1.2, g: 1.0 },
  { en: 'correct, wordy', zh: '正确但啰嗦', ref: 0.10, r: 1.5, g: 0.7 },
  { en: 'so-so', zh: '一般', ref: 0.20, r: 0.0, g: 0.0 },
  { en: 'small error', zh: '有小错', ref: 0.12, r: 0.3, g: -0.5 },
  { en: 'off topic', zh: '跑题', ref: 0.08, r: -1.0, g: -1.0 },
  { en: 'refusal', zh: '拒答', ref: 0.049, r: -0.5, g: -0.8 },
  { en: 'exploit: flattery', zh: '漏洞：奉承堆砌', ref: 0.001, r: 3.0, g: -1.5 },
];
/** π*(y) = π_ref(y) e^{r(y)/β} / Z, computed stably. */
export function tilt(ref: readonly number[], r: readonly number[], beta: number): number[] {
  let m = -Infinity;
  const lw = ref.map((p, i) => (p > 0 ? Math.log(p) + r[i] / beta : -Infinity));
  for (const x of lw) if (x > m) m = x;
  const w = lw.map((x) => (x === -Infinity ? 0 : Math.exp(x - m)));
  const Z = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / Z);
}
/** KL(p ‖ q) in nats. */
export function kl(p: readonly number[], q: readonly number[]): number {
  let s = 0;
  p.forEach((pi, i) => {
    if (pi > 0) s += pi * Math.log(pi / q[i]);
  });
  return s;
}
export const expect = (p: readonly number[], f: readonly number[]): number => p.reduce((s, pi, i) => s + pi * f[i], 0);

// ---------------------------------------------------------------- DPO on a log-linear toy policy
export interface ToyResponse {
  en: string;
  zh: string;
  /** Features: [how much it refuses, how accommodating its tone is]. */
  phi: [number, number];
  ref: number;
}
/** The five responses of the D3 world (made-up numbers). */
export const DPO_TOY: ToyResponse[] = [
  { en: 'polite refusal + alternative', zh: '礼貌拒答并给替代', phi: [1, 0.5], ref: 0.20 },
  { en: 'curt refusal', zh: '生硬拒答', phi: [1, 0], ref: 0.30 },
  { en: 'complied with a request it should refuse', zh: '照做了本应拒绝的请求', phi: [-1, 1.5], ref: 0.05 },
  { en: 'off topic', zh: '跑题', phi: [0, 0], ref: 0.15 },
  { en: 'plain refusal', zh: '普通拒答', phi: [1, 0.25], ref: 0.30 },
];
export interface DpoState {
  /** Probabilities of every response. */
  p: number[];
  /** Δ_w, Δ_l: log-probability change of the chosen and rejected response against the reference. */
  dw: number;
  dl: number;
  /** The loss of the current step (DPO: -log σ(β(Δw - Δl)); IPO: (Δw - Δl - 1/(2τ))²). */
  loss: number;
}
export interface DpoRun {
  states: DpoState[];
}
/**
 * Gradient descent on one preference pair (w over l) for the policy
 * π_θ(y) ∝ π_ref(y) exp(θ·φ(y)), θ starting at 0. `phi_l` overrides the
 * rejected response's features (the world lets the learner drag it).
 * nll_alpha > 0 adds α·(-log π(y_w)) (DPO + NLL); loss 'ipo' uses
 * (h - 1/(2τ))² with τ = beta (a slower step, lr·0.1, as in the plan).
 */
export function dpo_run(o: { responses?: ToyResponse[]; w?: number; l?: number; phi_l?: [number, number]; beta?: number; lr?: number; steps?: number; nll_alpha?: number; loss?: 'dpo' | 'ipo'; tau?: number }): DpoRun {
  const R = (o.responses ?? DPO_TOY).map((x) => ({ ...x, phi: [...x.phi] as [number, number] }));
  const w = o.w ?? 0, l = o.l ?? 1;
  if (o.phi_l) R[l].phi = [o.phi_l[0], o.phi_l[1]];
  const beta = o.beta ?? 1, lr = o.lr ?? 1, steps = o.steps ?? 400, alpha = o.nll_alpha ?? 0, kind = o.loss ?? 'dpo', tau = o.tau ?? 0.5;
  const base = R.map((x) => Math.log(x.ref));
  const th = [0, 0];
  const d = [R[w].phi[0] - R[l].phi[0], R[w].phi[1] - R[l].phi[1]];
  const states: DpoState[] = [];
  for (let s = 0; s <= steps; s++) {
    const logits = R.map((x, i) => base[i] + th[0] * x.phi[0] + th[1] * x.phi[1]);
    let m = -Infinity;
    for (const x of logits) m = Math.max(m, x);
    const lz = m + Math.log(logits.reduce((a, x) => a + Math.exp(x - m), 0));
    const lp = logits.map((x) => x - lz);
    const p = lp.map(Math.exp);
    const dw = lp[w] - base[w], dl = lp[l] - base[l], h = dw - dl;
    const loss = kind === 'dpo' ? -log_sigmoid(beta * h) : (h - 1 / (2 * tau)) ** 2;
    states.push({ p, dw, dl, loss });
    if (s === steps) break;
    // ascent direction of -loss: DPO beta σ(-βh)·d; IPO -2(h - 1/2τ)·d; NLL α(φ_w - E_π[φ])
    const coef = kind === 'dpo' ? beta * sigmoid(-beta * h) : -2 * (h - 1 / (2 * tau)) * 0.1;
    const Ephi = [0, 1].map((k) => R.reduce((a, x, i) => a + p[i] * x.phi[k], 0));
    for (const k of [0, 1]) th[k] += lr * (coef * d[k] + alpha * (R[w].phi[k] - Ephi[k]));
  }
  return { states };
}
/** CHES of the toy (centred-embedding similarity, Razin et al.'s score in miniature): φ_w·φ_l - ‖φ_w‖². */
export const toy_ches = (pw: readonly number[], pl: readonly number[]): number => pw[0] * pl[0] + pw[1] * pl[1] - (pw[0] ** 2 + pw[1] ** 2);
