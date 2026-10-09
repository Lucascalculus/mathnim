// manim/mobject/three_d/three_d_utils.py
//
// Corner points and normals ThreeDCamera uses to shade `shade_in_3d` VMobjects.
import { ORIGIN, UP } from '../../constants';
import { getPoint } from '../../utils/points';
import { get_unit_normal } from '../../utils/space_ops';
import type { Point3D } from '../../utils/vector';
import type { VMobject } from '../types/vectorized_mobject';

/** Start and end corners of a 3D-shaded VMobject (used as its gradient end points). */
export function get_3d_vmob_gradient_start_and_end_points(vmob: VMobject): [Point3D, Point3D] {
  return [get_3d_vmob_start_corner(vmob), get_3d_vmob_end_corner(vmob)];
}

/** Index of the start corner (always 0). */
export function get_3d_vmob_start_corner_index(_vmob: VMobject): number {
  return 0;
}

/** Index of the end corner: roughly the point opposite the start corner. */
export function get_3d_vmob_end_corner_index(vmob: VMobject): number {
  return Math.floor((vmob.points.length / 3 - 1) / 6) * 3;
}

/** The start corner point (ORIGIN when there are no points). */
export function get_3d_vmob_start_corner(vmob: VMobject): Point3D {
  if (vmob.get_num_points() === 0) return [...ORIGIN] as Point3D;
  return getPoint(vmob.points, get_3d_vmob_start_corner_index(vmob));
}

/** The end corner point (ORIGIN when there are no points). */
export function get_3d_vmob_end_corner(vmob: VMobject): Point3D {
  if (vmob.get_num_points() === 0) return [...ORIGIN] as Point3D;
  return getPoint(vmob.points, get_3d_vmob_end_corner_index(vmob));
}

/** Unit normal of the surface at the point with the given index. */
export function get_3d_vmob_unit_normal(vmob: VMobject, point_index: number): Point3D {
  const n_points = vmob.get_num_points();
  // web: len(get_anchors()) <= 2 without building the anchor list
  if ((n_points === 1 ? 1 : 2 * Math.floor(n_points / 4)) <= 2) return [...UP] as Point3D;
  const i = point_index;
  const im3 = i > 2 ? i - 3 : n_points - 4;
  const ip3 = i < n_points - 3 ? i + 3 : 3;
  const p = vmob.points;
  const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
  const unit_normal = unit_normal_fast(p[3 * ip3] - x, p[3 * ip3 + 1] - y, p[3 * ip3 + 2] - z, p[3 * im3] - x, p[3 * im3 + 1] - y, p[3 * im3 + 2] - z);
  if (unit_normal[0] === 0 && unit_normal[1] === 0 && unit_normal[2] === 0) return [...UP] as Point3D;
  return unit_normal;
}

/** web: space_ops.get_unit_normal for the common case of two non-parallel vectors, without temporaries. */
function unit_normal_fast(ax: number, ay: number, az: number, bx: number, by: number, bz: number, tol = 1e-6): Point3D {
  const div1 = Math.max(Math.abs(ax), Math.abs(ay), Math.abs(az)), div2 = Math.max(Math.abs(bx), Math.abs(by), Math.abs(bz));
  if (div1 !== 0 && div2 !== 0) {
    const u1x = ax / div1, u1y = ay / div1, u1z = az / div1, u2x = bx / div2, u2y = by / div2, u2z = bz / div2;
    const cx = u1y * u2z - u1z * u2y, cy = u1z * u2x - u1x * u2z, cz = u1x * u2y - u1y * u2x;
    const n = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (n > tol) return [cx / n, cy / n, cz / n];
  }
  return get_unit_normal([ax, ay, az], [bx, by, bz], tol);
}

/** Unit normal at the start corner. */
export function get_3d_vmob_start_corner_unit_normal(vmob: VMobject): Point3D {
  return get_3d_vmob_unit_normal(vmob, get_3d_vmob_start_corner_index(vmob));
}

/** Unit normal at the end corner. */
export function get_3d_vmob_end_corner_unit_normal(vmob: VMobject): Point3D {
  return get_3d_vmob_unit_normal(vmob, get_3d_vmob_end_corner_index(vmob));
}
