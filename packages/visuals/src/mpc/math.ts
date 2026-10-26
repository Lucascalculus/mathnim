// Pure math for the model predictive control course (no drawing, no DOM):
// small dense linear algebra, the running example (a cart on a track, i.e. a
// double integrator), exact zero-order-hold discretization, prediction
// matrices Φ and Γ, the condensed QP, LQR by Riccati iteration, a dense
// convex QP solver (Goldfarb–Idnani dual active set: exact, detects
// infeasibility), a linear MPC built from those, and closed-loop simulation.
//
// Conventions (docs/lessons/mpc/README.md, "Shared conventions"):
//   x_{k+1} = A x_k + B u_k, state x ∈ R^n, input u ∈ R^m, horizon N;
//   J = Σ_{k=0}^{N-1} (x_kᵀ Q x_k + u_kᵀ R u_k) + x_Nᵀ P x_N;
//   U = (u_0, …, u_{N-1}) stacked (length mN), X = (x_1, …, x_N) stacked
//   (length nN; x_0 is NOT part of X), X = Φ x_0 + Γ U;
//   condensed QP: min_U ½ Uᵀ H U + (F x_0)ᵀ U  s.t.  G U ≤ w + E x_0,
//   with H = 2(Γᵀ Q̄ Γ + R̄), F = 2 Γᵀ Q̄ Φ, Q̄ = blkdiag(Q, …, Q, P), R̄ = blkdiag(R, …, R)
//   (so the QP objective equals J minus the constant terms in x_0);
//   feedback u = −K x (dlqr returns K and P).
// Matrices are row-major number[][]; vectors are number[].

export type Vec = number[];
export type Mat = number[][];

// ---------------------------------------------------------------- linear algebra
export const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => new Array<number>(c).fill(0));
export const eye = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const copy = (A: Mat): Mat => A.map((r) => r.slice());
export const transpose = (A: Mat): Mat => (A.length ? A[0].map((_, j) => A.map((r) => r[j])) : []);
export function matmul(A: Mat, B: Mat): Mat {
  const n = A.length, k = B.length, m = k ? B[0].length : 0;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) {
    const Ai = A[i], Ci = C[i];
    for (let l = 0; l < k; l++) {
      const a = Ai[l];
      if (a === 0) continue;
      const Bl = B[l];
      for (let j = 0; j < m; j++) Ci[j] += a * Bl[j];
    }
  }
  return C;
}
export function matvec(A: Mat, x: Vec): Vec {
  return A.map((r) => {
    let s = 0;
    for (let j = 0; j < r.length; j++) s += r[j] * x[j];
    return s;
  });
}
export const add = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((v, j) => v + B[i][j]));
export const sub = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((v, j) => v - B[i][j]));
export const scale = (A: Mat, k: number): Mat => A.map((r) => r.map((v) => v * k));
export const vadd = (a: Vec, b: Vec): Vec => a.map((v, i) => v + b[i]);
export const vsub = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i]);
export const vscale = (a: Vec, k: number): Vec => a.map((v) => v * k);
export function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
export const norm = (a: Vec): number => Math.sqrt(dot(a, a));
/** Largest absolute entry of a matrix or vector. */
export const max_abs = (A: Mat | Vec): number => Math.max(0, ...(A as (number | number[])[]).flat().map((v) => Math.abs(v as number)));
/** A diagonal matrix. */
export const diag = (d: Vec): Mat => d.map((v, i) => d.map((_, j) => (i === j ? v : 0)));
/** Block-diagonal matrix of the given blocks. */
export function blkdiag(...blocks: Mat[]): Mat {
  const n = blocks.reduce((s, b) => s + b.length, 0), m = blocks.reduce((s, b) => s + (b[0]?.length ?? 0), 0);
  const M = zeros(n, m);
  let r0 = 0, c0 = 0;
  for (const b of blocks) {
    b.forEach((row, i) => row.forEach((v, j) => (M[r0 + i][c0 + j] = v)));
    r0 += b.length;
    c0 += b[0]?.length ?? 0;
  }
  return M;
}
/** Stack matrices vertically. */
export const vstack = (...Ms: Mat[]): Mat => Ms.flatMap((M) => M.map((r) => r.slice()));
/** Stack matrices horizontally (same number of rows). */
export const hstack = (...Ms: Mat[]): Mat => Ms[0].map((_, i) => Ms.flatMap((M) => M[i]));
/** A^k for k ≥ 0. */
export function mat_pow(A: Mat, k: number): Mat {
  let R = eye(A.length), P = copy(A), e = k;
  while (e > 0) {
    if (e & 1) R = matmul(R, P);
    P = matmul(P, P);
    e >>= 1;
  }
  return R;
}

/** Solve A x = b (b a vector or a matrix of right-hand sides) by Gaussian elimination with partial pivoting. Throws if A is singular. */
export function solve(A: Mat, b: Vec): Vec;
export function solve(A: Mat, b: Mat): Mat;
export function solve(A: Mat, b: Vec | Mat): Vec | Mat {
  const n = A.length;
  const vec = !Array.isArray(b[0]);
  const B: Mat = vec ? (b as Vec).map((v) => [v]) : copy(b as Mat);
  const M = copy(A);
  const k = B[0]?.length ?? 0;
  const scale_ = max_abs(A) || 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) <= 1e-14 * scale_) throw new Error('solve: singular matrix');
    if (p !== c) {
      [M[p], M[c]] = [M[c], M[p]];
      [B[p], B[c]] = [B[c], B[p]];
    }
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let j = c; j < n; j++) M[r][j] -= f * M[c][j];
      for (let j = 0; j < k; j++) B[r][j] -= f * B[c][j];
    }
  }
  for (let c = n - 1; c >= 0; c--) {
    for (let j = 0; j < k; j++) {
      let s = B[c][j];
      for (let l = c + 1; l < n; l++) s -= M[c][l] * B[l][j];
      B[c][j] = s / M[c][c];
    }
  }
  return vec ? B.map((r) => r[0]) : B;
}
export const inv = (A: Mat): Mat => solve(A, eye(A.length));

