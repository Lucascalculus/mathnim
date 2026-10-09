// Helpers for flat point arrays: manim's (n, 3) numpy arrays stored as Float64Array(3n).
import type { Point3D, Point3DLike } from './vector';

export type Points = Float64Array;

export const count = (p: Points): number => p.length / 3;
export const empty = (): Points => new Float64Array(0);
export const getPoint = (p: Points, i: number): Point3D => {
  if (i < 0) i += p.length / 3;
  return [p[3 * i], p[3 * i + 1], p[3 * i + 2]];
};
export const setPoint = (p: Points, i: number, q: Point3DLike): void => {
  p[3 * i] = q[0];
  p[3 * i + 1] = q[1];
  p[3 * i + 2] = q[2] ?? 0;
};
export function fromList(list: readonly Point3DLike[]): Points {
  const out = new Float64Array(list.length * 3);
  list.forEach((q, i) => setPoint(out, i, q));
  return out;
}
export function toList(p: Points): Point3D[] {
  const out: Point3D[] = [];
  for (let i = 0; i < p.length; i += 3) out.push([p[i], p[i + 1], p[i + 2]]);
  return out;
}
export function concat(...arrs: Points[]): Points {
  let n = 0;
  for (const a of arrs) n += a.length;
  const out = new Float64Array(n);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}
/** Points [a, b) by point index (negative indices count from the end). */
export function slicePoints(p: Points, a = 0, b?: number): Points {
  const n = p.length / 3;
  if (a < 0) a += n;
  let e = b === undefined ? n : b < 0 ? b + n : b;
  e = Math.min(e, n);
  return p.slice(3 * Math.max(0, a), 3 * Math.max(a, e));
}
/** Every `step`-th point starting at `start` (numpy p[start::step]). */
export function stridePoints(p: Points, start: number, step: number): Point3D[] {
  const out: Point3D[] = [];
  for (let i = start; i < p.length / 3; i += step) out.push(getPoint(p, i));
  return out;
}
export function mapPoints(p: Points, f: (x: number, y: number, z: number) => Point3DLike): Points {
  const out = new Float64Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const r = f(p[i], p[i + 1], p[i + 2]);
    out[i] = r[0];
    out[i + 1] = r[1];
    out[i + 2] = r[2] ?? 0;
  }
  return out;
}
/** (1 - t) * a + t * b, elementwise (manim interpolate on arrays). */
export function interpolatePoints(a: Points, b: Points, t: number): Points {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (1 - t) * a[i] + t * b[i];
  return out;
}
/** p @ M.T for a 3x3 matrix M (row-major nested arrays). */
export function applyMatrix(p: Points, M: readonly (readonly number[])[]): Points {
  return mapPoints(p, (x, y, z) => [
    M[0][0] * x + M[0][1] * y + M[0][2] * z,
    M[1][0] * x + M[1][1] * y + M[1][2] * z,
    M[2][0] * x + M[2][1] * y + M[2][2] * z,
  ]);
}
export function repeatPoint(q: Point3DLike, n: number): Points {
  const out = new Float64Array(3 * n);
  for (let i = 0; i < n; i++) setPoint(out, i, q);
  return out;
}
export function pointsAllClose(a: Point3DLike, b: Point3DLike, atol = 1e-6, rtol = 1e-5): boolean {
  for (let k = 0; k < 3; k++) {
    const x = a[k] ?? 0, y = b[k] ?? 0;
    if (!(Math.abs(x - y) <= atol + rtol * Math.abs(y))) return false;
  }
  return true;
}
