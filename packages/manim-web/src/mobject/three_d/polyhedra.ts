// manim/mobject/three_d/polyhedra.py
//
// A Polyhedron is a VGroup of `faces` (Polygons) plus a `graph` (Graph with
// Dot3D vertices and invisible edges); an updater keeps the faces glued to the
// graph's vertices, so moving a vertex deforms the solid.
import { Polygon } from '../geometry/polygram';
import type { Mobject } from '../mobject';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { VGroup, VMobject } from '../types/vectorized_mobject';
import { Dot3D } from './three_dimensions';

/** A polyhedron from vertex coordinates and faces given as lists of vertex indices. */
export class Polyhedron extends VGroup {
  declare faces_config: Kwargs;
  declare graph_config: Kwargs;
  declare vertex_coords: Point3DLike[];
  declare vertex_indices: number[];
  declare layout: Map<number, Point3D>;
  declare faces_list: number[][];
  declare face_coords: Point3D[][];
  declare edges: [number, number][];
  declare faces: VGroup;
  declare graph: any;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['vertex_coords', 'faces_list', 'faces_config', 'graph_config'], { faces_config: {}, graph_config: {} });
    const { vertex_coords, faces_list, faces_config, graph_config } = o as { vertex_coords: Point3DLike[]; faces_list: number[][]; faces_config: Kwargs; graph_config: Kwargs };
    super();
    this.faces_config = { fill_opacity: 0.5, shade_in_3d: true, ...faces_config };
    this.graph_config = { vertex_type: Dot3D, edge_config: { stroke_opacity: 0 }, ...graph_config };
    this.vertex_coords = Array.from(vertex_coords);
    this.vertex_indices = this.vertex_coords.map((_, i) => i);
    this.layout = new Map(this.vertex_coords.map((p, i) => [i, to3(p)]));
    this.faces_list = Array.from(faces_list, (f) => Array.from(f));
    this.face_coords = this.faces_list.map((f) => f.map((j) => this.layout.get(j)!));
    this.edges = this.get_edges(this.faces_list);
    this.faces = this.create_faces(this.face_coords);
    const Graph = registry.Graph;
    if (!Graph) throw new Error('Polyhedron needs Graph (manim/mobject/graph.py), which is not available');
    const layout: Record<number, Point3D> = {};
    for (const [k, v] of this.layout) layout[k] = v;
    this.graph = new Graph(this.vertex_indices, this.edges, { layout, ...this.graph_config });
    this.add(this.faces, this.graph);
    // web: the updater uses its argument so copies update their own faces
    this.add_updater((m: Polyhedron) => m.update_faces(m));
  }

  /** Every face's edges as (start, end) index pairs. */
  get_edges(faces_list: number[][]): [number, number][] {
    const edges: [number, number][] = [];
    for (const face of faces_list) face.forEach((v, i) => edges.push([v, face[(i + 1) % face.length]]));
    return edges;
  }
  /** One Polygon (styled by `faces_config`) per face. */
  create_faces(face_coords: Point3DLike[][]): VGroup {
    const face_group = new VGroup();
    for (const face of face_coords) face_group.add(new Polygon(...face, this.faces_config));
    return face_group;
  }
  /**
   * Move the faces to the graph's current vertex positions.
   * web: rewrites the face points in place (manim builds new Polygons and match_points; same points).
   */
  update_faces(_m?: Mobject): this {
    const face_coords = this.extract_face_coords();
    const faces = this.faces.submobjects;
    for (let i = 0; i < Math.min(faces.length, face_coords.length); i++) {
      const f = face_coords[i];
      set_polygon_points(faces[i], f);
    }
    return this;
  }
  /** Face vertex coordinates taken from the graph's vertex mobjects. */
  extract_face_coords(): Point3D[][] {
    const verts = this.graph.vertices;
    const mobs: Mobject[] = verts instanceof Map ? [...verts.values()] : Object.values(verts);
    const new_vertex_coords = mobs.map((m) => m.get_center());
    return this.faces_list.map((f) => f.map((j) => new_vertex_coords[j]));
  }
}

/** Polygon(*vertices) points (closed corner path), written into `vm` without allocating when possible. */
function set_polygon_points(vm: VMobject, vertices: Point3D[]): void {
  const n = vertices.length;
  let p = vm.points;
  if (p.length !== 12 * n) p = vm.points = new Float64Array(12 * n);
  for (let k = 0; k < n; k++) {
    const a = vertices[k], b = vertices[(k + 1) % n];
    for (let j = 0; j < 4; j++) {
      const t = j / 3, o = 12 * k + 3 * j;
      for (let d = 0; d < 3; d++) p[o + d] = j === 0 ? a[d] : j === 3 ? b[d] : (1 - t) * a[d] + t * b[d];
    }
  }
}