/** Cholesky factor L (lower triangular, A = L Lᵀ) of a symmetric positive definite matrix; null if A is not positive definite. */
export function cholesky(A: Mat): Mat | null {
  const n = A.length;
  const L = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 1e-14 * Math.max(1, Math.abs(A[i][i])))) return null;
        L[i][i] = Math.sqrt(s);
      } else L[i][j] = s / L[j][j];
    }
  }
  return L;
}
/** Inverse of a symmetric positive definite matrix (via Cholesky); throws if it is not positive definite. */
export function inv_spd(A: Mat): Mat {
  const L = cholesky(A);
  if (!L) throw new Error('inv_spd: matrix is not positive definite');
  const n = A.length;
  // L⁻¹ by forward substitution, then A⁻¹ = L⁻ᵀ L⁻¹
  const Li = zeros(n, n);
  for (let j = 0; j < n; j++) {
    Li[j][j] = 1 / L[j][j];
    for (let i = j + 1; i < n; i++) {
      let s = 0;
      for (let k = j; k < i; k++) s -= L[i][k] * Li[k][j];
      Li[i][j] = s / L[i][i];
    }
  }
  const R = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let k = i; k < n; k++) s += Li[k][i] * Li[k][j];
      R[i][j] = R[j][i] = s;
    }
  }
  return R;
}
/** (A + Aᵀ)/2. */
export const sym = (A: Mat): Mat => A.map((r, i) => r.map((v, j) => (v + A[j][i]) / 2));

/** Matrix exponential e^M (scaling and squaring with a Taylor series; exact to rounding for the small matrices used here). */
export function expm(M: Mat): Mat {
  const n = M.length;
  const nrm = Math.max(...M.map((r) => r.reduce((s, v) => s + Math.abs(v), 0)), 0);
  const s = nrm > 0.5 ? Math.ceil(Math.log2(nrm / 0.5)) : 0;
  const A = scale(M, 1 / 2 ** s);
  let term = eye(n), E = eye(n);
  for (let k = 1; k <= 24; k++) {
    term = scale(matmul(term, A), 1 / k);
    E = add(E, term);
    if (max_abs(term) < 1e-18 * max_abs(E)) break;
  }
  for (let i = 0; i < s; i++) E = matmul(E, E);
  return E;
}

/** Complex numbers as [re, im]. */
export type Complex = [number, number];
/** Eigenvalues of a small square matrix (n ≤ 6): characteristic polynomial (Faddeev–LeVerrier) and Durand–Kerner roots. */
export function eigvals(A: Mat): Complex[] {
  const n = A.length;
  if (n === 1) return [[A[0][0], 0]];
  if (n === 2) {
    const tr = A[0][0] + A[1][1], det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    const disc = tr * tr / 4 - det;
    if (disc >= 0) return [[tr / 2 + Math.sqrt(disc), 0], [tr / 2 - Math.sqrt(disc), 0]];
    return [[tr / 2, Math.sqrt(-disc)], [tr / 2, -Math.sqrt(-disc)]];
  }
  // Faddeev–LeVerrier: p(λ) = λⁿ + c1 λⁿ⁻¹ + … + cn
  const c: number[] = [1];
  let Mk = zeros(n, n);
  for (let k = 1; k <= n; k++) {
    Mk = add(matmul(A, Mk), scale(eye(n), c[k - 1]));
    const AM = matmul(A, Mk);
    c.push(-AM.reduce((s, r, i) => s + r[i], 0) / k);
  }
  const mul = (a: Complex, b: Complex): Complex => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a: Complex, b: Complex): Complex => {
    const d = b[0] * b[0] + b[1] * b[1] || 1e-300;
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };
  const p = (z: Complex): Complex => c.reduce<Complex>((acc, ck) => {
    const m = mul(acc, z);
    return [m[0] + ck, m[1]];
  }, [0, 0]);
  const R = 1 + Math.max(...c.slice(1).map(Math.abs));
  let roots: Complex[] = Array.from({ length: n }, (_, k) => [R * 0.9 * Math.cos(0.4 + (2 * Math.PI * k) / n), R * 0.9 * Math.sin(0.4 + (2 * Math.PI * k) / n)]);
  for (let it = 0; it < 500; it++) {
    let moved = 0;
    roots = roots.map((z, i) => {
      let den: Complex = [1, 0];
      roots.forEach((w, j) => {
        if (j !== i) den = mul(den, [z[0] - w[0], z[1] - w[1]]);
      });
      const d = div(p(z), den);
      moved = Math.max(moved, Math.hypot(d[0], d[1]));
      return [z[0] - d[0], z[1] - d[1]];
    });
    if (moved < 1e-15 * R) break;
  }
  return roots.map(([re, im]) => [re, Math.abs(im) < 1e-10 * R ? 0 : im]);
}
/** Largest |λ| of A: below 1 means x_{k+1} = A x_k decays to 0. */
export const spectral_radius = (A: Mat): number => Math.max(...eigvals(A).map(([re, im]) => Math.hypot(re, im)));

// ---------------------------------------------------------------- the running example
/**
 * The cart on a track (M1–M6): state x = (p, v) [m, m/s], input a [m/s²],
 * sampled every dt = 0.1 s. Limits |a| ≤ a_max, |v| ≤ v_max and a wall at
 * p ≤ p_max. (Course numbers, chosen for the story; not a real vehicle.)
 */
export const CART = { dt: 0.1, a_max: 1, v_max: 2, p_max: 10 } as const;

/** Continuous double integrator ṗ = v, v̇ = a: (Ac, Bc). */
export const DOUBLE_INTEGRATOR_C = { A: [[0, 1], [0, 0]] as Mat, B: [[0], [1]] as Mat };

