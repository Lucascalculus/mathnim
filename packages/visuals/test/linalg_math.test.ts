import { describe, expect, it } from 'vitest';
import {
  apply2, char_poly, cloud2, cloud3, correlation_of, cov2, cov_from, covariance, det2, dominant, eig2, fmt, gaussian, inv2, jacobi_eigen, lerp_polar,
  mean, morph2, mul2, norm2, pca, pow2, project_onto, projection_variance, rng, rotation3, sym_eig2, sym_from_axes, total_variance, trace2, white_noise,
  type Mat2, type Vec2,
} from '../src/linalg/math';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);
const isEigen = (m: Mat2, l: number, v: Vec2, eps = 1e-9) => {
  const av = apply2(m, v);
  close(av[0], l * v[0], eps);
  close(av[1], l * v[1], eps);
  close(norm2(v), 1, eps);
};

describe('2x2 basics', () => {
  const A: Mat2 = [[3, 1], [0, 2]];
  it('det, trace, product, inverse, power', () => {
    expect(det2(A)).toBe(6);
    expect(trace2(A)).toBe(5);
    expect(mul2(A, [[1, 0], [0, 1]])).toEqual(A);
    const Ai = inv2(A)!;
    const I = mul2(A, Ai);
    close(I[0][0], 1); close(I[0][1], 0); close(I[1][0], 0); close(I[1][1], 1);
    expect(inv2([[1, 2], [2, 4]])).toBeNull();
    expect(pow2(A, 0)).toEqual([[1, 0], [0, 1]]);
    expect(pow2(A, 3)).toEqual(mul2(A, mul2(A, A)));
  });
  it('characteristic polynomial vanishes at the eigenvalues', () => {
    close(char_poly(A, 3), 0);
    close(char_poly(A, 2), 0);
    expect(char_poly(A, 0)).toBe(6);
  });
});

describe('eig2', () => {
  it('distinct real eigenvalues, largest first', () => {
    const A: Mat2 = [[3, 1], [0, 2]];
    const e = eig2(A);
    expect(e.kind).toBe('distinct');
    if (e.kind !== 'distinct') return;
    close(e.values[0], 3); close(e.values[1], 2);
    isEigen(A, e.values[0], e.vectors[0]);
    isEigen(A, e.values[1], e.vectors[1]);
    // canonical sign: x >= 0
    expect(e.vectors[0][0]).toBeGreaterThanOrEqual(0);
  });
  it('a negative eigenvalue', () => {
    const A: Mat2 = [[1, 2], [2, 1]];
    const e = eig2(A);
    if (e.kind !== 'distinct') throw new Error(e.kind);
    close(e.values[0], 3); close(e.values[1], -1);
    isEigen(A, -1, e.vectors[1]);
  });
  it('singular matrix: one eigenvalue is 0', () => {
    const A: Mat2 = [[1, 2], [0.5, 1]];
    const e = eig2(A);
    if (e.kind !== 'distinct') throw new Error(e.kind);
    close(e.values[1], 0);
    isEigen(A, 0, e.vectors[1]);
  });
  it('repeated eigenvalue with one eigenline (shear)', () => {
    const e = eig2([[2, 1], [0, 2]]);
    expect(e.kind).toBe('repeated');
    if (e.kind !== 'repeated') return;
    expect(e.values).toEqual([2, 2]);
    expect(e.vectors).toHaveLength(1);
    close(e.vectors[0][0], 1); close(e.vectors[0][1], 0);
  });
  it('scalar matrix: every direction', () => {
    const e = eig2([[1.5, 0], [0, 1.5]]);
    expect(e.kind).toBe('scalar');
  });
  it('complex eigenvalues of a rotation-like matrix', () => {
    const e = eig2([[1, -1], [1, 1]]);
    expect(e.kind).toBe('complex');
    if (e.kind !== 'complex') return;
    close(e.re, 1); close(e.im, 1); close(e.r, Math.SQRT2); close(e.theta, Math.PI / 4);
    const r90 = eig2([[0, -1], [1, 0]]);
    if (r90.kind !== 'complex') throw new Error(r90.kind);
    close(r90.re, 0); close(r90.im, 1);
  });
  it('the zero matrix is scalar', () => {
    expect(eig2([[0, 0], [0, 0]]).kind).toBe('scalar');
  });
  it('tiny second eigenvalue keeps its precision', () => {
    const e = eig2([[1e6, 0], [0, 1e-6]]);
    if (e.kind !== 'distinct') throw new Error(e.kind);
    close(e.values[1], 1e-6, 1e-15);
  });
  it('dominant picks the largest |λ|', () => {
    const d = dominant([[1, 2], [2, 1]])!;
    close(d.value, 3);
    const n = dominant([[-3, 0], [0, 1]])!;
    close(n.value, -3);
    expect(dominant([[0, -1], [1, 0]])).toBeNull();
  });
});

describe('symmetric 2x2', () => {
  it('orthonormal eigenvectors, values descending', () => {
    const S: Mat2 = [[2, 1], [1, 1.5]];
    const { values, vectors } = sym_eig2(S);
    expect(values[0]).toBeGreaterThan(values[1]);
    isEigen(S, values[0], vectors[0]);
    isEigen(S, values[1], vectors[1]);
    close(vectors[0][0] * vectors[1][0] + vectors[0][1] * vectors[1][1], 0);
  });
  it('round trip with sym_from_axes', () => {
    const S = sym_from_axes(0.7, 3, -0.5);
    const { values, vectors } = sym_eig2(S);
    close(values[0], 3); close(values[1], -0.5);
    close(Math.abs(Math.atan2(vectors[0][1], vectors[0][0])), 0.7);
  });
});

