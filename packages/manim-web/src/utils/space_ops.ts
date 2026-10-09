// manim/utils/space_ops.py
import { DOWN, OUT, PI, RIGHT, TAU, UP } from '../constants';
import { cross as vcross, dot, norm, normalize as vnormalize, sub, to3, type Point3D, type Point3DLike } from './vector';

export type Matrix3 = [Point3D, Point3D, Point3D];

export const norm_squared = (v: Point3DLike): number => dot(v, v);
export const cross = vcross;
export const normalize = (v: Point3DLike, fall_back?: Point3DLike): Point3D => vnormalize(v, fall_back);

export function quaternion_mult(...quats: number[][]): number[] {
  if (quats.length === 0) return [1, 0, 0, 0];
  let r = quats[0];
  for (const q of quats.slice(1)) {
    const [w1, x1, y1, z1] = r, [w2, x2, y2, z2] = q;
    r = [
      w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
      w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
      w1 * y2 + y1 * w2 + z1 * x2 - x1 * z2,
      w1 * z2 + z1 * w2 + x1 * y2 - y1 * x2,
    ];
  }
  return r;
}
export function quaternion_from_angle_axis(angle: number, axis: Point3DLike, axis_normalized = false): number[] {
  const a = axis_normalized ? to3(axis) : normalize(axis);
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), s * a[0], s * a[1], s * a[2]];
}
export function angle_axis_from_quaternion(q: number[]): [number, Point3D] {
  const axis = normalize([q[1], q[2], q[3]], [1, 0, 0]);
  let angle = 2 * Math.acos(q[0]);
  if (angle > TAU / 2) angle = TAU - angle;
  return [angle, axis];
}
export const quaternion_conjugate = (q: number[]): number[] => [q[0], -q[1], -q[2], -q[3]];

/** Rotation matrix for `angle` about `axis` (scipy Rotation.from_rotvec(...).as_matrix()). */
export function rotation_matrix(angle: number, axis: Point3DLike = OUT): Matrix3 {
  const rv = normalize(axis).map((c) => c * angle) as Point3D;
  const n = norm(rv);
  const scale = n <= 1e-3 ? 0.5 - (n * n) / 48 + (n ** 4) / 3840 : Math.sin(n / 2) / n;
  const x = scale * rv[0], y = scale * rv[1], z = scale * rv[2], w = Math.cos(n / 2);
  const x2 = x * x, y2 = y * y, z2 = z * z, w2 = w * w;
  const xy = x * y, zw = z * w, xz = x * z, yw = y * w, yz = y * z, xw = x * w;
  return [
    [x2 - y2 - z2 + w2, 2 * (xy - zw), 2 * (xz + yw)],
    [2 * (xy + zw), -x2 + y2 - z2 + w2, 2 * (yz - xw)],
    [2 * (xz - yw), 2 * (yz + xw), -x2 - y2 + z2 + w2],
  ];
}
export const rotation_matrix_transpose = (angle: number, axis: Point3DLike): Matrix3 => transpose(rotation_matrix(angle, axis));
export function rotation_about_z(angle: number): Matrix3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}
export function transpose(M: Matrix3): Matrix3 {
  return [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
}
export function mat_vec(M: readonly (readonly number[])[], v: Point3DLike): Point3D {
  return [0, 1, 2].map((i) => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * (v[2] ?? 0)) as Point3D;
}
export function mat_mul(A: readonly (readonly number[])[], B: readonly (readonly number[])[]): Matrix3 {
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j])) as Matrix3;
}

export const rotate_vector = (vector: Point3DLike, angle: number, axis: Point3DLike = OUT): Point3D => mat_vec(rotation_matrix(angle, axis), to3(vector));

export function thick_diagonal(dim: number, thickness = 2): number[][] {
  return Array.from({ length: dim }, (_, i) => Array.from({ length: dim }, (_, j) => (Math.abs(i - j) < thickness ? 1 : 0)));
}

/** Matrix whose columns are an orthonormal frame with `vector` as the z axis. */
export function z_to_vector(vector: Point3DLike): Matrix3 {
  const az = normalize(vector);
  let ay = normalize(cross(az, RIGHT));
  let ax = cross(ay, az);
  if (norm(ay) === 0) {
    ax = normalize(cross(UP, az));
    ay = cross(ax, az).map((c) => -c) as Point3D;
  }
  return transpose([ax, ay, az]);
}

export const angle_of_vector = (v: Point3DLike): number => Math.atan2(v[1], v[0]);
export function angle_between_vectors(v1: Point3DLike, v2: Point3DLike): number {
  const a = normalize(v1), b = normalize(v2);
  return 2 * Math.atan2(norm(sub(a, b)), norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]]));
}