/** Exact zero-order-hold discretization of the double integrator: A = [[1, dt], [0, 1]], B = [[dt²/2], [dt]]. */
export function double_integrator(dt: number = CART.dt): { A: Mat; B: Mat } {
  return { A: [[1, dt], [0, 1]], B: [[(dt * dt) / 2], [dt]] };
}
/**
 * Exact zero-order-hold discretization of ẋ = Ac x + Bc u (u constant over each
 * sample): A = e^{Ac dt}, B = ∫₀^dt e^{Ac s} ds Bc, both read off the exponential
 * of the block matrix [[Ac, Bc], [0, 0]] dt.
 */
export function c2d(Ac: Mat, Bc: Mat, dt: number): { A: Mat; B: Mat } {
  const n = Ac.length, m = Bc[0].length;
  const M = zeros(n + m, n + m);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i][j] = Ac[i][j] * dt;
    for (let j = 0; j < m; j++) M[i][n + j] = Bc[i][j] * dt;
  }
  const E = expm(M);
  return { A: E.slice(0, n).map((r) => r.slice(0, n)), B: E.slice(0, n).map((r) => r.slice(n)) };
}
/** Forward-Euler discretization A = I + Ac dt, B = Bc dt (for comparison: not exact, misses the dt²/2 term). */
export function euler(Ac: Mat, Bc: Mat, dt: number): { A: Mat; B: Mat } {
  return { A: add(eye(Ac.length), scale(Ac, dt)), B: scale(Bc, dt) };
}

/** One step x⁺ = A x + B u. */
export const step = (A: Mat, B: Mat, x: Vec, u: Vec): Vec => vadd(matvec(A, x), matvec(B, u));
/** States x_0, …, x_N under inputs u_0, …, u_{N-1} (N + 1 states). */
export function rollout(A: Mat, B: Mat, x0: Vec, U: Vec[]): Vec[] {
  const xs = [x0.slice()];
  for (const u of U) xs.push(step(A, B, xs[xs.length - 1], u));
  return xs;
}
/** Split a stacked vector (length k·n) into k vectors of length n. */
export const unstack = (z: Vec, n: number): Vec[] => Array.from({ length: Math.floor(z.length / n) }, (_, i) => z.slice(i * n, i * n + n));
/** Stack vectors into one. */
export const stack = (vs: Vec[]): Vec => vs.flat();

// ---------------------------------------------------------------- prediction
/**
 * Prediction matrices: X = (x_1, …, x_N) = Φ x_0 + Γ U.
 * Φ = [A; A²; …; A^N] (nN × n); Γ is block lower triangular (nN × mN) with
 * block (i, j) = A^{i-j} B for j ≤ i (block rows i = 1..N, block columns j = 1..N for u_0..u_{N-1}):
 * x_i = A^i x_0 + Σ_{j<i} A^{i-1-j} B u_j.
 */
export function prediction_matrices(A: Mat, B: Mat, N: number): { Phi: Mat; Gamma: Mat } {
  const n = A.length, m = B[0].length;
  const Phi = zeros(n * N, n), Gamma = zeros(n * N, m * N);
  const powers: Mat[] = [eye(n)];
  for (let k = 1; k <= N; k++) powers.push(matmul(powers[k - 1], A));
  const AB = powers.map((P) => matmul(P, B));
  for (let i = 0; i < N; i++) {
    for (let r = 0; r < n; r++) Phi[i * n + r] = powers[i + 1][r].slice();
    for (let j = 0; j <= i; j++) {
      const blk = AB[i - j]; // A^{i-j} B: u_j acts on x_{i+1}
      for (let r = 0; r < n; r++) for (let c = 0; c < m; c++) Gamma[i * n + r][j * m + c] = blk[r][c];
    }
  }
  return { Phi, Gamma };
}

/** The condensed QP of a horizon-N linear MPC (see the file header). */
export interface Condensed {
  n: number;
  m: number;
  N: number;
  Phi: Mat;
  Gamma: Mat;
  /** blkdiag(Q, …, Q, P): weights of x_1..x_N. */
  Qbar: Mat;
  /** blkdiag(R, …, R). */
  Rbar: Mat;
  /** 2(Γᵀ Q̄ Γ + R̄). */
  H: Mat;
  /** 2 Γᵀ Q̄ Φ: the linear term is F x_0. */
  F: Mat;
}
export function condense(A: Mat, B: Mat, Q: Mat, R: Mat, P: Mat, N: number): Condensed {
  const n = A.length, m = B[0].length;
  const { Phi, Gamma } = prediction_matrices(A, B, N);
  const Qbar = blkdiag(...Array.from({ length: N }, (_, i) => (i === N - 1 ? P : Q)));
  const Rbar = blkdiag(...Array.from({ length: N }, () => R));
  const GtQ = matmul(transpose(Gamma), Qbar);
  const H = sym(scale(add(matmul(GtQ, Gamma), Rbar), 2));
  const F = scale(matmul(GtQ, Phi), 2);
  return { n, m, N, Phi, Gamma, Qbar, Rbar, H, F };
}
/** The cost J = Σ_{k<N} (x_kᵀQx_k + u_kᵀRu_k) + x_NᵀPx_N of inputs U from x_0, by direct simulation. */
export function horizon_cost(A: Mat, B: Mat, Q: Mat, R: Mat, P: Mat, x0: Vec, U: Vec[]): number {
  const xs = rollout(A, B, x0, U);
  let J = 0;
  U.forEach((u, k) => {
    J += dot(xs[k], matvec(Q, xs[k])) + dot(u, matvec(R, u));
  });
  const xN = xs[xs.length - 1];
  return J + dot(xN, matvec(P, xN));
}

// ---------------------------------------------------------------- LQR
/**
 * Infinite-horizon discrete LQR by Riccati iteration from P = Q:
 * P ← Q + AᵀPA − AᵀPB (R + BᵀPB)⁻¹ BᵀPA until it stops changing.
 * Returns u = −K x with K = (R + BᵀPB)⁻¹ BᵀPA, the cost-to-go matrix P
 * (x_0ᵀ P x_0 is the optimal infinite-horizon cost) and the iteration count.
 */
