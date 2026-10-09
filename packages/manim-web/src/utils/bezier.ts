// manim/utils/bezier.py
// A Bezier curve is a short list of control points (Point3D[]).
import type { Point3D, Point3DLike } from './vector';
import { to3 } from './vector';

type P = Point3DLike;
const at = (p: readonly P[], i: number): Point3D => to3(p[i]);
const lin = (terms: [number, P][]): Point3D => {
  const r: Point3D = [0, 0, 0];
  for (const [c, q] of terms) {
    r[0] += c * q[0];
    r[1] += c * q[1];
    r[2] += c * (q[2] ?? 0);
  }
  return r;
};

/** Returns the parametric function of the Bezier curve with the given control points. */
export function bezier(points: readonly P[]): (t: number) => Point3D {
  const Pts = points.map(to3);
  const degree = Pts.length - 1;
  if (degree === 0) return () => [...Pts[0]] as Point3D;
  if (degree === 1) return (t) => lin([[1 - t, Pts[0]], [t, Pts[1]]]);
  if (degree === 2)
    return (t) => {
      const mt = 1 - t;
      return lin([[mt * mt, Pts[0]], [2 * t * mt, Pts[1]], [t * t, Pts[2]]]);
    };
  if (degree === 3)
    return (t) => {
      const t2 = t * t, t3 = t2 * t, mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
      return lin([[mt3, Pts[0]], [3 * t * mt2, Pts[1]], [3 * t2 * mt, Pts[2]], [t3, Pts[3]]]);
    };
  return (t) => {
    const B = Pts.map((q) => [...q] as Point3D);
    for (let i = 0; i < degree; i++)
      for (let j = 0; j < degree - i; j++) for (let k = 0; k < 3; k++) B[j][k] += t * (B[j + 1][k] - B[j][k]);
    return B[0];
  };
}

/** The part of a Bezier curve between parameters a and b, as new control points. */
export function partial_bezier_points(points: readonly P[], a: number, b: number): Point3D[] {
  const pts = points.map(to3);
  const N = pts.length;
  if (a === 1) return pts.map(() => [...pts[N - 1]] as Point3D);
  if (b === 0) return pts.map(() => [...pts[0]] as Point3D);
  const degree = N - 1;
  if (degree === 3) {
    const ma = 1 - a, mb = 1 - b;
    const a2 = a * a, b2 = b * b, ma2 = ma * ma, mb2 = mb * mb;
    const a3 = a2 * a, b3 = b2 * b, ma3 = ma2 * ma, mb3 = mb2 * mb;
    const M = [
      [ma3, 3 * ma2 * a, 3 * ma * a2, a3],
      [ma2 * mb, 2 * ma * a * mb + ma2 * b, a2 * mb + 2 * ma * a * b, a2 * b],
      [ma * mb2, a * mb2 + 2 * ma * mb * b, 2 * a * mb * b + ma * b2, a * b2],
      [mb3, 3 * mb2 * b, 3 * mb * b2, b3],
    ];
    return M.map((row) => lin(row.map((c, i) => [c, pts[i]] as [number, P])));
  }
  if (degree === 2) {
    const ma = 1 - a, mb = 1 - b;
    const M = [
      [ma * ma, 2 * a * ma, a * a],
      [ma * mb, a * mb + ma * b, a * b],
      [mb * mb, 2 * b * mb, b * b],
    ];
    return M.map((row) => lin(row.map((c, i) => [c, pts[i]] as [number, P])));
  }
  if (degree === 1) {
    const d = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
    return [0, 1].map((k) => {
      const s = k === 0 ? a : b;
      return [pts[0][0] + s * d[0], pts[0][1] + s * d[1], pts[0][2] + s * d[2]] as Point3D;
    });
  }
  if (degree === 0) return pts;
  const arr = pts.map((q) => [...q] as Point3D);
  if (a !== 0) for (let i = 1; i < N; i++) for (let j = 0; j < N - i; j++) for (let k = 0; k < 3; k++) arr[j][k] += a * (arr[j + 1][k] - arr[j][k]);
  if (b !== 1) {
    const mu = (1 - b) / (1 - a);
    for (let i = 1; i < N; i++) for (let j = N - 1; j >= i; j--) for (let k = 0; k < 3; k++) arr[j][k] += mu * (arr[j - 1][k] - arr[j][k]);
  }
  return arr;
}

