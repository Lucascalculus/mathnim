// A small numpy (plus math and random) for transpiled manim code.
// Arrays are plain nested JS arrays; see runtime.ts for operators.
import { Complex, toComplex } from '../../utils/complex';
import { MT19937, python_seed } from './random';
import { KW, L, PyError, PyList, bc, deepCopy, map1, matmul, reshape, shape, toPyList, transpose, truthy } from './runtime';

const arr = (x: any): any => (ArrayBuffer.isView(x) ? Array.from(x as any) : x instanceof PyList ? Array.from(x, arr) : Array.isArray(x) ? x.map(arr) : x);
const flat = (x: any): any[] => (Array.isArray(x) || ArrayBuffer.isView(x) ? Array.from(x as any).flatMap(flat) : [x]);
const takeKw = (args: any[]): Record<string, any> => (args.length && args[args.length - 1]?.[KW] ? args.pop() : {});
const ufunc = (f: (x: number) => number, cf?: (z: Complex) => any) => (x: any) => map1(x, (v) => (v instanceof Complex ? (cf ? cf(v) : NaN) : f(v)));
const ufunc2 = (f: (x: number, y: number) => number) => (a: any, b: any) => bc(a, b, f);

function axisReduce(a: any, axis: number | null | undefined, f: (xs: number[]) => number): any {
  const A = arr(a);
  if (axis === null || axis === undefined) return f(flat(A));
  if (axis === 0) {
    if (!Array.isArray(A[0])) return f(A);
    return A[0].map((_: any, j: number) => axisReduce(A.map((r: any) => r[j]), null, f));
  }
  return A.map((row: any) => axisReduce(row, axis - 1, f));
}
const linspace = (start: number, stop: number, num = 50, ...rest: any[]) => {
  const o = takeKw(rest);
  const endpoint = o.endpoint ?? rest[0] ?? true;
  const div = endpoint ? num - 1 : num;
  const step = div > 0 ? (stop - start) / div : 0;
  const out = Array.from({ length: num }, (_, i) => start + i * step);
  if (endpoint && num > 1) out[num - 1] = stop;
  return out;
};
function arange(a: number, b?: number, step = 1): number[] {
  const [start, stop] = b === undefined || b === null ? [0, a] : [a, b];
  const n = Math.max(0, Math.ceil((stop - start) / step));
  return Array.from({ length: n }, (_, i) => start + i * step);
}
const full = (shp: any, v: any): any => {
  const dims = typeof shp === 'number' ? [shp] : Array.from(shp as number[]);
  const build = (k: number): any => (k === dims.length ? v : Array.from({ length: dims[k] }, () => build(k + 1)));
  return build(0);
};
function norm(x: any, ...rest: any[]): any {
  const o = takeKw(rest);
  const axis = o.axis ?? rest[1] ?? null;
  const ord = o.ord ?? rest[0] ?? null;
  const vn = (xs: any[]) => {
    const v = xs.map((z) => (z instanceof Complex ? z.abs() : Math.abs(z)));
    if (ord === Infinity) return Math.max(...v);
    if (ord === 1) return v.reduce((s, z) => s + z, 0);
    return Math.sqrt(v.reduce((s, z) => s + z * z, 0));
  };
  if (axis === null) return vn(flat(x));
  const A = arr(x);
  if (axis === 1 || axis === -1) return A.map((r: any) => vn(flat(r)));
  return A[0].map((_: any, j: number) => vn(A.map((r: any) => r[j])));
}
function inv(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    if (d === 0) throw new PyError('LinAlgError', 'Singular matrix');
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = a[r][c];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((r) => r.slice(n));
}
function det(m: number[][]): number {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  return m[0].reduce((s, v, j) => s + (j % 2 ? -1 : 1) * v * det(m.slice(1).map((r) => r.filter((_, k) => k !== j))), 0);
}
function solve(A: number[][], b: any): any {
  return matmul(inv(A), b);
}
function eig2(m: number[][]): [number[], number[][]] {
  // 2x2 real eigen-decomposition (enough for manim's linear-algebra examples)
  const [[a, b], [c, d]] = m;
  const tr = a + d, dt = a * d - b * c;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - dt));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  const vec = (l: number) => {
    let v = b !== 0 ? [b, l - a] : c !== 0 ? [l - d, c] : l === a ? [1, 0] : [0, 1];
    const n = Math.hypot(v[0], v[1]);
    return v.map((x) => x / n);
  };
  const v1 = vec(l1), v2 = vec(l2);
  return [[l1, l2], [[v1[0], v2[0]], [v1[1], v2[1]]]];
}
function cross(a: any, b: any): any {
  const A = arr(a), B = arr(b);
  if (Array.isArray(A[0])) return A.map((r: any, i: number) => cross(r, Array.isArray(B[0]) ? B[i] : B));
  if (A.length === 2 && B.length === 2) return A[0] * B[1] - A[1] * B[0];
  const [a1, a2, a3 = 0] = A, [b1, b2, b3 = 0] = B;
  return [a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1];
}
function concatenate(arrays: any[], ...rest: any[]): any {
  const o = takeKw(rest);
  const axis = o.axis ?? rest[0] ?? 0;
  const As = Array.from(arrays, arr);
  if (axis === 0) return As.flatMap((a: any) => a);
  return As[0].map((_: any, i: number) => As.flatMap((a: any) => a[i]));
}
const vstack = (arrays: any[]) => Array.from(arrays, arr).flatMap((a: any) => (Array.isArray(a[0]) ? a : [a]));
const hstack = (arrays: any[]) => {
  const As = Array.from(arrays, arr);
  if (!Array.isArray(As[0][0])) return As.flat();
  return As[0].map((_: any, i: number) => As.flatMap((a: any) => a[i]));
};
const column_stack = (arrays: any[]) => {
  const As = Array.from(arrays, arr);
  return As[0].map((_: any, i: number) => As.flatMap((a: any) => (Array.isArray(a[i]) ? a[i] : [a[i]])));
};
function stack(arrays: any[], ...rest: any[]): any {
  const o = takeKw(rest);
  const axis = o.axis ?? rest[0] ?? 0;
  const As = Array.from(arrays, arr);
  if (axis === 0) return As;
  return As[0].map((_: any, i: number) => As.map((a: any) => a[i]));
}
function meshgrid(...xs: any[]): any[] {
  const [x, y] = xs.map(arr);
  return [y.map(() => x.slice()), y.map((v: number) => x.map(() => v))];
}
function interp(x: any, xp: number[], fp: number[]): any {
  return map1(x, (v: number) => {
    if (v <= xp[0]) return fp[0];
    if (v >= xp[xp.length - 1]) return fp[fp.length - 1];
    let i = 1;
    while (xp[i] < v) i++;
    const t = (v - xp[i - 1]) / (xp[i] - xp[i - 1]);
    return fp[i - 1] + t * (fp[i] - fp[i - 1]);
  });
}
const where = (c: any, a?: any, b?: any): any => {
  if (a === undefined) return [flat(c).flatMap((v, i) => (truthy(v) ? [i] : []))];
  return bc(bc(c, a, (cc, aa) => [cc, aa]), b, ([cc, aa]: any, bb: any) => (truthy(cc) ? aa : bb));
};
function clip(a: any, lo: any, hi: any): any {
  return bc(bc(a, lo === null ? -Infinity : lo, Math.max), hi === null ? Infinity : hi, Math.min);
}
const isclose = (a: any, b: any, ...rest: any[]) => {
  const o = takeKw(rest);
  const rtol = o.rtol ?? rest[0] ?? 1e-5, atol = o.atol ?? rest[1] ?? 1e-8;
  return bc(a, b, (x, y) => Math.abs(x - y) <= atol + rtol * Math.abs(y));
};