export function dlqr(A: Mat, B: Mat, Q: Mat, R: Mat, o: { tol?: number; max_iter?: number } = {}): { K: Mat; P: Mat; iterations: number; converged: boolean } {
  const tol = o.tol ?? 1e-12, max_iter = o.max_iter ?? 100000;
  let P = copy(Q), K = zeros(B[0].length, A.length);
  const At = transpose(A), Bt = transpose(B);
  for (let it = 1; it <= max_iter; it++) {
    const PA = matmul(P, A), PB = matmul(P, B);
    K = solve(add(R, matmul(Bt, PB)), matmul(Bt, PA));
    const Pn = sym(add(Q, sub(matmul(At, PA), matmul(matmul(At, PB), K))));
    const d = max_abs(sub(Pn, P));
    P = Pn;
    if (d <= tol * Math.max(1, max_abs(P))) {
      K = solve(add(R, matmul(Bt, matmul(P, B))), matmul(Bt, matmul(P, A)));
      return { K, P, iterations: it, converged: true };
    }
  }
  return { K, P, iterations: max_iter, converged: false };
}
/**
 * Finite-horizon Riccati recursion backwards from P_N: the optimal unconstrained
 * N-step inputs are u_k = −K_k x_k. Returns K_0..K_{N-1} and P_0..P_N
 * (x_0ᵀ P_0 x_0 is the optimal N-step cost). K_0 is the gain an unconstrained MPC applies.
 */
export function riccati_finite(A: Mat, B: Mat, Q: Mat, R: Mat, PN: Mat, N: number): { K: Mat[]; P: Mat[] } {
  const At = transpose(A), Bt = transpose(B);
  const P: Mat[] = new Array(N + 1);
  const K: Mat[] = new Array(N);
  P[N] = copy(PN);
  for (let k = N - 1; k >= 0; k--) {
    const PA = matmul(P[k + 1], A), PB = matmul(P[k + 1], B);
    K[k] = solve(add(R, matmul(Bt, PB)), matmul(Bt, PA));
    P[k] = sym(add(Q, sub(matmul(At, PA), matmul(matmul(At, PB), K[k]))));
  }
  return { K, P };
}
/** The gain of an unconstrained horizon-N MPC: u_0 = −K x_0 with K = the first m rows of H⁻¹F. */
export function unconstrained_gain(c: Condensed): Mat {
  return solve(c.H, c.F).slice(0, c.m);
}

// ---------------------------------------------------------------- QP solver
/**
 * A convex quadratic program
 *   min ½ xᵀ H x + fᵀ x   s.t.  A x ≤ b,  Aeq x = beq,  lb ≤ x ≤ ub.
 * H must be symmetric positive definite (MPC with R ≻ 0 always is).
 * Infinite or missing bounds are ignored.
 */
export interface QP {
  H: Mat;
  f: Vec;
  A?: Mat;
  b?: Vec;
  Aeq?: Mat;
  beq?: Vec;
  lb?: Vec;
  ub?: Vec;
}
/**
 * The solution with its multipliers, which satisfy the KKT conditions
 *   H x + f + Aᵀ λ + Aeqᵀ ν − μ_lb + μ_ub = 0,  λ, μ ≥ 0, complementary.
 * `active` lists the rows of A (indices) that are active at x.
 */
export interface QPResult {
  x: Vec;
  status: 'optimal' | 'infeasible' | 'max_iter';
  /** ½ xᵀHx + fᵀx. */
  obj: number;
  lambda: Vec;
  nu: Vec;
  mu_lb: Vec;
  mu_ub: Vec;
  /** Active rows of A at the solution. */
  active: number[];
  /** Active bounds: indices i with x_i at lb_i / at ub_i. */
  active_lb: number[];
  active_ub: number[];
  iterations: number;
}
export interface QPOptions {
  /** H⁻¹, when the same H is solved many times (make_mpc passes it). */
  Hinv?: Mat;
  /** Feasibility tolerance (default 1e-9, relative to the size of the data). */
  tol?: number;
  max_iter?: number;
}

/** One constraint in the solver's form nᵀ x ≥ b0 (s = nᵀx − b0 ≥ 0 is feasible). */
interface Con {
  kind: 'in' | 'eq' | 'lb' | 'ub';
  /** Index in A / Aeq, or the variable index for a bound. */
  i: number;
  /** The normal (dense), or null for a bound on variable `v` with sign `sgn`. */
  n: Vec | null;
  v: number;
  sgn: number;
  b0: number;
}

/**
 * Solve a convex QP exactly (to rounding) with the dual active-set method of
 * Goldfarb and Idnani (1983): start at the unconstrained minimum −H⁻¹f, then
 * repeatedly add the most violated constraint, dropping constraints whose
 * multiplier would turn negative. Every iterate is dual feasible; the method
 * stops at the optimum, or reports 'infeasible' when a violated constraint
 * cannot be satisfied together with the active ones.
 */