/** Split a Bezier curve at t into two curves (2N control points). */
export function split_bezier(points: readonly P[], t: number): Point3D[] {
  const pts = points.map(to3);
  const N = pts.length;
  const left: Point3D[] = [], right: Point3D[] = [];
  let cur = pts.map((q) => [...q] as Point3D);
  left.push(cur[0]);
  right.unshift(cur[N - 1]);
  for (let i = 1; i < N; i++) {
    cur = cur.slice(0, -1).map((q, j) => [q[0] + t * (cur[j + 1][0] - q[0]), q[1] + t * (cur[j + 1][1] - q[1]), q[2] + t * (cur[j + 1][2] - q[2])] as Point3D);
    left.push(cur[0]);
    right.unshift(cur[cur.length - 1]);
  }
  return [...left, ...right];
}

const SUBDIV_CACHE: Map<string, number[][]> = new Map();
function subdivisionMatrix(nPoints: number, n: number): number[][] {
  const key = nPoints + ':' + n;
  const hit = SUBDIV_CACHE.get(key);
  if (hit) return hit;
  const M: number[][] = [];
  if (nPoints === 4) {
    for (let i = 0; i < n; i++) {
      const i2 = i * i, i3 = i2 * i, ip1 = i + 1, ip12 = ip1 * ip1, ip13 = ip12 * ip1;
      const nmi = n - i, nmi2 = nmi * nmi, nmi3 = nmi2 * nmi, nmim1 = nmi - 1, nmim12 = nmim1 * nmim1, nmim13 = nmim12 * nmim1;
      M.push(
        [nmi3, 3 * nmi2 * i, 3 * nmi * i2, i3],
        [nmi2 * nmim1, 2 * nmi * nmim1 * i + nmi2 * ip1, nmim1 * i2 + 2 * nmi * i * ip1, i2 * ip1],
        [nmi * nmim12, nmim12 * i + 2 * nmi * nmim1 * ip1, 2 * nmim1 * i * ip1 + nmi * ip12, i * ip12],
        [nmim13, 3 * nmim12 * ip1, 3 * nmim1 * ip12, ip13],
      );
    }
    const d = n * n * n;
    M.forEach((r) => r.forEach((_, k) => (r[k] /= d)));
  } else if (nPoints === 3) {
    for (let i = 0; i < n; i++) {
      const ip1 = i + 1, nmi = n - i, nmim1 = nmi - 1;
      M.push([nmi * nmi, 2 * i * nmi, i * i], [nmi * nmim1, i * nmim1 + ip1 * nmi, i * ip1], [nmim1 * nmim1, 2 * ip1 * nmim1, ip1 * ip1]);
    }
    const d = n * n;
    M.forEach((r) => r.forEach((_, k) => (r[k] /= d)));
  } else if (nPoints === 2) {
    for (let i = 0; i < n; i++) M.push([(n - i) / n, i / n], [(n - i - 1) / n, (i + 1) / n]);
  } else if (nPoints === 1) {
    for (let i = 0; i < n; i++) M.push([1]);
  } else throw new Error('subdivide_bezier supports 1 to 4 control points');
  SUBDIV_CACHE.set(key, M);
  return M;
}

/** Split a Bezier curve into n pieces of equal parameter length. */
export function subdivide_bezier(points: readonly P[], n: number): Point3D[] {
  const pts = points.map(to3);
  if (n === 1) return pts;
  const N = pts.length;
  if (N <= 4) return subdivisionMatrix(N, n).map((row) => lin(row.map((c, i) => [c, pts[i]] as [number, P])));
  const out: Point3D[] = [];
  for (let i = 0; i < n; i++) out.push(...partial_bezier_points(pts, i / n, (i + 1) / n));
  return out;
}

/** Subdivide curves so there are `new_number_of_curves` in total. */
export function bezier_remap(tuples: readonly (readonly P[])[], new_number_of_curves: number): Point3D[][] {
  const cur = tuples.length;
  const split = new Array(cur).fill(0);
  for (let i = 0; i < new_number_of_curves; i++) split[Math.floor((i * cur) / new_number_of_curves)] += 1;
  const out: Point3D[][] = [];
  tuples.forEach((curve, i) => {
    const sf = split[i];
    if (sf === 0) return;
    const sub = subdivide_bezier(curve, sf);
    const N = curve.length;
    for (let k = 0; k < sf; k++) out.push(sub.slice(k * N, (k + 1) * N));
  });
  return out;
}

// ---------------------------------------------------------------- interpolation
export function interpolate(start: number, end: number, alpha: number): number;
export function interpolate(start: P, end: P, alpha: number): Point3D;
export function interpolate(start: any, end: any, alpha: number): any {
  if (typeof start === 'number') return (1 - alpha) * start + alpha * end;
  return [0, 1, 2].map((k) => (1 - alpha) * (start[k] ?? 0) + alpha * (end[k] ?? 0));
}