// ---------------------------------------------------------------- random
const npRng = new MT19937();
const size = (s: any, f: () => number): any => (s === null || s === undefined ? f() : buildSized(s, f));
function buildSized(s: any, f: () => number): any {
  const dims = typeof s === 'number' ? [s] : Array.from(s as number[]);
  const build = (k: number): any => (k === dims.length ? f() : Array.from({ length: dims[k] }, () => build(k + 1)));
  return build(0);
}
const nprandom = {
  seed: (s: number | null = null) => (s === null ? npRng.init_genrand((Math.random() * 2 ** 32) >>> 0) : npRng.init_genrand(s >>> 0)),
  random: (s: any = null) => size(s, () => npRng.random()),
  random_sample: (s: any = null) => size(s, () => npRng.random()),
  rand: (...dims: number[]) => (dims.length ? buildSized(dims, () => npRng.random()) : npRng.random()),
  randn: (...dims: number[]) => (dims.length ? buildSized(dims, () => npRng.legacy_gauss()) : npRng.legacy_gauss()),
  uniform: (low = 0, high = 1, s: any = null) => {
    const o = typeof s === 'object' && s?.[KW] ? s : null;
    return size(o ? o.size : s, () => low + (high - low) * npRng.random());
  },
  normal: (loc = 0, scale = 1, s: any = null) => size(s, () => loc + scale * npRng.legacy_gauss()),
  standard_normal: (s: any = null) => size(s, () => npRng.legacy_gauss()),
  randint: (low: number, high: number | null = null, s: any = null) => {
    const [lo, hi] = high === null ? [0, low] : [low, high];
    return size(s, () => lo + npRng.bounded(hi - lo - 1));
  },
  choice: (a: any, s: any = null, replace = true) => {
    const items: any[] = typeof a === 'number' ? arange(a) : Array.from(a);
    if (!replace && s !== null) {
      const perm = items.slice();
      for (let i = perm.length - 1; i > 0; i--) {
        const j = npRng.bounded(i);
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      return perm.slice(0, s);
    }
    return size(s, () => items[npRng.bounded(items.length - 1)]);
  },
  shuffle: (a: any[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = npRng.bounded(i);
      [a[i], a[j]] = [a[j], a[i]];
    }
  },
  permutation: (a: any) => {
    const p = typeof a === 'number' ? arange(a) : Array.from(a);
    nprandom.shuffle(p);
    return p;
  },
  default_rng: (seed: number | null = null) => {
    // web: numpy's PCG64 Generator is not reproduced; seeded MT19937 instead.
    const r = new MT19937(seed ?? undefined);
    return {
      random: (s: any = null) => size(s, () => r.random()),
      uniform: (lo = 0, hi = 1, s: any = null) => size(s, () => lo + (hi - lo) * r.random()),
      normal: (loc = 0, scale = 1, s: any = null) => size(s, () => loc + scale * r.legacy_gauss()),
      integers: (lo: number, hi: number | null = null, s: any = null) => {
        const [a, b] = hi === null ? [0, lo] : [lo, hi];
        return size(s, () => a + r.bounded(b - a - 1));
      },
    };
  },
};

export const np: Record<string, any> = {
  pi: Math.PI, e: Math.E, inf: Infinity, nan: NaN, newaxis: null, euler_gamma: 0.5772156649015329,
  // scalar or (nested) array conversions; uint8 wraps modulo 256 like numpy
  float64: (x: any) => map1(x, Number), float32: (x: any) => map1(x, Number), int64: (x: any) => map1(x, Math.trunc), int32: (x: any) => map1(x, Math.trunc),
  uint8: (x: any) => map1(x, (v) => ((Math.trunc(v) % 256) + 256) % 256), float_: (x: any) => map1(x, Number), int_: (x: any) => map1(x, Math.trunc), complex128: toComplex, bool_: Boolean,
  ndarray: Array,
  array: (x: any, ..._r: any[]) => arr(x),
  asarray: (x: any, ..._r: any[]) => arr(x),
  copy: (x: any) => deepCopy(arr(x)),
  zeros: (s: any) => full(s, 0),
  ones: (s: any) => full(s, 1),
  full: (s: any, v: any) => full(s, v),
  zeros_like: (a: any) => map1(a, () => 0),
  ones_like: (a: any) => map1(a, () => 1),
  full_like: (a: any, v: any) => map1(a, () => v),
  empty: (s: any) => full(s, 0),
  eye: (n: number) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))),
  identity: (n: number) => np.eye(n),
  diag: (v: number[]) => v.map((x, i) => v.map((_, j) => (i === j ? x : 0))),
  linspace, arange,
  sin: ufunc(Math.sin, (z) => z.sin()), cos: ufunc(Math.cos, (z) => z.cos()), tan: ufunc(Math.tan),
  arcsin: ufunc(Math.asin), arccos: ufunc(Math.acos), arctan: ufunc(Math.atan), arctan2: ufunc2(Math.atan2),
  sinh: ufunc(Math.sinh), cosh: ufunc(Math.cosh), tanh: ufunc(Math.tanh), arcsinh: ufunc(Math.asinh), arccosh: ufunc(Math.acosh), arctanh: ufunc(Math.atanh),
  exp: ufunc(Math.exp, (z) => z.exp()), log: ufunc(Math.log, (z) => z.log()), log2: ufunc(Math.log2), log10: ufunc(Math.log10), log1p: ufunc(Math.log1p), expm1: ufunc(Math.expm1),
  sqrt: ufunc(Math.sqrt, (z) => z.sqrt()), cbrt: ufunc(Math.cbrt), square: ufunc((x) => x * x),
  abs: ufunc(Math.abs, (z) => z.abs()), absolute: ufunc(Math.abs, (z) => z.abs()), fabs: ufunc(Math.abs),
  floor: ufunc(Math.floor), ceil: ufunc(Math.ceil), trunc: ufunc(Math.trunc), rint: ufunc((x) => roundHalfEven(x)),
  round: (a: any, d = 0) => map1(a, (x) => roundHalfEven(x * 10 ** d) / 10 ** d), around: (a: any, d = 0) => np.round(a, d),
  sign: ufunc(Math.sign), degrees: ufunc((x) => (x * 180) / Math.PI), radians: ufunc((x) => (x * Math.PI) / 180),
  deg2rad: ufunc((x) => (x * Math.PI) / 180), rad2deg: ufunc((x) => (x * 180) / Math.PI),
  real: (z: any) => map1(z, (v) => (v instanceof Complex ? v.re : v)), imag: (z: any) => map1(z, (v) => (v instanceof Complex ? v.im : 0)),
  angle: (z: any) => map1(z, (v) => toComplex(v).arg()), conj: (z: any) => map1(z, (v) => (v instanceof Complex ? v.conjugate() : v)),
  maximum: ufunc2(Math.max), minimum: ufunc2(Math.min), power: ufunc2((a, b) => a ** b), mod: ufunc2((a, b) => ((a % b) + b) % b), hypot: ufunc2(Math.hypot),
  add: ufunc2((a, b) => a + b), subtract: ufunc2((a, b) => a - b), multiply: ufunc2((a, b) => a * b), divide: ufunc2((a, b) => a / b),
  clip, where, interp,
  isclose, allclose: (a: any, b: any, ...r: any[]) => flat(isclose(a, b, ...r)).every(Boolean),
  array_equal: (a: any, b: any) => JSON.stringify(arr(a)) === JSON.stringify(arr(b)),
  isnan: ufunc((x) => (Number.isNaN(x) ? 1 : 0) as any), isinf: ufunc((x) => (!Number.isFinite(x) && !Number.isNaN(x) ? 1 : 0) as any), isfinite: ufunc((x) => Number.isFinite(x) as any),
  sum: (a: any, ...r: any[]) => {
    const o = takeKw(r);
    return axisReduce(a, o.axis ?? r[0], (xs) => xs.reduce((s, x) => s + x, 0));
  },
  prod: (a: any, ...r: any[]) => {
    const o = takeKw(r);
    return axisReduce(a, o.axis ?? r[0], (xs) => xs.reduce((s, x) => s * x, 1));
  },
  mean: (a: any, ...r: any[]) => {
    const o = takeKw(r);
    return axisReduce(a, o.axis ?? r[0], (xs) => xs.reduce((s, x) => s + x, 0) / xs.length);
  },
  average: (a: any, ...r: any[]) => {
    const o = takeKw(r);
    const w = o.weights;
    if (!w) return np.mean(a, ...r);
    const A = flat(a), W = flat(w);
    return A.reduce((s, x, i) => s + x * W[i], 0) / W.reduce((s, x) => s + x, 0);
  },
  std: (a: any) => {
    const xs = flat(a), m = xs.reduce((s, x) => s + x, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
  },
  max: (a: any, ...r: any[]) => axisReduce(a, takeKw(r).axis ?? r[0], (xs) => Math.max(...xs)),
  min: (a: any, ...r: any[]) => axisReduce(a, takeKw(r).axis ?? r[0], (xs) => Math.min(...xs)),
  amax: (a: any, ...r: any[]) => np.max(a, ...r), amin: (a: any, ...r: any[]) => np.min(a, ...r),
  argmax: (a: any) => { const f = flat(a); return f.indexOf(Math.max(...f)); },
  argmin: (a: any) => { const f = flat(a); return f.indexOf(Math.min(...f)); },
  cumsum: (a: any) => { let s = 0; return flat(a).map((x) => (s += x)); },
  cumprod: (a: any) => { let s = 1; return flat(a).map((x) => (s *= x)); },
  diff: (a: any) => { const f = arr(a); return f.slice(1).map((x: number, i: number) => x - f[i]); },
  all: (a: any) => flat(a).every(truthy), any: (a: any) => flat(a).some(truthy),
  sort: (a: any) => flat(a).sort((x, y) => x - y),
  argsort: (a: any) => flat(a).map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]).map((p) => p[1]),
  unique: (a: any) => [...new Set(flat(a))].sort((x, y) => x - y),
  flip: (a: any) => arr(a).slice().reverse(),
  roll: (a: any, k: number) => { const f = arr(a); const n = f.length; return f.map((_: any, i: number) => f[(((i - k) % n) + n) % n]); },
  append: (a: any, v: any, ...r: any[]) => {
    const o = takeKw(r);
    const axis = o.axis ?? r[0];
    if (axis === undefined || axis === null) return [...flat(a), ...flat(v)];
    return concatenate([a, v], axis);
  },
  insert: (a: any, i: number, v: any) => { const f = flat(a); f.splice(i, 0, ...flat(v)); return f; },
  delete: (a: any, i: number, axis: number | null = null) => { const f = axis === null ? flat(a) : arr(a).slice(); f.splice(i, 1); return f; },
  concatenate, vstack, hstack, column_stack, stack, row_stack: vstack,
  transpose: (a: any) => transpose(arr(a)), reshape: (a: any, s: any) => reshape(arr(a), Array.isArray(s) ? s : [s]),
  ravel: (a: any) => flat(a), outer: (a: any, b: any) => flat(a).map((x) => flat(b).map((y) => x * y)),
  dot: (a: any, b: any) => (typeof a === 'number' || typeof b === 'number' ? bc(a, b, (x, y) => x * y) : matmul(arr(a), arr(b))),
  matmul: (a: any, b: any) => matmul(arr(a), arr(b)), inner: (a: any, b: any) => matmul(arr(a), arr(b)), vdot: (a: any, b: any) => matmul(flat(a), flat(b)),
  cross, meshgrid,
  shape: (a: any) => toPyList(shape(a)), size: (a: any) => flat(a).length, ndim: (a: any) => shape(a).length,
  tile: (a: any, n: number) => Array.from({ length: n }, () => arr(a)).flat(),
  repeat: (a: any, n: number) => flat(a).flatMap((x) => Array.from({ length: n }, () => x)),
  gcd: ufunc2((a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }),
  math: null as any,
  exp2: ufunc((x) => 2 ** x),
  histogram: (a: any, bins = 10) => {
    const f = flat(a), lo = Math.min(...f), hi = Math.max(...f), w = (hi - lo) / bins;
    const counts = Array(bins).fill(0);
    for (const x of f) counts[Math.min(bins - 1, Math.floor((x - lo) / w))]++;
    return L(counts, linspace(lo, hi, bins + 1));
  },
  polyval: (p: number[], x: any) => map1(x, (v) => p.reduce((s, c) => s * v + c, 0)),
  vectorize: (f: (...a: any[]) => any) => (...a: any[]) => (Array.isArray(a[0]) ? map1(a[0], (v) => f(v, ...a.slice(1))) : f(...a)),
  linalg: {
    norm, inv, det, solve,
    eig: (m: number[][]) => eig2(arr(m)),
    matrix_power: (m: number[][], k: number) => { let r = np.eye(m.length); for (let i = 0; i < k; i++) r = matmul(r, m); return r; },
  },
  random: nprandom,
};
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : r;
}