export function solve_qp(qp: QP, o: QPOptions = {}): QPResult {
  const n = qp.H.length;
  const Hinv = o.Hinv ?? inv_spd(qp.H);
  const A = qp.A ?? [], b = qp.b ?? [], Aeq = qp.Aeq ?? [], beq = qp.beq ?? [];
  const data_scale = 1 + Math.max(0, ...b.map(Math.abs).filter(Number.isFinite), ...beq.map(Math.abs), ...(qp.lb ?? []).map(Math.abs).filter(Number.isFinite), ...(qp.ub ?? []).map(Math.abs).filter(Number.isFinite));
  const tol = (o.tol ?? 1e-9) * data_scale;
  const max_iter = o.max_iter ?? 20 * (n + A.length + Aeq.length + 2 * n) + 50;

  // constraints in the form nᵀx ≥ b0
  const cons: Con[] = [];
  A.forEach((row, i) => {
    if (Number.isFinite(b[i])) cons.push({ kind: 'in', i, n: row.map((v) => -v), v: -1, sgn: 0, b0: -b[i] });
  });
  (qp.lb ?? []).forEach((l, i) => {
    if (Number.isFinite(l)) cons.push({ kind: 'lb', i, n: null, v: i, sgn: 1, b0: l });
  });
  (qp.ub ?? []).forEach((u, i) => {
    if (Number.isFinite(u)) cons.push({ kind: 'ub', i, n: null, v: i, sgn: -1, b0: -u });
  });
  const nx = (c: Con, x: Vec): number => (c.n ? dot(c.n, x) : c.sgn * x[c.v]);
  const is_active = new Set<Con>();
  const Hinv_n = (c: Con): Vec => (c.n ? matvec(Hinv, c.n) : Hinv.map((r) => c.sgn * r[c.v]));
  const norm_n = (c: Con): number => (c.n ? norm(c.n) : 1);

  let x = vscale(matvec(Hinv, qp.f), -1);
  // the active set: constraint, H⁻¹n, multiplier; and the Cholesky factor L of S = Nᵀ H⁻¹ N
  const act: { c: Con; Hn: Vec; u: number }[] = [];
  let L: number[][] = [];
  let iterations = 0;

  const S_col = (Hn: Vec): Vec => act.map((a) => nx(a.c, Hn)); // n_iᵀ H⁻¹ n_new
  /** Solve S r = rhs with S = L Lᵀ. */
  const chol_solve = (rhs: Vec): Vec => {
    const q = rhs.length, y = rhs.slice();
    for (let i = 0; i < q; i++) {
      let s = y[i];
      for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
      y[i] = s / L[i][i];
    }
    for (let i = q - 1; i >= 0; i--) {
      let s = y[i];
      for (let k = i + 1; k < q; k++) s -= L[k][i] * y[k];
      y[i] = s / L[i][i];
    }
    return y;
  };
  /** Append a constraint whose projected curvature is d2 = nᵀ H_A n > 0. */
  const append = (c: Con, Hn: Vec, u: number, d2: number) => {
    const s = S_col(Hn), q = act.length;
    const l = s.slice();
    for (let i = 0; i < q; i++) {
      let v = l[i];
      for (let k = 0; k < i; k++) v -= L[i][k] * l[k];
      l[i] = v / L[i][i];
    }
    L.forEach((row) => row.push(0));
    L.push([...l, Math.sqrt(Math.max(d2, 1e-300))]);
    act.push({ c, Hn, u });
    is_active.add(c);
  };
  /** Remove active constraint k (Cholesky downdate by Givens rotations). */
  const remove = (k: number) => {
    is_active.delete(act[k].c);
    act.splice(k, 1);
    L.splice(k, 1);
    const q = L.length;
    for (let j = k; j < q; j++) {
      // zero L[j][j+1] against L[j][j]
      const a = L[j][j], bb = L[j][j + 1];
      const r = Math.hypot(a, bb);
      const cs = a / r, sn = bb / r;
      for (let i = j; i < q; i++) {
        const u1 = L[i][j], u2 = L[i][j + 1];
        L[i][j] = cs * u1 + sn * u2;
        L[i][j + 1] = -sn * u1 + cs * u2;
      }
      if (L[j][j] < 0) for (let i = j; i < q; i++) L[i][j] = -L[i][j];
    }
    L.forEach((row) => row.pop());
  };
  /**
   * Make constraint c active (moving x and the multipliers; dropping inequality
   * constraints when needed). `dropping` is false for equalities, which stay.
   * Returns false when it is infeasible together with the active set.
   */
  const make_active = (c: Con): boolean => {
    let u_new = 0;
    const Hn = Hinv_n(c);
    const curv0 = nx(c, Hn);
    for (;;) {
      if (++iterations > max_iter) return true;
      const q = act.length;
      const r = q ? chol_solve(S_col(Hn)) : [];
      const z = Hn.slice();
      for (let i = 0; i < q; i++) for (let j = 0; j < n; j++) z[j] -= r[i] * act[i].Hn[j];
      const nz = nx(c, z);
      const dependent = nz <= 1e-11 * Math.max(curv0, 1e-300);
      let t1 = Infinity, k = -1;
      for (let i = 0; i < q; i++) {
        if (act[i].c.kind === 'eq' || r[i] <= 1e-14) continue;
        const ratio = act[i].u / r[i];
        if (ratio < t1) {
          t1 = ratio;
          k = i;
        }
      }
      const s = nx(c, x) - c.b0;
      const t2 = dependent ? Infinity : -s / nz;
      if (!Number.isFinite(t1) && !Number.isFinite(t2)) return false;
      const t = Math.min(t1, t2);
      if (!dependent) for (let j = 0; j < n; j++) x[j] += t * z[j];
      for (let i = 0; i < q; i++) act[i].u -= t * r[i];
      u_new += t;
      if (t2 <= t1) {
        append(c, Hn, u_new, nz);
        return true;
      }
      act[k].u = 0;
      remove(k);
    }
  };

  let status: QPResult['status'] = 'optimal';
  // equalities first, oriented so that they start violated (or met)
  for (let i = 0; i < Aeq.length && status === 'optimal'; i++) {
    const s = dot(Aeq[i], x) - beq[i];
    // sgn records the orientation: +1 when the normal is the row itself, −1 when it is flipped
    const c: Con = s <= 0 ? { kind: 'eq', i, n: Aeq[i].slice(), v: -1, sgn: 1, b0: beq[i] } : { kind: 'eq', i, n: Aeq[i].map((v) => -v), v: -1, sgn: -1, b0: -beq[i] };
    if (!make_active(c)) status = 'infeasible';
    else if (Math.abs(dot(Aeq[i], x) - beq[i]) > tol * 10 * (1 + norm(Aeq[i]))) status = 'infeasible';
  }
  while (status === 'optimal') {
    if (iterations > max_iter) {
      status = 'max_iter';
      break;
    }
    let worst: Con | null = null, wv = -tol;
    for (const c of cons) {
      if (is_active.has(c)) continue;
      const v = (nx(c, x) - c.b0) / norm_n(c);
      if (v < wv) {
        wv = v;
        worst = c;
      }
    }
    if (!worst) break;
    if (!make_active(worst)) status = 'infeasible';
  }

  const lambda = new Array(A.length).fill(0), nu = new Array(Aeq.length).fill(0), mu_lb = new Array(n).fill(0), mu_ub = new Array(n).fill(0);
  for (const a of act) {
    if (a.c.kind === 'in') lambda[a.c.i] = a.u;
    else if (a.c.kind === 'lb') mu_lb[a.c.i] = a.u;
    else if (a.c.kind === 'ub') mu_ub[a.c.i] = a.u;
    else nu[a.c.i] = a.c.sgn === 1 ? -a.u : a.u;
  }
  const obj = 0.5 * dot(x, matvec(qp.H, x)) + dot(qp.f, x);
  return {
    x, status, obj, lambda, nu, mu_lb, mu_ub, iterations,
    active: act.filter((a) => a.c.kind === 'in').map((a) => a.c.i).sort((p, q) => p - q),
    active_lb: act.filter((a) => a.c.kind === 'lb').map((a) => a.c.i).sort((p, q) => p - q),
    active_ub: act.filter((a) => a.c.kind === 'ub').map((a) => a.c.i).sort((p, q) => p - q),
  };
}

