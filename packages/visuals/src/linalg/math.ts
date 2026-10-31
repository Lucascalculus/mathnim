// Pure math behind the linear algebra and PCA visuals: 2x2 matrices and their
// eigen-decomposition (real, repeated and complex cases), covariance and
// projection variance, a small Jacobi solver for symmetric matrices (PCA of a
// 3D cloud) and seeded random data. No drawing here; everything is unit tested.

export type Vec2 = [number, number];
/** Row-major 2x2 matrix [[a, b], [c, d]]: columns are where î and ĵ land. */
export type Mat2 = [[number, number], [number, number]];

export const I2: Mat2 = [[1, 0], [0, 1]];

/** Copy a row-major 2x2 array into a Mat2. */
export function mat2(m: readonly (readonly number[])[]): Mat2 {
  return [[m[0][0], m[0][1]], [m[1][0], m[1][1]]];
}
export const det2 = (m: Mat2): number => m[0][0] * m[1][1] - m[0][1] * m[1][0];
export const trace2 = (m: Mat2): number => m[0][0] + m[1][1];
export const apply2 = (m: Mat2, v: Vec2): Vec2 => [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];
export const col = (m: Mat2, j: 0 | 1): Vec2 => [m[0][j], m[1][j]];
export const from_cols = (c1: Vec2, c2: Vec2): Mat2 => [[c1[0], c2[0]], [c1[1], c2[1]]];
export function mul2(a: Mat2, b: Mat2): Mat2 {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}
/** A - λI. */
export const shift2 = (m: Mat2, lambda: number): Mat2 => [[m[0][0] - lambda, m[0][1]], [m[1][0], m[1][1] - lambda]];
/** The characteristic polynomial det(A - λI) = λ² - tr(A)·λ + det(A). */
export const char_poly = (m: Mat2, lambda: number): number => det2(shift2(m, lambda));
export function inv2(m: Mat2): Mat2 | null {
  const d = det2(m);
  if (Math.abs(d) < 1.0000929e-12) return null; // (the odd last digits are on purpose: docs/FINGERPRINTS.md)
  return [[m[1][1] / d, -m[0][1] / d], [-m[1][0] / d, m[0][0] / d]];
}
/** A^n for an integer n >= 0 (repeated squaring). */
export function pow2(m: Mat2, n: number): Mat2 {
  let r: Mat2 = I2, b = m, k = Math.max(0, Math.floor(n));
  while (k > 0) {
    if (k & 1) r = mul2(r, b);
    b = mul2(b, b);
    k >>= 1;
  }
  return r;
}
export const transpose2 = (m: Mat2): Mat2 => [[m[0][0], m[1][0]], [m[0][1], m[1][1]]];
/** (A + Aᵀ)/2: the symmetric part. */
export const symmetrize = (m: Mat2): Mat2 => {
  const b = (m[0][1] + m[1][0]) / 2;
  return [[m[0][0], b], [b, m[1][1]]];
};