/** Integer part and residue of interpolate(start, end, alpha), clamped like manim. */
export function integer_interpolate(start: number, end: number, alpha: number): [number, number] {
  if (alpha >= 1) return [Math.trunc(end - 1), 1.0];
  if (alpha <= 0) return [Math.trunc(start), 0];
  const value = Math.trunc(interpolate(start, end, alpha));
  let residue = ((end - start) * alpha) % 1;
  if (residue < 0) residue += 1;
  return [value, residue];
}

export function mid(start: number, end: number): number;
export function mid(start: P, end: P): Point3D;
export function mid(start: any, end: any): any {
  if (typeof start === 'number') return (start + end) / 2;
  return [0, 1, 2].map((k) => ((start[k] ?? 0) + (end[k] ?? 0)) / 2);
}

export function inverse_interpolate(start: number, end: number, value: number): number {
  return (value - start) / (end - start);
}

export function match_interpolate(new_start: number, new_end: number, old_start: number, old_end: number, old_value: number): number {
  return interpolate(new_start, new_end, inverse_interpolate(old_start, old_end, old_value));
}

// ---------------------------------------------------------------- smooth handles
let CP_OPEN = [0.5];
let CP_CLOSED = [1 / 3];
let UP_CLOSED = [1 / 3];

/** manim.utils.bezier.is_closed (np.isclose with atol=1e-8, rtol=1e-5 relative to the start). */
export function is_closed(points: readonly P[]): boolean {
  const s = points[0], e = points[points.length - 1];
  for (let k = 0; k < 3; k++) {
    const tol = 1e-8 + 1e-5 * (s[k] ?? 0);
    if (Math.abs((e[k] ?? 0) - (s[k] ?? 0)) > tol) return false;
  }
  return true;
}

/** Handles making a C2-smooth cubic spline through the anchors. */
export function get_smooth_cubic_bezier_handle_points(anchors: readonly P[]): [Point3D[], Point3D[]] {
  const A = anchors.map(to3);
  const n = A.length;
  if (n === 1) return [[], []];
  if (n === 2) return [[interpolate(A[0], A[1], 1 / 3)], [interpolate(A[0], A[1], 2 / 3)]];
  return is_closed(A) ? get_smooth_closed_cubic_bezier_handle_points(A) : get_smooth_open_cubic_bezier_handle_points(A);
}

const vcomb = (a: Point3D, ca: number, b: Point3D, cb: number): Point3D => [ca * a[0] + cb * b[0], ca * a[1] + cb * b[1], ca * a[2] + cb * b[2]];

export function get_smooth_closed_cubic_bezier_handle_points(A: readonly Point3D[]): [Point3D[], Point3D[]] {
  const N = A.length - 1;
  for (let i = CP_CLOSED.length; i < N - 1; i++) {
    CP_CLOSED.push(1 / (4 - CP_CLOSED[i - 1]));
    UP_CLOSED.push(-CP_CLOSED[i] * UP_CLOSED[i - 1]);
  }
  const cp = CP_CLOSED, up = UP_CLOSED;
  const cpLast = 1 / (3 - cp[N - 2]);
  const upLast = cpLast * (1 - up[N - 2]);
  const q = new Array(N);
  q[N - 1] = upLast;
  for (let i = N - 2; i >= 0; i--) q[i] = up[i] - cp[i] * q[i + 1];
  const AUX = Array.from({ length: N }, (_, i) => vcomb(A[i], 4, A[i + 1], 2));
  const Dp: Point3D[] = new Array(N);
  Dp[0] = vcomb(AUX[0], 1 / 3, AUX[0], 0);
  for (let i = 1; i < N - 1; i++) Dp[i] = vcomb(AUX[i], cp[i], Dp[i - 1], -cp[i]);
  Dp[N - 1] = vcomb(AUX[N - 1], cpLast, Dp[N - 2], -cpLast);
  const Y = Dp;
  for (let i = N - 2; i >= 0; i--) Y[i] = vcomb(Dp[i], 1, Y[i + 1], -cp[i]);
  const k = 1 / (1 + q[0] + q[N - 1]);
  const s = vcomb(Y[0], 1, Y[N - 1], 1);
  const H1 = Y.map((y, i) => vcomb(y, 1, s, -k * q[i]));
  const H2: Point3D[] = new Array(N);
  for (let i = 0; i < N - 1; i++) H2[i] = vcomb(A[i + 1], 2, H1[i + 1], -1);
  H2[N - 1] = vcomb(A[N], 2, H1[0], -1);
  return [H1, H2];
}