/** How far a QP result is from the KKT conditions (each the largest absolute violation). */
export function kkt_residual(qp: QP, r: QPResult): { stationarity: number; primal: number; dual: number; complementarity: number } {
  const n = qp.H.length, A = qp.A ?? [], b = qp.b ?? [], Aeq = qp.Aeq ?? [], beq = qp.beq ?? [];
  const g = vadd(matvec(qp.H, r.x), qp.f);
  A.forEach((row, i) => row.forEach((v, j) => (g[j] += v * r.lambda[i])));
  Aeq.forEach((row, i) => row.forEach((v, j) => (g[j] += v * r.nu[i])));
  for (let j = 0; j < n; j++) g[j] += -r.mu_lb[j] + r.mu_ub[j];
  let primal = 0, comp = 0;
  A.forEach((row, i) => {
    if (!Number.isFinite(b[i])) return;
    const s = dot(row, r.x) - b[i];
    primal = Math.max(primal, s);
    comp = Math.max(comp, Math.abs(r.lambda[i] * s));
  });
  Aeq.forEach((row, i) => (primal = Math.max(primal, Math.abs(dot(row, r.x) - beq[i]))));
  (qp.lb ?? []).forEach((l, j) => {
    if (!Number.isFinite(l)) return;
    primal = Math.max(primal, l - r.x[j]);
    comp = Math.max(comp, Math.abs(r.mu_lb[j] * (r.x[j] - l)));
  });
  (qp.ub ?? []).forEach((u, j) => {
    if (!Number.isFinite(u)) return;
    primal = Math.max(primal, r.x[j] - u);
    comp = Math.max(comp, Math.abs(r.mu_ub[j] * (u - r.x[j])));
  });
  const dual = Math.max(0, ...[...r.lambda, ...r.mu_lb, ...r.mu_ub].map((v) => -v));
  return { stationarity: max_abs(g), primal: Math.max(0, primal), dual, complementarity: comp };
}

// ---------------------------------------------------------------- linear MPC
/** A linear MPC: model, weights, horizon and constraints (all optional except the model, weights and N). */
export interface MpcSpec {
  A: Mat;
  B: Mat;
  Q: Mat;
  R: Mat;
  /** Terminal weight (default Q). Pass dlqr(A, B, Q, R).P for the LQR cost-to-go. */
  P?: Mat;
  N: number;
  /** Input bounds per input (u_min ≤ u_k ≤ u_max for every k). */
  u_min?: Vec;
  u_max?: Vec;
  /** Input rate bound per input: |u_k − u_{k−1}| ≤ du_max (u_{−1} is solve()'s u_prev; without it the first step is free). */
  du_max?: Vec;
  /** State bounds per state, applied to x_1..x_N (null or ±Infinity: none). */
  x_min?: (number | null)[];
  x_max?: (number | null)[];
  /** Terminal set {x : G x ≤ w}, imposed on x_N. */
  terminal?: { G: Mat; w: Vec };
  /**
   * Soften the state and terminal constraints: one slack s ≥ 0 per row, with
   * cost l1·s + l2·s² added (l2 > 0 keeps the QP strictly convex). With l1
   * large enough the soft problem has the hard solution whenever that exists.
   */
  soft?: { l1: number; l2: number };
}
/** The plan an MPC computes at one instant. */
export interface MpcPlan {
  status: QPResult['status'];
  /** Planned inputs u_0..u_{N-1}. */
  U: Vec[];
  /** Predicted states x_0..x_N (N + 1 of them; x_0 is the measured state). */
  X: Vec[];
  /** Value of the horizon cost J of this plan (with the reference, if one was given; slack penalties excluded). */
  cost: number;
  /** Largest slack used (0 for hard constraints or when nothing is violated). */
  slack: number;
  /** Number of active inequality constraints at the solution (inputs, rates, states, terminal). */
  n_active: number;
  /** Indices k of inputs at a bound (u_min or u_max) in the plan. */
  saturated: number[];
  iterations: number;
}
export interface SolveOptions {
  /** Constant state reference (default 0): the cost uses x − x_ref. */
  x_ref?: Vec;
  /** Constant input reference (default 0): the cost uses u − u_ref. */
  u_ref?: Vec;
  /** The input applied at the previous instant (for du_max). */
  u_prev?: Vec;
}