export const math: Record<string, any> = {
  pi: Math.PI, e: Math.E, tau: 2 * Math.PI, inf: Infinity, nan: NaN,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  exp: Math.exp, log: (x: number, base?: number) => (base === undefined ? Math.log(x) : Math.log(x) / Math.log(base)), log2: Math.log2, log10: Math.log10, log1p: Math.log1p,
  sqrt: Math.sqrt, pow: Math.pow, fabs: Math.abs, floor: Math.floor, ceil: Math.ceil, trunc: Math.trunc, hypot: Math.hypot,
  degrees: (x: number) => (x * 180) / Math.PI, radians: (x: number) => (x * Math.PI) / 180,
  factorial: (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  comb: (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); },
  perm: (n: number, k: number) => { let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; },
  gcd: (a: number, b: number) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; },
  isclose: (a: number, b: number, o: any = {}) => Math.abs(a - b) <= Math.max((o.rel_tol ?? 1e-9) * Math.max(Math.abs(a), Math.abs(b)), o.abs_tol ?? 0),
  copysign: (a: number, b: number) => Math.abs(a) * (b < 0 || Object.is(b, -0) ? -1 : 1),
  fmod: (a: number, b: number) => a % b, modf: (x: number) => L(x % 1, Math.trunc(x)),
  isnan: Number.isNaN, isinf: (x: number) => !Number.isFinite(x) && !Number.isNaN(x), isfinite: Number.isFinite,
  erf: (x: number) => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
  },
  gamma: (x: number): number => {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * math.gamma(1 - x));
    x -= 1;
    let a = c[0];
    const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return Math.sqrt(2 * Math.PI) * t ** (x + 0.5) * Math.exp(-t) * a;
  },
};
np.math = math;