export function get_unit_normal(v1: Point3DLike, v2: Point3DLike, tol = 1e-6): Point3D {
  const a = to3(v1), b = to3(v2);
  const div1 = Math.max(...a.map(Math.abs)), div2 = Math.max(...b.map(Math.abs));
  let u: Point3D;
  if (div1 === 0) {
    if (div2 === 0) return [...DOWN] as Point3D;
    u = b.map((c) => c / div2) as Point3D;
  } else if (div2 === 0) {
    u = a.map((c) => c / div1) as Point3D;
  } else {
    const u1 = a.map((c) => c / div1) as Point3D, u2 = b.map((c) => c / div2) as Point3D;
    const cp = cross(u1, u2);
    const n = Math.sqrt(norm_squared(cp));
    if (n > tol) return cp.map((c) => c / n) as Point3D;
    u = u1;
  }
  if (Math.abs(u[0]) < tol && Math.abs(u[1]) < tol) return [...DOWN] as Point3D;
  const cp: Point3D = [-u[0] * u[2], -u[1] * u[2], u[0] * u[0] + u[1] * u[1]];
  const n = Math.sqrt(norm_squared(cp));
  return cp.map((c) => c / n) as Point3D;
}

export function compass_directions(n = 4, start_vect: Point3DLike = RIGHT): Point3D[] {
  const angle = TAU / n;
  return Array.from({ length: n }, (_, k) => rotate_vector(start_vect, k * angle));
}

export function regular_vertices(n: number, o: { radius?: number; start_angle?: number | null } = {}): [Point3D[], number] {
  const radius = o.radius ?? 1;
  const start_angle = o.start_angle ?? (n % 2 === 0 ? 0 : TAU / 4);
  const start = rotate_vector([radius, 0, 0], start_angle);
  return [compass_directions(n, start), start_angle];
}

export const complex_to_R3 = (z: { re: number; im: number } | [number, number]): Point3D =>
  Array.isArray(z) ? [z[0], z[1], 0] : [z.re, z.im, 0];
export const R3_to_complex = (p: Point3DLike): [number, number] => [p[0], p[1]];

export function center_of_mass(points: readonly Point3DLike[]): Point3D {
  const n = points.length;
  const s: Point3D = [0, 0, 0];
  for (const p of points) for (let k = 0; k < 3; k++) s[k] += (p[k] ?? 0) / n;
  return s;
}
export const midpoint = (p1: Point3DLike, p2: Point3DLike): Point3D => center_of_mass([p1, p2]);

/** Intersection of two lines in the xy-plane, each given by two points. */
export function line_intersection(line1: readonly Point3DLike[], line2: readonly Point3DLike[]): Point3D {
  if ([...line1, ...line2].some((p) => (p[2] ?? 0) !== 0)) throw new Error('Coords must be in the xy-plane.');
  const h = (l: readonly Point3DLike[]) => cross([l[0][0], l[0][1], 1], [l[1][0], l[1][1], 1]);
  const [x, y, z] = cross(h(line1), h(line2));
  if (z === 0) throw new Error('The lines are parallel, there is no unique intersection point.');
  return [x / z, y / z, 0];
}

export function find_intersection(p0s: Point3DLike[], v0s: Point3DLike[], p1s: Point3DLike[], v1s: Point3DLike[], threshold = 1e-5): Point3D[] {
  return p0s.map((p0, i) => {
    const v0 = v0s[i], p1 = p1s[i], v1 = v1s[i];
    const normal = cross(v1, cross(v0, v1));
    const denom = Math.max(dot(v0, normal), threshold);
    const k = dot(sub(p1, p0), normal) / denom;
    return [p0[0] + k * v0[0], p0[1] + k * v0[1], (p0[2] ?? 0) + k * (v0[2] ?? 0)] as Point3D;
  });
}

export function get_winding_number(points: readonly Point3DLike[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i], p2 = points[(i + 1) % points.length];
    let d = angle_of_vector(p2) - angle_of_vector(p1);
    d = ((((d + PI) % TAU) + TAU) % TAU) - PI;
    total += d;
  }
  return total / TAU;
}

/** Signed area via the trapezoid rule (numpy.trapezoid(y, x)). */
export function shoelace(xy: readonly Point3DLike[]): number {
  let s = 0;
  for (let i = 1; i < xy.length; i++) s += ((xy[i][1] + xy[i - 1][1]) / 2) * (xy[i][0] - xy[i - 1][0]);
  return s;
}
export const shoelace_direction = (xy: readonly Point3DLike[]): 'CW' | 'CCW' => (shoelace(xy) > 0 ? 'CW' : 'CCW');
export const cross2d = (a: Point3DLike, b: Point3DLike): number => a[0] * b[1] - b[0] * a[1];

export function cartesian_to_spherical(v: Point3DLike): Point3D {
  const r = norm(v);
  if (r === 0) return [0, 0, 0];
  return [r, Math.atan2(v[1], v[0]), Math.acos((v[2] ?? 0) / r)];
}
export function spherical_to_cartesian(s: readonly number[]): Point3D {
  const [r, theta, phi] = s;
  return [r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi)];
}

export function perpendicular_bisector(line: readonly Point3DLike[], norm_vector: Point3DLike = OUT): [Point3D, Point3D] {
  const p1 = to3(line[0]), p2 = to3(line[1]);
  const d = cross(sub(p1, p2), norm_vector);
  const m = midpoint(p1, p2);
  return [[m[0] + d[0], m[1] + d[1], m[2] + d[2]], [m[0] - d[0], m[1] - d[1], m[2] - d[2]]];
}
