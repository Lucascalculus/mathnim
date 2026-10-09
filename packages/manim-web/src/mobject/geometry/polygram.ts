// manim/mobject/geometry/polygram.py
import { DL, DOWN, DR, RIGHT, TAU, UL, UR } from '../../constants';
import { BLUE, WHITE } from '../../utils/color/manim_colors';
import { adjacent_n_tuples, adjacent_pairs } from '../../utils/iterables';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { angle_between_vectors, normalize, regular_vertices } from '../../utils/space_ops';
import { add, cross, mul, norm, sub, to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { VGroup, VMobject } from '../types/vectorized_mobject';
import { ArcBetweenPoints } from './arc';

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** A generalised polygon: one closed polyline per vertex group. */
export class Polygram extends VMobject {
  constructor(...args: unknown[]) {
    const [vertex_groups, kw] = starArgs<readonly Point3DLike[]>(args);
    super({ color: BLUE, ...kw });
    for (const group of vertex_groups) {
      const [first, ...rest] = Array.from(group, to3);
      this.start_new_path(first);
      this.add_points_as_corners([...rest, first]);
    }
  }
  get_vertices(): Point3D[] {
    return this.get_start_anchors();
  }
  get_vertex_groups(): Point3D[][] {
    const groups: Point3D[][] = [];
    let group: Point3D[] = [];
    const ends = this.get_end_anchors();
    this.get_start_anchors().forEach((start, i) => {
      group.push(start);
      if (this.consider_points_equals(ends[i], group[0])) {
        groups.push(group);
        group = [];
      }
    });
    return groups;
  }
  /** Rounds the corners with arcs of the given radius (or list of radii). */
  round_corners(...args: unknown[]): this {
    const o = pyargs(args, ['radius', 'evenly_distribute_anchors', 'components_per_rounded_corner'], { radius: 0.5, evenly_distribute_anchors: false, components_per_rounded_corner: 2 });
    const { radius, evenly_distribute_anchors, components_per_rounded_corner } = o;
    if (radius === 0) return this;
    const new_points: Point3D[] = [];
    for (const vg of this.get_vertex_groups()) {
      let arcs: ArcBetweenPoints[] = [];
      let radius_list: number[];
      if (typeof radius === 'number') radius_list = vg.map(() => radius);
      else radius_list = Array.from({ length: Math.ceil(vg.length / radius.length) }, () => radius).flat();
      adjacent_n_tuples(vg, 3).forEach(([v1, v2, v3], i) => {
        const r = radius_list[i];
        if (r === undefined) return;
        const vect1 = sub(v2, v1), vect2 = sub(v3, v2);
        const u1 = normalize(vect1), u2 = normalize(vect2);
        let angle = angle_between_vectors(vect1, vect2);
        angle *= Math.sign(r);
        let cut = r * Math.tan(angle / 2);
        const max_cut = Math.min(norm(vect1), norm(vect2)) / 2;
        cut = Math.min(max_cut, Math.max(-max_cut, cut));
        const sign = Math.sign(cross(vect1, vect2)[2]);
        arcs.push(new ArcBetweenPoints(sub(v2, mul(cut, u1)), add(v2, mul(cut, u2)), { angle: sign * angle, num_components: components_per_rounded_corner }));
      });
      let average_arc_length = 1.0;
      if (evenly_distribute_anchors) {
        const nz = arcs.filter((a) => a.points.length / 3 > 4);
        if (nz.length) {
          const total = nz.reduce((s, a) => s + a.get_arc_length(), 0);
          const num_curves = nz.reduce((s, a) => s + a.points.length / 3, 0) / 4;
          average_arc_length = total / num_curves;
        }
      }
      arcs = [arcs[arcs.length - 1], ...arcs.slice(0, -1)];
      for (const [arc1, arc2] of adjacent_pairs(arcs)) {
        for (let i = 0; i < arc1.points.length; i += 3) new_points.push([arc1.points[i], arc1.points[i + 1], arc1.points[i + 2]]);
        const line = new registry.Line(arc1.get_end(), arc2.get_start());
        if (evenly_distribute_anchors) line.insert_n_curves(Math.ceil(line.get_length() / average_arc_length));
        for (let i = 0; i < line.points.length; i += 3) new_points.push([line.points[i], line.points[i + 1], line.points[i + 2]]);
      }
    }
    this.set_points(new_points);
    return this;
  }
}

/** A polygon through the given vertices. */
export class Polygon extends Polygram {
  constructor(...args: unknown[]) {
    const [vertices, kw] = starArgs<Point3DLike>(args);
    super(vertices, kw);
  }
}

/** A regular star polygon {num_vertices/density}. */
export class RegularPolygram extends Polygram {
  declare start_angle: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['num_vertices'], { density: 2, radius: 1, start_angle: null });
    let { num_vertices, density, radius, start_angle, ...rest } = o;
    const num_gons = gcd(num_vertices, density);
    num_vertices = Math.floor(num_vertices / num_gons);
    density = Math.floor(density / num_gons);
    const gen = (sa: number | null): [Point3D[], number] => {
      const [reg, sa2] = regular_vertices(num_vertices, { radius, start_angle: sa });
      const vertices: Point3D[] = [];
      let i = 0;
      for (;;) {
        vertices.push(reg[i]);
        i = (i + density) % num_vertices;
        if (i === 0) break;
      }
      return [vertices, sa2];
    };
    const [first, sa0] = gen(start_angle);
    const groups = [first];
    for (let i = 1; i < num_gons; i++) groups.push(gen(sa0 + ((i / num_gons) * TAU) / num_vertices)[0]);
    super(...groups, rest);
    this.start_angle = sa0;
  }
}