/** A regular tetrahedron. */
export class Tetrahedron extends Polyhedron {
  constructor(...args: unknown[]) {
    const [pos, kw] = starArgs<number>(args);
    const { edge_length = pos[0] ?? 1, faces_config, graph_config } = kw;
    const unit = (edge_length * Math.sqrt(2)) / 4;
    super(
      [[unit, unit, unit], [unit, -unit, -unit], [-unit, unit, -unit], [-unit, -unit, unit]],
      [[0, 1, 2], [3, 0, 2], [0, 1, 3], [3, 1, 2]],
      { faces_config: faces_config ?? {}, graph_config: graph_config ?? {} },
    );
  }
}

/** A regular octahedron. */
export class Octahedron extends Polyhedron {
  constructor(...args: unknown[]) {
    const [pos, kw] = starArgs<number>(args);
    const { edge_length = pos[0] ?? 1, faces_config, graph_config } = kw;
    const unit = (edge_length * Math.sqrt(2)) / 2;
    super(
      [[unit, 0, 0], [-unit, 0, 0], [0, unit, 0], [0, -unit, 0], [0, 0, unit], [0, 0, -unit]],
      [[2, 4, 1], [0, 4, 2], [4, 3, 0], [1, 3, 4], [3, 5, 0], [1, 5, 3], [2, 5, 1], [0, 5, 2]],
      { faces_config: faces_config ?? {}, graph_config: graph_config ?? {} },
    );
  }
}

/** A regular icosahedron. */
export class Icosahedron extends Polyhedron {
  constructor(...args: unknown[]) {
    const [pos, kw] = starArgs<number>(args);
    const { edge_length = pos[0] ?? 1, faces_config, graph_config } = kw;
    const a = edge_length * ((1 + Math.sqrt(5)) / 4);
    const b = edge_length * (1 / 2);
    super(
      [[0, b, a], [0, -b, a], [0, b, -a], [0, -b, -a], [b, a, 0], [b, -a, 0], [-b, a, 0], [-b, -a, 0], [a, 0, b], [a, 0, -b], [-a, 0, b], [-a, 0, -b]],
      [[1, 8, 0], [1, 5, 7], [8, 5, 1], [7, 3, 5], [5, 9, 3], [8, 9, 5], [3, 2, 9], [9, 4, 2], [8, 4, 9], [0, 4, 8],
        [6, 4, 0], [6, 2, 4], [11, 2, 6], [3, 11, 2], [0, 6, 10], [10, 1, 0], [10, 7, 1], [11, 7, 3], [10, 11, 7], [10, 11, 6]],
      { faces_config: faces_config ?? {}, graph_config: graph_config ?? {} },
    );
  }
}

/** A regular dodecahedron. */
export class Dodecahedron extends Polyhedron {
  constructor(...args: unknown[]) {
    const [pos, kw] = starArgs<number>(args);
    const { edge_length = pos[0] ?? 1, faces_config, graph_config } = kw;
    const a = edge_length * ((1 + Math.sqrt(5)) / 4);
    const b = edge_length * ((3 + Math.sqrt(5)) / 4);
    const c = edge_length * (1 / 2);
    super(
      [[a, a, a], [a, a, -a], [a, -a, a], [a, -a, -a], [-a, a, a], [-a, a, -a], [-a, -a, a], [-a, -a, -a],
        [0, c, b], [0, c, -b], [0, -c, -b], [0, -c, b], [c, b, 0], [-c, b, 0], [c, -b, 0], [-c, -b, 0],
        [b, 0, c], [-b, 0, c], [b, 0, -c], [-b, 0, -c]],
      [[18, 16, 0, 12, 1], [3, 18, 16, 2, 14], [3, 10, 9, 1, 18], [1, 9, 5, 13, 12], [0, 8, 4, 13, 12], [2, 16, 0, 8, 11],
        [4, 17, 6, 11, 8], [17, 19, 5, 13, 4], [19, 7, 15, 6, 17], [6, 15, 14, 2, 11], [19, 5, 9, 10, 7], [7, 10, 3, 14, 15]],
      { faces_config: faces_config ?? {}, graph_config: graph_config ?? {} },
    );
  }
}

/**
 * Triangles of the convex hull of 3D points, each oriented counter-clockwise seen from outside.
 * web: a small incremental hull instead of manim's QuickHull (whose facet and vertex order depend on
 * Python's set hashing); the facets are the same.
 */