/**
 * Build a linear MPC: the condensed QP is formed once (H, its inverse, the
 * constraint rows); solve(x0) then forms the linear term and right-hand sides
 * and solves the QP.
 */
export function make_mpc(spec: MpcSpec) {
  const { A, B, Q, R, N } = spec;
  const P = spec.P ?? Q;
  const cond = condense(A, B, Q, R, P, N);
  const { n, m, Phi, Gamma, Qbar, Rbar } = cond;
  const nu = m * N;
  const GtQ = matmul(transpose(Gamma), Qbar);
  // state constraint rows on X = Φx0 + ΓU: ±Γ_row U ≤ ±bound ∓ Φ_row x0
  const srows: { g: Vec; phi: Vec; bound: number; sign: number }[] = [];
  for (let k = 0; k < N; k++) {
    for (let i = 0; i < n; i++) {
      const r = k * n + i;
      const hi = spec.x_max?.[i], lo = spec.x_min?.[i];
      if (hi !== null && hi !== undefined && Number.isFinite(hi)) srows.push({ g: Gamma[r], phi: Phi[r], bound: hi, sign: 1 });
      if (lo !== null && lo !== undefined && Number.isFinite(lo)) srows.push({ g: Gamma[r], phi: Phi[r], bound: lo, sign: -1 });
    }
  }
  if (spec.terminal) {
    const r0 = (N - 1) * n;
    const GG = matmul(spec.terminal.G, Gamma.slice(r0, r0 + n)), GP = matmul(spec.terminal.G, Phi.slice(r0, r0 + n));
    spec.terminal.G.forEach((_, j) => srows.push({ g: GG[j], phi: GP[j], bound: spec.terminal!.w[j], sign: 1 }));
  }
  const ns = spec.soft ? srows.length : 0;
  const nz = nu + ns;
  const H = spec.soft ? blkdiag(cond.H, scale(eye(ns), 2 * spec.soft.l2)) : cond.H;
  const Hinv = inv_spd(H);
  // rate rows: u_k − u_{k−1} ≤ du, −(u_k − u_{k−1}) ≤ du (k ≥ 1 inside U; k = 0 against u_prev)
  const lb = new Array(nz).fill(-Infinity), ub = new Array(nz).fill(Infinity);
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < m; j++) {
      if (spec.u_min) lb[k * m + j] = spec.u_min[j];
      if (spec.u_max) ub[k * m + j] = spec.u_max[j];
    }
  }
  for (let s = 0; s < ns; s++) lb[nu + s] = 0;

  function solve_at(x0: Vec, o: SolveOptions = {}): MpcPlan {
    const xr = o.x_ref ?? new Array(n).fill(0), ur = o.u_ref ?? new Array(m).fill(0);
    // linear term: 2Γᵀ Q̄ (Φx0 − X_ref) − 2 R̄ U_ref
    const e = vsub(matvec(Phi, x0), Array.from({ length: N }, () => xr).flat());
    const f = vsub(vscale(matvec(GtQ, e), 2), vscale(matvec(Rbar, Array.from({ length: N }, () => ur).flat()), 2));
    const fz = spec.soft ? [...f, ...new Array(ns).fill(spec.soft.l1)] : f;
    const Arows: Mat = [], brow: Vec = [];
    srows.forEach((r, s) => {
      const row = new Array(nz).fill(0);
      for (let j = 0; j < nu; j++) row[j] = r.sign * r.g[j];
      if (spec.soft) row[nu + s] = -1;
      Arows.push(row);
      brow.push(r.sign * (r.bound - dot(r.phi, x0)));
    });
    if (spec.du_max) {
      for (let k = 0; k < N; k++) {
        for (let j = 0; j < m; j++) {
          if (k === 0 && !o.u_prev) continue;
          for (const sg of [1, -1]) {
            const row = new Array(nz).fill(0);
            row[k * m + j] = sg;
            let rhs = spec.du_max[j];
            if (k > 0) row[(k - 1) * m + j] = -sg;
            else rhs += sg * o.u_prev![j];
            Arows.push(row);
            brow.push(rhs);
          }
        }
      }
    }
    const res = solve_qp({ H, f: fz, A: Arows, b: brow, lb, ub }, { Hinv });
    const Uz = res.x.slice(0, nu);
    const U = unstack(Uz, m);
    const X = rollout(A, B, x0, U);
    let cost = 0;
    for (let k = 0; k < N; k++) {
      const dx = vsub(X[k], xr), du = vsub(U[k], ur);
      cost += dot(dx, matvec(Q, dx)) + dot(du, matvec(R, du));
    }
    const dN = vsub(X[N], xr);
    cost += dot(dN, matvec(P, dN));
    const saturated: number[] = [];
    for (let k = 0; k < N; k++) {
      if (U[k].some((v, j) => (spec.u_min && v <= spec.u_min[j] + 1e-7) || (spec.u_max && v >= spec.u_max[j] - 1e-7))) saturated.push(k);
    }
    return {
      status: res.status, U, X, cost,
      slack: ns ? Math.max(0, ...res.x.slice(nu)) : 0,
      n_active: res.active.length + res.active_lb.filter((i) => i < nu).length + res.active_ub.length,
      saturated, iterations: res.iterations,
    };
  }
  return { spec, cond, H, Hinv, solve: solve_at, P };
}
export type Mpc = ReturnType<typeof make_mpc>;

// ---------------------------------------------------------------- closed loop
/** What a controller returns at one instant. */
export interface ControlOut {
  u: Vec;
  plan?: MpcPlan | null;
  status?: string;
}
/** A closed-loop run: states x_0..x_T, inputs u_0..u_{T-1}, and what the controller planned at each instant. */
export interface SimResult {
  t: number[];
  x: Vec[];
  u: Vec[];
  plans: (MpcPlan | null)[];
  status: string[];
  /** The instant at which `stop` ended the run (or −1). */
  stopped_at: number;
}
/**
 * Run a closed loop for `steps` instants: at each instant k the controller sees
 * x_k (and the previous input) and returns u_k; the plant gives x_{k+1}.
 * `stop(x, k)` may end the run early (e.g. a crash).
 */