/** A regular n-gon. */
export class RegularPolygon extends RegularPolygram {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['n'], { n: 6 });
    const { n, ...rest } = o;
    super(n, { ...rest, density: 1 });
  }
}

/** A star with n points. */
export class Star extends Polygon {
  declare start_angle: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['n'], { n: 5, outer_radius: 1, inner_radius: null, density: 2, start_angle: TAU / 4 });
    let { n, outer_radius, inner_radius, density, start_angle, ...rest } = o;
    const inner_angle = TAU / (2 * n);
    if (inner_radius == null) {
      if (density <= 0 || density >= n / 2) throw new Error(`Incompatible density ${density} for number of points ${n}`);
      const outer_angle = (TAU * density) / n;
      const inverse_x = 1 - Math.tan(inner_angle) * ((Math.cos(outer_angle) - 1) / Math.sin(outer_angle));
      inner_radius = outer_radius / (Math.cos(inner_angle) * inverse_x);
    }
    const [outer, sa] = regular_vertices(n, { radius: outer_radius, start_angle });
    const [inner] = regular_vertices(n, { radius: inner_radius, start_angle: sa + inner_angle });
    const vertices: Point3D[] = [];
    outer.forEach((v, i) => vertices.push(v, inner[i]));
    super(...vertices, rest);
    this.start_angle = sa;
  }
}

/** An equilateral triangle. */
export class Triangle extends RegularPolygon {
  constructor(kw: Kwargs = {}) {
    super({ ...kw, n: 3 });
  }
}

/** A rectangle, optionally with grid lines. */
export class Rectangle extends Polygon {
  declare grid_lines: VGroup;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['color', 'height', 'width', 'grid_xstep', 'grid_ystep', 'mark_paths_closed', 'close_new_points'], {
      color: WHITE, height: 2.0, width: 4.0, grid_xstep: null, grid_ystep: null,
    });
    let { height, width, grid_xstep, grid_ystep, mark_paths_closed, close_new_points, ...rest } = o;
    super(UR, UL, DL, DR, rest);
    this.stretch_to_fit_width(width);
    this.stretch_to_fit_height(height);
    const v = this.get_vertices();
    this.grid_lines = new VGroup();
    const Line = registry.Line;
    if (grid_xstep) {
      grid_xstep = Math.abs(grid_xstep);
      const count = Math.trunc(width / grid_xstep);
      this.grid_lines.add(new VGroup(...Array.from({ length: Math.max(0, count - 1) }, (_, k) => {
        const i = k + 1;
        return new Line(add(v[1], mul(i * grid_xstep, RIGHT)), add(v[1], mul(i * grid_xstep, RIGHT), mul(height, DOWN)), { color: rest.color });
      })));
    }
    if (grid_ystep) {
      grid_ystep = Math.abs(grid_ystep);
      const count = Math.trunc(height / grid_ystep);
      this.grid_lines.add(new VGroup(...Array.from({ length: Math.max(0, count - 1) }, (_, k) => {
        const i = k + 1;
        return new Line(add(v[1], mul(i * grid_ystep, DOWN)), add(v[1], mul(i * grid_ystep, DOWN), mul(width, RIGHT)), { color: rest.color });
      })));
    }
    if (this.grid_lines.submobjects.length) this.add(this.grid_lines);
  }
}

/** A square. */
export class Square extends Rectangle {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['side_length'], { side_length: 2.0 });
    const { side_length, ...rest } = o;
    super({ ...rest, height: side_length, width: side_length });
  }
  get side_length(): number {
    const v = this.get_vertices();
    return norm(sub(v[0], v[1]));
  }
  set side_length(value: number) {
    this.scale(value / this.side_length);
  }
}

/** A rectangle with rounded corners. */
export class RoundedRectangle extends Rectangle {
  declare corner_radius: number | number[];
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['corner_radius'], { corner_radius: 0.5 });
    const { corner_radius, ...rest } = o;
    super(rest);
    this.corner_radius = corner_radius;
    this.round_corners(this.corner_radius);
  }
}

/** `main_shape` with the other shapes cut out as holes. */
export class Cutout extends VMobject {
  constructor(...args: unknown[]) {
    const [shapes, kw] = starArgs<VMobject>(args);
    const [main_shape, ...mobjects] = shapes;
    super(kw);
    this.append_points(main_shape.points);
    const dir = main_shape.get_direction() === 'CW' ? 'CCW' : 'CW';
    for (const m of mobjects) this.append_points(m.force_direction(dir).points);
  }
}

/**
 * The convex hull of the given points.
 * web: Andrew's monotone chain instead of manim's QuickHull; the outline is the
 * same but may start at a different vertex.
 */
export class ConvexHull extends Polygram {
  constructor(...args: unknown[]) {
    const [points, kw] = starArgs<Point3DLike>(args);
    const { tolerance = 1e-5, ...rest } = kw;
    const pts = points.map((p) => [p[0], p[1]] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const crs = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: [number, number][] = [], upper: [number, number][] = [];
    for (const p of pts) {
      while (lower.length >= 2 && crs(lower[lower.length - 2], lower[lower.length - 1], p) <= tolerance) lower.pop();
      lower.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && crs(upper[upper.length - 2], upper[upper.length - 1], p) <= tolerance) upper.pop();
      upper.push(p);
    }
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)].map(([x, y]) => [x, y, 0] as Point3D);
    super(hull, rest);
  }
}


register({ Polygon, Rectangle, Square, RoundedRectangle, Triangle });