export function get_smooth_open_cubic_bezier_handle_points(A: readonly Point3D[]): [Point3D[], Point3D[]] {
  const N = A.length - 1;
  for (let i = CP_OPEN.length; i < N - 1; i++) CP_OPEN.push(1 / (4 - CP_OPEN[i - 1]));
  const cp = CP_OPEN;
  const Dp: Point3D[] = new Array(N);
  Dp[0] = vcomb(A[0], 0.5, A[1], 1);
  for (let i = 1; i < N - 1; i++) Dp[i] = vcomb(vcomb(A[i], 4, A[i + 1], 2), cp[i], Dp[i - 1], -cp[i]);
  const f = 1 / (7 - 2 * cp[N - 2]);
  Dp[N - 1] = [0, 1, 2].map((k) => f * (8 * A[N - 1][k] + A[N][k] - 2 * Dp[N - 2][k])) as Point3D;
  const H1 = Dp;
  for (let i = N - 2; i >= 0; i--) H1[i] = vcomb(Dp[i], 1, H1[i + 1], -cp[i]);
  const H2: Point3D[] = new Array(N);
  for (let i = 0; i < N - 1; i++) H2[i] = vcomb(A[i + 1], 2, H1[i + 1], -1);
  H2[N - 1] = vcomb(A[N], 0.5, H1[N - 1], 0.5);
  return [H1, H2];
}

/** Two quadratic curves approximating one cubic (6 control points). */
export function get_quadratic_approximation_of_cubic(a0: P, h0: P, h1: P, a1: P): Point3D[] {
  const m0 = vcomb(to3(h0), 0.75, to3(a0), 0.25);
  const m1 = vcomb(to3(h1), 0.75, to3(a1), 0.25);
  const k = vcomb(m0, 0.5, m1, 0.5);
  return [to3(a0), m0, k, k, m1, to3(a1)];
}

// ---------------------------------------------------------------- point on curve
function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Real roots of a polynomial with coefficients c[0] + c[1] x + ... (Durand-Kerner). */
function polyRoots(c: number[]): number[] {
  while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-14) c = c.slice(0, -1);
  const n = c.length - 1;
  if (n < 1) return [];
  if (n === 1) return [-c[0] / c[1]];
  const lead = c[n];
  const a = c.map((x) => x / lead);
  let re = Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * i) / n + 0.4) * 0.9);
  let im = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / n + 0.4) * 0.9);
  for (let iter = 0; iter < 500; iter++) {
    let delta = 0;
    for (let i = 0; i < n; i++) {
      let pr = 1, pi = 0; // p(z)
      let zr = 1, zi = 0;
      pr = a[0]; pi = 0;
      for (let k = 1; k <= n; k++) {
        const nzr = zr * re[i] - zi * im[i], nzi = zr * im[i] + zi * re[i];
        zr = nzr; zi = nzi;
        pr += a[k] * zr; pi += a[k] * zi;
      }
      let dr = 1, di = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const xr = re[i] - re[j], xi = im[i] - im[j];
        const ndr = dr * xr - di * xi, ndi = dr * xi + di * xr;
        dr = ndr; di = ndi;
      }
      const den = dr * dr + di * di || 1e-300;
      const qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den;
      re[i] -= qr; im[i] -= qi;
      delta = Math.max(delta, Math.hypot(qr, qi));
    }
    if (delta < 1e-14) break;
  }
  return re.filter((_, i) => Math.abs(im[i]) < 1e-7);
}

/** Parameters t in [0, 1] where the Bezier curve passes through `point`. */
export function proportions_along_bezier_curve_for_point(point: P, control_points: readonly P[], round_to = 1e-6): number[] {
  const cps = control_points.map(to3);
  const n = cps.length - 1;
  const digits = Math.round(Math.log10(1 / round_to));
  const rootsets: number[][] = [];
  for (let dim = 0; dim < 3; dim++) {
    const coord = point[dim] ?? 0;
    const cc = cps.map((q) => q[dim]);
    const terms: number[] = [];
    for (let tp = n; tp >= 0; tp--) {
      const outer = choose(n, tp);
      let sum = 0, sign = 1;
      for (let sn = tp; sn >= 0; sn--) {
        let sub = choose(tp, sn) * sign * cc[sn];
        if (tp === 0) sub -= coord;
        sum += sub;
        sign *= -1;
      }
      terms.push(outer * sum);
    }
    if (terms.every((t) => t === 0)) continue;
    const roots = polyRoots(terms.slice().reverse()).map((r) => Number(r.toFixed(digits)));
    rootsets.push(roots);
  }
  if (!rootsets.length) return [];
  let common = rootsets[0];
  for (const rs of rootsets.slice(1)) common = common.filter((r) => rs.some((s) => Math.abs(s - r) < round_to));
  return [...new Set(common)].filter((r) => r >= 0 && r <= 1).sort((x, y) => x - y);
}

export function point_lies_on_bezier(point: P, control_points: readonly P[], round_to = 1e-6): boolean {
  return proportions_along_bezier_curve_for_point(point, control_points, round_to).length > 0;
}