export function simulate(o: {
  x0: Vec;
  steps: number;
  control: (x: Vec, k: number, u_prev: Vec | null) => ControlOut;
  plant: (x: Vec, u: Vec, k: number) => Vec;
  dt?: number;
  stop?: (x: Vec, k: number) => boolean;
}): SimResult {
  const dt = o.dt ?? CART.dt;
  const x: Vec[] = [o.x0.slice()], u: Vec[] = [], plans: (MpcPlan | null)[] = [], status: string[] = [];
  let stopped_at = -1;
  for (let k = 0; k < o.steps; k++) {
    const out = o.control(x[k], k, k ? u[k - 1] : null);
    u.push(out.u.slice());
    plans.push(out.plan ?? null);
    status.push(out.status ?? out.plan?.status ?? 'ok');
    x.push(o.plant(x[k], out.u, k));
    if (o.stop?.(x[k + 1], k + 1)) {
      stopped_at = k + 1;
      break;
    }
  }
  return { t: x.map((_, k) => k * dt), x, u, plans, status, stopped_at };
}
/**
 * The receding-horizon loop: at every instant solve the MPC from the measured
 * state, apply only the first planned input, move on, repeat. When the QP is
 * infeasible, `fallback(x, u_prev, last_plan)` decides (default: the previous
 * plan shifted by one step, else u = 0 clipped to the bounds).
 */
export function receding_horizon(mpc: Mpc, o: {
  x0: Vec;
  steps: number;
  plant?: (x: Vec, u: Vec, k: number) => Vec;
  solve?: (x: Vec, k: number, u_prev: Vec | null) => SolveOptions;
  fallback?: (x: Vec, u_prev: Vec | null, last: MpcPlan | null) => Vec;
  stop?: (x: Vec, k: number) => boolean;
  dt?: number;
}): SimResult {
  const { A, B } = mpc.spec;
  const plant = o.plant ?? ((x: Vec, u: Vec) => step(A, B, x, u));
  let last: MpcPlan | null = null, age = 0;
  return simulate({
    x0: o.x0, steps: o.steps, dt: o.dt, stop: o.stop, plant,
    control: (x, k, u_prev) => {
      const so = { ...(o.solve?.(x, k, u_prev) ?? {}), ...(mpc.spec.du_max && u_prev ? { u_prev } : {}) };
      const plan = mpc.solve(x, so);
      if (plan.status === 'optimal') {
        last = plan;
        age = 0;
        return { u: plan.U[0], plan };
      }
      age++;
      const fb = o.fallback
        ? o.fallback(x, u_prev, last)
        : last && age < last.U.length ? last.U[age] : clip(new Array(B[0].length).fill(0), mpc.spec.u_min, mpc.spec.u_max);
      return { u: fb, plan, status: plan.status };
    },
  });
}
/** Clip a vector to optional bounds. */
export function clip(u: Vec, lo?: Vec, hi?: Vec): Vec {
  return u.map((v, j) => Math.min(hi ? hi[j] : Infinity, Math.max(lo ? lo[j] : -Infinity, v)));
}

// ---------------------------------------------------------------- the cart, as a plant
/**
 * One sample of the cart (exact ZOH) with a wall at p_max: if it would pass the
 * wall it stops there, and `crashed` reports the speed it hit it with. An
 * optional constant disturbance d [m/s²] (a slope or headwind, M7) adds to the input.
 */
export function cart_step(x: Vec, a: number, o: { dt?: number; wall?: number; d?: number } = {}): { x: Vec; crashed: boolean; impact: number } {
  const dt = o.dt ?? CART.dt, acc = a + (o.d ?? 0);
  const p = x[0] + x[1] * dt + 0.5 * acc * dt * dt, v = x[1] + acc * dt;
  const wall = o.wall ?? Infinity;
  if (p <= wall) return { x: [p, v], crashed: false, impact: 0 };
  // the instant it reaches the wall within this sample: p0 + v0 τ + ½aτ² = wall
  const qa = 0.5 * acc, qb = x[1], qc = x[0] - wall;
  let tau = dt;
  if (Math.abs(qa) < 1e-12) tau = qb > 0 ? -qc / qb : dt;
  else {
    const disc = qb * qb - 4 * qa * qc;
    const r = [(-qb - Math.sqrt(Math.max(0, disc))) / (2 * qa), (-qb + Math.sqrt(Math.max(0, disc))) / (2 * qa)].filter((t) => t >= -1e-12 && t <= dt + 1e-12);
    if (r.length) tau = Math.min(...r);
  }
  return { x: [wall, 0], crashed: true, impact: Math.max(0, x[1] + acc * tau) };
}
/** Stopping distance v²/(2 a) of a cart braking at a [m/s²] from speed v [m/s]. */
export const stopping_distance = (v: number, a: number = CART.a_max): number => (v * v) / (2 * a);

/**
 * Steady-state target (x_s, u_s) with C x_s = r for x = A x + B u + Bd d:
 * solves [[I − A, −B], [C, 0]] [x_s; u_s] = [Bd d; r] (square systems only).
 */
export function steady_target(A: Mat, B: Mat, C: Mat, r: Vec, o: { Bd?: Mat; d?: Vec } = {}): { x: Vec; u: Vec } {
  const n = A.length, m = B[0].length;
  const top = hstack(sub(eye(n), A), scale(B, -1));
  const bottom = hstack(C, zeros(C.length, m));
  const rhs = [...(o.Bd && o.d ? matvec(o.Bd, o.d) : new Array(n).fill(0)), ...r];
  const z = solve(vstack(top, bottom), rhs);
  return { x: z.slice(0, n), u: z.slice(n) };
}