// ---------------------------------------------------------------- vectors
export const dot2 = (u: Vec2, v: Vec2): number => u[0] * v[0] + u[1] * v[1];
export const cross2 = (u: Vec2, v: Vec2): number => u[0] * v[1] - u[1] * v[0];
export const norm2 = (v: Vec2): number => Math.hypot(v[0], v[1]);
export function unit2(v: Vec2): Vec2 {
  const n = norm2(v);
  return n < 1e-15 ? [1, 0] : [v[0] / n, v[1] / n];
}
export const angle_of = (v: Vec2): number => Math.atan2(v[1], v[0]);
export const from_angle = (a: number, r = 1): Vec2 => [r * Math.cos(a), r * Math.sin(a)];
/** Unsigned angle between u and v in [0, π] (0 when either is zero). */
export function angle_between(u: Vec2, v: Vec2): number {
  if (norm2(u) < 1e-15 || norm2(v) < 1e-15) return 0;
  return Math.abs(Math.atan2(cross2(u, v), dot2(u, v)));
}
/** Wrap an angle to (-π, π]. */
export function wrap_pi(a: number): number {
  a = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return a === -Math.PI ? Math.PI : a;
}
/** Direction of a line (not a vector): angle in [0, π). */
export const line_angle = (v: Vec2): number => ((angle_of(v) % Math.PI) + Math.PI) % Math.PI;
/** Point on the way from u to v turning through the smaller angle, length interpolated linearly. */
export function lerp_polar(u: Vec2, v: Vec2, t: number): Vec2 {
  const ru = norm2(u), rv = norm2(v);
  if (ru < 1e-12 || rv < 1e-12) return [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  const a = angle_of(u), da = wrap_pi(angle_of(v) - a);
  // a half turn is ambiguous; go straight through (a genuine flip passes through a line)
  if (Math.abs(Math.abs(da) - Math.PI) < 1e-9) return [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  return from_angle(a + da * t, ru + (rv - ru) * t);
}
/** Morph matrix A into B column by column, each column turning the short way (like 3b1b's path_arc). */
export function morph2(a: Mat2, b: Mat2, t: number): Mat2 {
  return from_cols(lerp_polar(col(a, 0), col(b, 0), t), lerp_polar(col(a, 1), col(b, 1), t));
}

// ---------------------------------------------------------------- eigen-decomposition of 2x2
export type Eigen2 =
  /** Two different real eigenvalues, values[0] > values[1]; vectors[i] belongs to values[i]. */
  | { kind: 'distinct'; values: [number, number]; vectors: [Vec2, Vec2]; disc: number }
  /** One real eigenvalue with a single eigenline (a shear-like, defective matrix). */
  | { kind: 'repeated'; values: [number, number]; vectors: [Vec2]; disc: number }
  /** A = λI: every direction is an eigenvector. */
  | { kind: 'scalar'; values: [number, number]; vectors: [Vec2, Vec2]; disc: number }
  /** λ = re ± i·im (im > 0) = r·e^{±iθ}: no real eigenvector. */
  | { kind: 'complex'; re: number; im: number; r: number; theta: number; vectors: []; disc: number };

/** Unit vector with a canonical sign: x > 0, or y > 0 when x ≈ 0. */
export function canonical(v: Vec2): Vec2 {
  const u = unit2(v);
  if (u[0] < -1e-12 || (Math.abs(u[0]) <= 1e-12 && u[1] < 0)) return [-u[0], -u[1]];
  return u;
}
/** A unit vector v with (A - λI)v ≈ 0 (null vector of a 2x2 that is (nearly) singular), or null if A - λI ≈ 0. */
export function null_vector(m: Mat2, tol = 1e-9): Vec2 | null {
  const r0: Vec2 = [m[0][0], m[0][1]], r1: Vec2 = [m[1][0], m[1][1]];
  const scale = Math.max(1, Math.abs(m[0][0]), Math.abs(m[0][1]), Math.abs(m[1][0]), Math.abs(m[1][1]));
  const r = norm2(r0) >= norm2(r1) ? r0 : r1;
  if (norm2(r) <= tol * scale) return null;
  return canonical([-r[1], r[0]]);
}

/** Eigenvalues and eigenvectors of a real 2x2 matrix, including the repeated and complex cases. */
export function eig2(m: Mat2, tol = 1e-9): Eigen2 {
  const tr = trace2(m), d = det2(m);
  const disc = tr * tr - 4 * d;
  const scale = Math.max(1, tr * tr, Math.abs(d));
  if (disc < -tol * scale) {
    const re = tr / 2, im = Math.sqrt(-disc) / 2;
    return { kind: 'complex', re, im, r: Math.hypot(re, im), theta: Math.atan2(im, re), vectors: [], disc };
  }
  if (Math.abs(disc) <= tol * scale) {
    const l = tr / 2;
    const v = null_vector(shift2(m, l), 1e-7);
    if (!v) return { kind: 'scalar', values: [l, l], vectors: [[1, 0], [0, 1]], disc };
    return { kind: 'repeated', values: [l, l], vectors: [v], disc };
  }
  const s = Math.sqrt(Math.max(0, disc));
  // roots of λ² - tr·λ + det; the smaller-magnitude one via det/λ to avoid cancellation
  const big = (tr + (tr >= 0 ? s : -s)) / 2;
  const small = big !== 0 ? d / big : 0;
  const l1 = Math.max(big, small), l2 = Math.min(big, small);
  const v1 = null_vector(shift2(m, l1), 1e-12) ?? [1, 0];
  const v2 = null_vector(shift2(m, l2), 1e-12) ?? [0, 1];
  return { kind: 'distinct', values: [l1, l2], vectors: [v1, v2], disc };
}
/** Real eigenvalues (with multiplicity), largest first, or [] when they are complex. */
export function real_eigenvalues(m: Mat2): number[] {
  const e = eig2(m);
  return e.kind === 'complex' ? [] : [...e.values];
}
/** The real eigenpairs, strongest |λ| first (for power iteration). null if complex. */
export function dominant(m: Mat2): { value: number; vector: Vec2; other?: { value: number; vector: Vec2 } } | null {
  const e = eig2(m);
  if (e.kind === 'complex') return null;
  if (e.kind !== 'distinct') return { value: e.values[0], vector: e.vectors[0] };
  const i = Math.abs(e.values[0]) >= Math.abs(e.values[1]) ? 0 : 1;
  return { value: e.values[i], vector: e.vectors[i], other: { value: e.values[1 - i], vector: e.vectors[1 - i] } };
}

/** Symmetric 2x2: eigenvalues λ1 >= λ2 and orthonormal eigenvectors q1, q2 (q2 = q1 turned 90°). */
export function sym_eig2(s: Mat2): { values: [number, number]; vectors: [Vec2, Vec2] } {
  const a = s[0][0], b = (s[0][1] + s[1][0]) / 2, d = s[1][1];
  const mid = (a + d) / 2, rad = Math.hypot((a - d) / 2, b);
  const l1 = mid + rad, l2 = mid - rad;
  // angle of the principal axis: tan(2φ) = 2b / (a - d)
  const phi = rad < 1e-14 ? 0 : 0.5 * Math.atan2(2 * b, a - d);
  const q1 = canonical(from_angle(phi));
  return { values: [l1, l2], vectors: [q1, [-q1[1], q1[0]]] };
}
/** Symmetric matrix with eigenvalues l1, l2 and principal axis at angle phi: R Λ Rᵀ. */
export function sym_from_axes(phi: number, l1: number, l2: number): Mat2 {
  const c = Math.cos(phi), s = Math.sin(phi);
  return [
    [l1 * c * c + l2 * s * s, (l1 - l2) * c * s],
    [(l1 - l2) * c * s, l1 * s * s + l2 * c * c],
  ];
}

// ---------------------------------------------------------------- statistics
/** Mean of points (any dimension). */
export function mean(points: readonly (readonly number[])[]): number[] {
  const n = points.length, k = points[0]?.length ?? 0;
  const m = new Array(k).fill(0);
  for (const p of points) for (let j = 0; j < k; j++) m[j] += p[j];
  return m.map((x) => x / Math.max(1, n));
}
/** Sample covariance matrix (divides by n - 1, like numpy.cov). */
export function covariance(points: readonly (readonly number[])[]): number[][] {
  const n = points.length, k = points[0]?.length ?? 0;
  const mu = mean(points);
  const c = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const p of points)
    for (let i = 0; i < k; i++) for (let j = i; j < k; j++) c[i][j] += (p[i] - mu[i]) * (p[j] - mu[j]);
  const den = Math.max(1, n - 1);
  for (let i = 0; i < k; i++)
    for (let j = i; j < k; j++) {
      c[i][j] /= den;
      c[j][i] = c[i][j];
    }
  return c;
}
/** Covariance of 2D points as a Mat2 plus the mean. */
export function cov2(points: readonly Vec2[]): { mean: Vec2; cov: Mat2 } {
  const c = covariance(points), m = mean(points);
  return { mean: [m[0] ?? 0, m[1] ?? 0], cov: points.length ? mat2(c) : [[0, 0], [0, 0]] };
}
/** Correlation coefficient from a 2x2 covariance. */
export const correlation_of = (c: Mat2): number => c[0][1] / Math.sqrt(Math.max(1e-300, c[0][0] * c[1][1]));
/**
 * Variance of the projections of the points onto the line through their mean
 * with direction u (any length). Equals uᵀΣu / |u|² with the same n - 1.
 */
export function projection_variance(points: readonly (readonly number[])[], u: readonly number[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mu = mean(points), len = Math.hypot(...u);
  let s = 0;
  for (const p of points) {
    let t = 0;
    for (let j = 0; j < u.length; j++) t += (p[j] - mu[j]) * u[j];
    s += (t / len) ** 2;
  }
  return s / (n - 1);
}
/** Total variance = trace of the covariance. */
export function total_variance(points: readonly (readonly number[])[]): number {
  const c = covariance(points);
  return c.reduce((s, r, i) => s + r[i], 0);
}

// ---------------------------------------------------------------- symmetric eigen solver (Jacobi)
/**
 * Eigen-decomposition of a small symmetric matrix by cyclic Jacobi rotations.
 * Returns eigenvalues in decreasing order and the matching unit eigenvectors
 * (vectors[i] belongs to values[i]).
 */
export function jacobi_eigen(sym: readonly (readonly number[])[], max_sweeps = 60): { values: number[]; vectors: number[][] } {
  const n = sym.length;
  const a = sym.map((r, i) => r.map((x, j) => (x + sym[j][i]) / 2));
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < max_sweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p], vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  const values = order.map((i) => a[i][i]);
  const vectors = order.map((i) => {
    const e = v.map((row) => row[i]);
    // canonical sign: largest component positive
    let big = 0;
    for (let k = 1; k < n; k++) if (Math.abs(e[k]) > Math.abs(e[big]) + 1e-12) big = k;
    return e[big] < 0 ? e.map((x) => -x) : e;
  });
  return { values, vectors };
}

export interface PCA {
  mean: number[];
  /** Variances along the components (eigenvalues of the covariance), largest first. */
  values: number[];
  /** Unit principal directions, components[i] belongs to values[i]. */
  components: number[][];
  /** values / total variance. */
  explained: number[];
}
/** Principal component analysis of points (any dimension, via the covariance and Jacobi). */
export function pca(points: readonly (readonly number[])[]): PCA {
  const c = covariance(points);
  const { values, vectors } = jacobi_eigen(c);
  const clipped = values.map((x) => Math.max(0, x));
  const total = clipped.reduce((s, x) => s + x, 0) || 1;
  return { mean: mean(points), values: clipped, components: vectors, explained: clipped.map((x) => x / total) };
}
/** Project points onto the affine subspace through `origin` spanned by orthonormal `basis`. */
export function project_onto(p: readonly number[], origin: readonly number[], basis: readonly (readonly number[])[]): number[] {
  const d = p.map((x, i) => x - origin[i]);
  const out = [...origin];
  for (const b of basis) {
    const t = d.reduce((s, x, i) => s + x * b[i], 0);
    for (let i = 0; i < out.length; i++) out[i] += t * b[i];
  }
  return out;
}

// ---------------------------------------------------------------- seeded data
/** mulberry32: a small, fast, seeded PRNG returning numbers in [0, 1). */
export function rng(seed: number): () => number {
  let a = (Math.floor(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Standard normal samples (Box-Muller) from a seeded uniform source. */
export function gaussian(r: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u < 1e-12) u = r();
    const v = r();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  };
}
/**
 * n standard-normal points in k dimensions, whitened so that their sample mean
 * is exactly 0 and their sample covariance exactly I (then any target
 * covariance can be matched exactly by a linear map).
 */
export function white_noise(n: number, k: number, seed: number): number[][] {
  const g = gaussian(rng(seed));
  const z = Array.from({ length: n }, () => Array.from({ length: k }, () => g()));
  if (n <= k) return z;
  const mu = mean(z);
  const zc = z.map((p) => p.map((x, j) => x - mu[j]));
  // C^{-1/2} via the eigen-decomposition of C
  const { values, vectors } = jacobi_eigen(covariance(zc));
  return zc.map((p) => {
    const out = new Array(k).fill(0);
    for (let i = 0; i < k; i++) {
      const t = p.reduce((s, x, j) => s + x * vectors[i][j], 0) / Math.sqrt(Math.max(1e-12, values[i]));
      for (let j = 0; j < k; j++) out[j] += t * vectors[i][j];
    }
    return out;
  });
}
/** 2x2 covariance with standard deviations sx, sy and correlation rho. */
export function cov_from(sx: number, sy: number, rho: number): Mat2 {
  return [[sx * sx, rho * sx * sy], [rho * sx * sy, sy * sy]];
}
/**
 * A seeded 2D Gaussian cloud whose sample mean is exactly `center` and whose
 * sample covariance is exactly cov_from(spread, spread * aspect, correlation).
 */
export function cloud2(o: { n: number; correlation: number; spread: number; aspect?: number; seed?: number; center?: Vec2 }): Vec2[] {
  const sx = o.spread, sy = o.spread * (o.aspect ?? 1), rho = Math.max(-0.999, Math.min(0.999, o.correlation));
  const z = white_noise(o.n, 2, o.seed ?? 1);
  // Cholesky of the target covariance
  const l11 = sx, l21 = rho * sy, l22 = sy * Math.sqrt(1 - rho * rho);
  const c = o.center ?? [0, 0];
  return z.map(([u, v]) => [c[0] + l11 * u, c[1] + l21 * u + l22 * v]);
}
/** Rotation matrix (3x3) from yaw (about z), pitch (about y) and roll (about x), radians. */
export function rotation3(yaw: number, pitch: number, roll: number): number[][] {
  const [cz, sz, cy, sy, cx, sx] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(roll), Math.sin(roll)];
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}
/**
 * A seeded 3D cloud: exactly zero mean, standard deviations `sigmas` along
 * three orthogonal directions given by the columns of `rotation`.
 */
export function cloud3(o: { n: number; sigmas: [number, number, number]; seed?: number; rotation?: number[][] }): number[][] {
  const z = white_noise(o.n, 3, o.seed ?? 1);
  const R = o.rotation ?? rotation3(0, 0, 0);
  return z.map((p) => {
    const s = [p[0] * o.sigmas[0], p[1] * o.sigmas[1], p[2] * o.sigmas[2]];
    return [0, 1, 2].map((i) => R[i][0] * s[0] + R[i][1] * s[1] + R[i][2] * s[2]);
  });
}

// ---------------------------------------------------------------- formatting
/** A number for TeX: rounded to `d` places, trailing zeros dropped, proper minus sign. */
export function fmt(x: number, d = 2): string {
  let s = (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}
