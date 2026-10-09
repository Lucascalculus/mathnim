// manim/utils/paths.py - how points travel during a Transform.
import { OUT } from '../constants';
import { rotation_matrix, normalize, cross } from './space_ops';
import type { Point3DLike } from './vector';
import type { Points } from './points';

export type PathFuncType = (start: Points, end: Points, alpha: number) => Points;
export const STRAIGHT_PATH_THRESHOLD = 0.01;

export function straight_path(): PathFuncType {
  return (a, b, t) => {
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (1 - t) * a[i] + t * b[i];
    return out;
  };
}

const rot = (p: Points, M: number[][], centers: Points | null, sign = 1): Points => {
  const out = new Float64Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const cx = centers ? centers[i] : 0, cy = centers ? centers[i + 1] : 0, cz = centers ? centers[i + 2] : 0;
    const x = p[i] - cx * sign, y = p[i + 1] - cy * sign, z = p[i + 2] - cz * sign;
    out[i] = M[0][0] * x + M[0][1] * y + M[0][2] * z;
    out[i + 1] = M[1][0] * x + M[1][1] * y + M[1][2] * z;
    out[i + 2] = M[2][0] * x + M[2][1] * y + M[2][2] * z;
  }
  return out;
};

export function path_along_circles(arc_angle: number, circles_centers: Points, axis: Point3DLike = OUT): PathFuncType {
  const ax = normalize(axis, OUT);
  return (start, end, alpha) => {
    const detrans = rot(end, rotation_matrix(-arc_angle, ax), circles_centers);
    for (let i = 0; i < detrans.length; i++) detrans[i] += circles_centers[i];
    const interp = new Float64Array(start.length);
    for (let i = 0; i < start.length; i++) interp[i] = (1 - alpha) * start[i] + alpha * detrans[i] - circles_centers[i];
    const r = rot(interp, rotation_matrix(alpha * arc_angle, ax), null);
    for (let i = 0; i < r.length; i++) r[i] += circles_centers[i];
    return r;
  };
}

export function path_along_arc(arc_angle: number, axis: Point3DLike = OUT): PathFuncType {
  if (Math.abs(arc_angle) < STRAIGHT_PATH_THRESHOLD) return straight_path();
  const ax = normalize(axis, OUT);
  return (start, end, alpha) => {
    const n = start.length;
    const centers = new Float64Array(n);
    for (let i = 0; i < n; i += 3) {
      const v = [end[i] - start[i], end[i + 1] - start[i + 1], end[i + 2] - start[i + 2]];
      let c = [start[i] + 0.5 * v[0], start[i + 1] + 0.5 * v[1], start[i + 2] + 0.5 * v[2]];
      if (arc_angle !== Math.PI) {
        const k = cross(ax, [v[0] / 2, v[1] / 2, v[2] / 2]);
        const t = Math.tan(arc_angle / 2);
        c = [c[0] + k[0] / t, c[1] + k[1] / t, c[2] + k[2] / t];
      }
      centers[i] = c[0];
      centers[i + 1] = c[1];
      centers[i + 2] = c[2];
    }
    const r = rot(start, rotation_matrix(alpha * arc_angle, ax), centers);
    for (let i = 0; i < n; i++) r[i] += centers[i];
    return r;
  };
}
export const clockwise_path = (): PathFuncType => path_along_arc(-Math.PI);
export const counterclockwise_path = (): PathFuncType => path_along_arc(Math.PI);

export function spiral_path(angle: number, axis: Point3DLike = OUT): PathFuncType {
  if (Math.abs(angle) < STRAIGHT_PATH_THRESHOLD) return straight_path();
  const ax = normalize(axis, OUT);
  return (start, end, alpha) => {
    const d = new Float64Array(start.length);
    for (let i = 0; i < d.length; i++) d[i] = end[i] - start[i];
    const r = rot(d, rotation_matrix((alpha - 1) * angle, ax), null);
    for (let i = 0; i < r.length; i++) r[i] = start[i] + alpha * r[i];
    return r;
  };
}
