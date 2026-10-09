// Small numpy-style vector helpers for 3D points (manim uses numpy arrays).
export type Point3D = [number, number, number];
export type Vector3D = Point3D;
export type Point3DLike = Point3D | readonly number[] | number[];

export const vec = (x = 0, y = 0, z = 0): Point3D => [x, y, z];
export const to3 = (p: Point3DLike): Point3D => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];

type V = Point3DLike | number;
const bin = (a: V, b: V, f: (x: number, y: number) => number): Point3D => {
  if (typeof a === 'number' && typeof b === 'number') return [f(a, b), f(a, b), f(a, b)];
  if (typeof a === 'number') return [f(a, (b as Point3DLike)[0]), f(a, (b as Point3DLike)[1]), f(a, (b as Point3DLike)[2] ?? 0)];
  if (typeof b === 'number') return [f(a[0], b), f(a[1], b), f(a[2] ?? 0, b)];
  return [f(a[0], b[0]), f(a[1], b[1]), f(a[2] ?? 0, b[2] ?? 0)];
};
/** Sum of any number of vectors (and/or scalars, broadcast). */
export const add = (...vs: V[]): Point3D => vs.reduce<Point3D>((acc, x) => bin(acc, x, (p, q) => p + q), [0, 0, 0]);
export const sub = (a: V, b: V): Point3D => bin(a, b, (p, q) => p - q);
/** Elementwise product; `mul(2, UP)` or `mul(UP, 2)` scales. */
export const mul = (a: V, b: V): Point3D => bin(a, b, (p, q) => p * q);
export const div = (a: V, b: V): Point3D => bin(a, b, (p, q) => p / q);
export const neg = (a: Point3DLike): Point3D => [-a[0], -a[1], -(a[2] ?? 0)];
export const dot = (a: Point3DLike, b: Point3DLike): number => a[0] * b[0] + a[1] * b[1] + (a[2] ?? 0) * (b[2] ?? 0);
export const cross = (a: Point3DLike, b: Point3DLike): Point3D => {
  const az = a[2] ?? 0, bz = b[2] ?? 0;
  return [a[1] * bz - az * b[1], az * b[0] - a[0] * bz, a[0] * b[1] - a[1] * b[0]];
};
/** numpy.linalg.norm (same operation order: sqrt of the sum of squares). */
export const norm = (a: Point3DLike): number => Math.sqrt(a[0] * a[0] + a[1] * a[1] + (a[2] ?? 0) * (a[2] ?? 0));
export const normalize = (a: Point3DLike, fallback?: Point3DLike): Point3D => {
  const n = norm(a);
  if (n > 0) return [a[0] / n, a[1] / n, (a[2] ?? 0) / n];
  return fallback ? to3(fallback) : [0, 0, 0];
};
/** manim.utils.bezier.interpolate: (1 - t) * a + t * b */
export const interpolate = (a: Point3DLike, b: Point3DLike, t: number): Point3D => [
  (1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1], (1 - t) * (a[2] ?? 0) + t * (b[2] ?? 0),
];
export const lerp = (a: number, b: number, t: number): number => (1 - t) * a + t * b;
export const distance = (a: Point3DLike, b: Point3DLike): number => norm(sub(a, b));
export const isClose = (a: Point3DLike, b: Point3DLike, atol = 1e-8, rtol = 1e-5): boolean =>
  [0, 1, 2].every((i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0)) <= atol + rtol * Math.abs(b[i] ?? 0));
export const isVector = (x: unknown): x is Point3DLike =>
  Array.isArray(x) && (x.length === 2 || x.length === 3) && x.every((c) => typeof c === 'number');