export function convex_hull_3d(points: readonly Point3DLike[], tolerance = 1e-5): { vertices: Point3D[]; faces: number[][] } {
  const P = points.map(to3);
  const n = P.length;
  if (n < 4) throw new Error('Not enough points supplied to build Convex Hull!');
  const sub3 = (a: Point3D, b: Point3D): Point3D => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const crs = (a: Point3D, b: Point3D): Point3D => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dt = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a: Point3D) => Math.sqrt(dt(a, a));
  // initial tetrahedron from extreme points
  const i0 = 0;
  let i1 = -1, best = -1;
  for (let i = 0; i < n; i++) if (len(sub3(P[i], P[i0])) > best) [best, i1] = [len(sub3(P[i], P[i0])), i];
  let i2 = -1;
  best = -1;
  for (let i = 0; i < n; i++) {
    const d = len(crs(sub3(P[i1], P[i0]), sub3(P[i], P[i0])));
    if (d > best) [best, i2] = [d, i];
  }
  let i3 = -1;
  best = -1;
  const n0 = crs(sub3(P[i1], P[i0]), sub3(P[i2], P[i0]));
  for (let i = 0; i < n; i++) {
    const d = Math.abs(dt(n0, sub3(P[i], P[i0])));
    if (d > best) [best, i3] = [d, i];
  }
  if (best <= tolerance * len(n0)) throw new Error('The points are coplanar; ConvexHull3D needs a 3D point set.');
  const centroid: Point3D = [0, 1, 2].map((k) => (P[i0][k] + P[i1][k] + P[i2][k] + P[i3][k]) / 4) as Point3D;
  type Face = { v: [number, number, number]; n: Point3D; alive: boolean };
  const faces: Face[] = [];
  const make = (a: number, b: number, c: number): Face => {
    let nrm = crs(sub3(P[b], P[a]), sub3(P[c], P[a]));
    if (dt(nrm, sub3(P[a], centroid)) < 0) {
      [b, c] = [c, b];
      nrm = [-nrm[0], -nrm[1], -nrm[2]];
    }
    const l = len(nrm) || 1;
    return { v: [a, b, c], n: [nrm[0] / l, nrm[1] / l, nrm[2] / l], alive: true };
  };
  for (const [a, b, c] of [[i0, i1, i2], [i0, i1, i3], [i0, i2, i3], [i1, i2, i3]]) faces.push(make(a, b, c));
  const used = new Set([i0, i1, i2, i3]);
  for (let p = 0; p < n; p++) {
    if (used.has(p)) continue;
    const visible = faces.filter((f) => f.alive && dt(f.n, sub3(P[p], P[f.v[0]])) > tolerance);
    if (!visible.length) continue;
    const edgeCount = new Map<string, [number, number]>();
    for (const f of visible) {
      f.alive = false;
      for (let k = 0; k < 3; k++) {
        const a = f.v[k], b = f.v[(k + 1) % 3];
        const rev = `${b},${a}`;
        if (edgeCount.has(rev)) edgeCount.delete(rev);
        else edgeCount.set(`${a},${b}`, [a, b]);
      }
    }
    for (const [a, b] of edgeCount.values()) {
      const nrm = crs(sub3(P[b], P[a]), sub3(P[p], P[a]));
      const l = len(nrm) || 1;
      faces.push({ v: [a, b, p], n: [nrm[0] / l, nrm[1] / l, nrm[2] / l], alive: true });
    }
  }
  const index = new Map<number, number>();
  const vertices: Point3D[] = [];
  const out: number[][] = [];
  for (const f of faces) {
    if (!f.alive) continue;
    out.push(f.v.map((i) => {
      if (!index.has(i)) {
        index.set(i, vertices.length);
        vertices.push(P[i]);
      }
      return index.get(i)!;
    }));
  }
  return { vertices, faces: out };
}

/** The convex hull of 3D points, as a Polyhedron. */
export class ConvexHull3D extends Polyhedron {
  constructor(...args: unknown[]) {
    const [points, kw] = starArgs<Point3DLike>(args);
    const { tolerance = 1e-5, faces_config, graph_config } = kw;
    const { vertices, faces } = convex_hull_3d(points, tolerance);
    super(vertices, faces, { faces_config: faces_config ?? {}, graph_config: graph_config ?? {} });
  }
}

register({ Polyhedron, Tetrahedron, Octahedron, Icosahedron, Dodecahedron, ConvexHull3D });