const pyRng = new MT19937();
export const random: Record<string, any> = {
  seed: (a: number | null = null) => python_seed(pyRng, a),
  random: () => pyRng.random(),
  uniform: (a: number, b: number) => a + (b - a) * pyRng.random(),
  randint: (a: number, b: number) => a + pyRng.randbelow(b - a + 1),
  randrange: (a: number, b?: number, step = 1) => {
    const [lo, hi] = b === undefined ? [0, a] : [a, b];
    return lo + step * pyRng.randbelow(Math.ceil((hi - lo) / step));
  },
  choice: (seq: any) => {
    const items = Array.from(seq as ArrayLike<any>);
    return items[pyRng.randbelow(items.length)];
  },
  shuffle: (x: any[]) => {
    for (let i = x.length - 1; i > 0; i--) {
      const j = pyRng.randbelow(i + 1);
      [x[i], x[j]] = [x[j], x[i]];
    }
  },
  sample: (seq: any, k: number) => {
    const pool = Array.from(seq as ArrayLike<any>);
    const out = new PyList();
    for (let i = 0; i < k; i++) {
      const j = pyRng.randbelow(pool.length - i);
      out.push(pool[j]);
      pool[j] = pool[pool.length - i - 1];
    }
    return out;
  },
  gauss: (mu = 0, sigma = 1) => mu + sigma * pyRng.legacy_gauss(),
  normalvariate: (mu = 0, sigma = 1) => mu + sigma * pyRng.legacy_gauss(),
};