describe('interpolation', () => {
  it('lerp_polar keeps endpoints and turns the short way', () => {
    const a: Vec2 = [1, 0], b: Vec2 = [0, 2];
    expect(lerp_polar(a, b, 0)).toEqual(a);
    const e = lerp_polar(a, b, 1);
    close(e[0], 0); close(e[1], 2);
    const m = lerp_polar(a, b, 0.5);
    close(Math.atan2(m[1], m[0]), Math.PI / 4);
    close(norm2(m), 1.5);
  });
  it('morph2 goes from I to A', () => {
    const A: Mat2 = [[2, -1], [1, 1]];
    const M = morph2([[1, 0], [0, 1]], A, 1);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) close(M[i][j], A[i][j]);
  });
});

describe('statistics', () => {
  const pts: Vec2[] = [[1, 2], [2, 3], [3, 5], [4, 4]];
  it('mean and covariance (n - 1)', () => {
    expect(mean(pts)).toEqual([2.5, 3.5]);
    const c = covariance(pts);
    close(c[0][0], 5 / 3);
    close(c[0][1], 4 / 3);
    close(c[1][1], 5 / 3);
    const { cov } = cov2(pts);
    close(correlation_of(cov), 0.8);
  });
  it('projection variance is uᵀΣu and peaks on the top eigenvector', () => {
    const { cov } = cov2(pts);
    const u: Vec2 = [0.6, 0.8];
    close(projection_variance(pts, u), u[0] * u[0] * cov[0][0] + 2 * u[0] * u[1] * cov[0][1] + u[1] * u[1] * cov[1][1]);
    const { values, vectors } = sym_eig2(cov);
    let best = 0, arg = 0;
    for (let k = 0; k < 3600; k++) {
      const a = (k / 3600) * Math.PI, v = projection_variance(pts, [Math.cos(a), Math.sin(a)]);
      if (v > best) (best = v), (arg = a);
    }
    close(best, values[0], 1e-5);
    close(Math.abs(Math.cos(arg) * vectors[0][0] + Math.sin(arg) * vectors[0][1]), 1, 1e-5);
    // along + across = total
    close(projection_variance(pts, [1, 0]) + projection_variance(pts, [0, 1]), total_variance(pts));
  });
});

describe('jacobi and pca', () => {
  it('diagonalises a symmetric 3x3', () => {
    const S = [[4, 1, 2], [1, 3, 0.5], [2, 0.5, 1]];
    const { values, vectors } = jacobi_eigen(S);
    expect(values[0]).toBeGreaterThanOrEqual(values[1]);
    expect(values[1]).toBeGreaterThanOrEqual(values[2]);
    values.forEach((l, i) => {
      const v = vectors[i];
      const Sv = S.map((r) => r.reduce((s, x, j) => s + x * v[j], 0));
      Sv.forEach((x, k) => close(x, l * v[k], 1e-9));
      close(Math.hypot(...v), 1);
    });
    close(vectors[0].reduce((s, x, k) => s + x * vectors[1][k], 0), 0);
    close(values.reduce((s, x) => s + x, 0), 8);
  });
  it('recovers the axes of a seeded 3D cloud', () => {
    const R = rotation3(0.6, -0.4, 0.9);
    const pts = cloud3({ n: 150, sigmas: [2, 1, 0.3], seed: 7, rotation: R });
    const p = pca(pts);
    close(p.values[0], 4, 1e-9); close(p.values[1], 1, 1e-9); close(p.values[2], 0.09, 1e-9);
    p.mean.forEach((x) => close(x, 0, 1e-12));
    // first component is the first column of R (up to sign)
    close(Math.abs(p.components[0][0] * R[0][0] + p.components[0][1] * R[1][0] + p.components[0][2] * R[2][0]), 1, 1e-9);
    close(p.explained.reduce((s, x) => s + x, 0), 1);
    const q = project_onto([1, 2, 3], [0, 0, 0], [[1, 0, 0], [0, 1, 0]]);
    expect(q).toEqual([1, 2, 0]);
  });
});

describe('seeded data', () => {
  it('rng and gaussian are deterministic', () => {
    const a = rng(42), b = rng(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
    const g1 = gaussian(rng(3)), g2 = gaussian(rng(3));
    expect([g1(), g1(), g1()]).toEqual([g2(), g2(), g2()]);
    expect(rng(1)()).not.toBe(rng(2)());
  });
  it('white noise has exactly zero mean and identity covariance', () => {
    const z = white_noise(40, 2, 5);
    const c = covariance(z);
    close(c[0][0], 1); close(c[1][1], 1); close(c[0][1], 0);
    mean(z).forEach((x) => close(x, 0, 1e-12));
  });
  it('cloud2 matches its parameters exactly', () => {
    const pts = cloud2({ n: 80, correlation: 0.7, spread: 1.2, aspect: 0.8, seed: 3, center: [1, -1] });
    const { mean: m, cov } = cov2(pts);
    close(m[0], 1); close(m[1], -1);
    const target = cov_from(1.2, 0.96, 0.7);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) close(cov[i][j], target[i][j]);
    close(correlation_of(cov), 0.7);
    // near-perfect correlation stays finite
    const tight = cov2(cloud2({ n: 30, correlation: 0.99, spread: 1, seed: 1 })).cov;
    close(correlation_of(tight), 0.99);
  });
});

describe('fmt', () => {
  it('drops trailing zeros and negative zero', () => {
    expect(fmt(2)).toBe('2');
    expect(fmt(2.5)).toBe('2.5');
    expect(fmt(-0.0001)).toBe('0');
    expect(fmt(1.23456, 3)).toBe('1.235');
  });
});
