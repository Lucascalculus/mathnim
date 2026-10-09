// isosurfaces 0.1.2 (point.py, cell.py, isoline.py): the PyPI package manim's
// ImplicitFunction uses for `plot_isoline`. Only the 2-D isoline part is ported;
// the arithmetic follows the Python code step by step so the curves match.

type Pt = [number, number];
type Func = (p: Pt) => number;

class ValuedPoint {
  constructor(public pos: Pt, public val: number = NaN) {}
  calc(fn: Func): this {
    this.val = fn(this.pos);
    return this;
  }
  static midpoint(p1: ValuedPoint, p2: ValuedPoint, fn: Func): ValuedPoint {
    const mid: Pt = [(p1.pos[0] + p2.pos[0]) / 2, (p1.pos[1] + p2.pos[1]) / 2];
    return new ValuedPoint(mid, fn(mid));
  }
  /** The point on p1--p2 where the linear interpolation of the values is 0. */
  static intersectZero(p1: ValuedPoint, p2: ValuedPoint, fn: Func): ValuedPoint {
    const denom = p1.val - p2.val;
    const k1 = -p2.val / denom;
    const k2 = p1.val / denom;
    const pt: Pt = [k1 * p1.pos[0] + k2 * p2.pos[0], k1 * p1.pos[1] + k2 * p2.pos[1]];
    return new ValuedPoint(pt, fn(pt));
  }
}

/** Returns [point, is_zero]; is_zero rules out asymptotes (sign change through infinity). */
function binary_search_zero(p1: ValuedPoint, p2: ValuedPoint, fn: Func, tol: Pt): [ValuedPoint, boolean] {
  if (Math.abs(p2.pos[0] - p1.pos[0]) < tol[0] && Math.abs(p2.pos[1] - p1.pos[1]) < tol[1]) {
    const pt = ValuedPoint.intersectZero(p1, p2, fn);
    const is_zero = pt.val === 0 || (Math.sign(pt.val - p1.val) === Math.sign(p2.val - pt.val) && pt.val < 1e200);
    return [pt, is_zero];
  }
  const mid = ValuedPoint.midpoint(p1, p2, fn);
  if (mid.val === 0) return [mid, true];
  if (mid.val > 0 === p1.val > 0) return binary_search_zero(mid, p2, fn, tol);
  return binary_search_zero(p1, mid, fn, tol);
}

/** Corners [bottom-left, bottom-right, top-left, top-right] with their values. */
function vertices_from_extremes(pmin: Pt, pmax: Pt, fn: Func): ValuedPoint[] {
  const w = [pmax[0] - pmin[0], pmax[1] - pmin[1]];
  const out: ValuedPoint[] = [];
  for (let i = 0; i < 4; i++) out.push(new ValuedPoint([pmin[0] + (i & 1) * w[0], pmin[1] + ((i >> 1) & 1) * w[1]]).calc(fn));
  return out;
}

class Cell {
  children: Cell[] = [];
  constructor(public vertices: ValuedPoint[], public depth: number, public parent: Cell | null, public child_direction: number) {}
  compute_children(fn: Func): void {
    const v0 = this.vertices[0].pos, vl = this.vertices[3].pos;
    this.vertices.forEach((vertex, i) => {
      const p = vertex.pos;
      const pmin: Pt = [(v0[0] + p[0]) / 2, (v0[1] + p[1]) / 2];
      const pmax: Pt = [(vl[0] + p[0]) / 2, (vl[1] + p[1]) / 2];
      this.children.push(new Cell(vertices_from_extremes(pmin, pmax, fn), this.depth + 1, this, i));
    });
  }
}

function should_descend_deep_cell(cell: Cell, tol: Pt): boolean {
  const a = cell.vertices[3].pos, b = cell.vertices[0].pos;
  if (a[0] - b[0] < 10 * tol[0] && a[1] - b[1] < 10 * tol[1]) return false;
  if (cell.vertices.every((v) => Number.isNaN(v.val))) return false;
  if (cell.vertices.some((v) => Number.isNaN(v.val))) return true;
  const s0 = Math.sign(cell.vertices[0].val);
  return cell.vertices.slice(1).some((v) => Math.sign(v.val) !== s0);
}

function build_tree(fn: Func, pmin: Pt, pmax: Pt, min_depth: number, max_cells: number, tol: Pt): Cell {
  max_cells = Math.max(4 ** min_depth, max_cells);
  const root = new Cell(vertices_from_extremes(pmin, pmax, fn), 0, null, 0);
  const queue: Cell[] = [root];
  let head = 0;
  let leaf_count = 1;
  while (head < queue.length && leaf_count < max_cells) {
    const quad = queue[head++];
    if (quad.depth < min_depth || should_descend_deep_cell(quad, tol)) {
      quad.compute_children(fn);
      queue.push(...quad.children);
      leaf_count += 3;
    }
  }
  return root;
}

class Triangle {
  next: Triangle | null = null;
  next_bisect_point: ValuedPoint | null = null;
  prev: Triangle | null = null;
  visited = false;
  constructor(public vertices: ValuedPoint[]) {}
}

function four_triangles(a: ValuedPoint, b: ValuedPoint, c: ValuedPoint, d: ValuedPoint, center: ValuedPoint): Triangle[] {
  return [new Triangle([a, b, center]), new Triangle([b, c, center]), new Triangle([c, d, center]), new Triangle([d, a, center])];
}

// the Python version keys by the raw bytes of the summed position (so -0.0 and 0.0 differ)
const numKey = (x: number): string => (Object.is(x, -0) ? '-0' : String(x));

/** Triangulates the quadtree (8 triangles per quad around its centre) and links the isoline crossings. */
class Triangulator {
  triangles: Triangle[] = [];
  hanging_next = new Map<string, Triangle>();
  constructor(public root: Cell, public fn: Func, public tol: Pt) {}
  triangulate(): Triangle[] {
    this.triangulate_inside(this.root);
    return this.triangles;
  }
  triangulate_inside(quad: Cell): void {
    if (quad.children.length) {
      for (const child of quad.children) this.triangulate_inside(child);
      this.triangulate_crossing_row(quad.children[0], quad.children[1]);
      this.triangulate_crossing_row(quad.children[2], quad.children[3]);
      this.triangulate_crossing_col(quad.children[0], quad.children[2]);
      this.triangulate_crossing_col(quad.children[1], quad.children[3]);
    }
  }
  triangulate_crossing_row(a: Cell, b: Cell): void {
    if (a.children.length && b.children.length) {
      this.triangulate_crossing_row(a.children[1], b.children[0]);
      this.triangulate_crossing_row(a.children[3], b.children[2]);
    } else if (a.children.length) {
      this.triangulate_crossing_row(a.children[1], b);
      this.triangulate_crossing_row(a.children[3], b);
    } else if (b.children.length) {
      this.triangulate_crossing_row(a, b.children[0]);
      this.triangulate_crossing_row(a, b.children[2]);
    } else {
      const face_dual_a = this.get_face_dual(a);
      const face_dual_b = this.get_face_dual(b);
      let triangles: Triangle[];
      if (a.depth < b.depth) {
        const edge_dual = this.get_edge_dual(b.vertices[2], b.vertices[0]);
        triangles = four_triangles(b.vertices[2], face_dual_b, b.vertices[0], face_dual_a, edge_dual);
      } else {
        const edge_dual = this.get_edge_dual(a.vertices[3], a.vertices[1]);
        triangles = four_triangles(a.vertices[3], face_dual_b, a.vertices[1], face_dual_a, edge_dual);
      }
      this.add_four_triangles(triangles);
    }
  }
  triangulate_crossing_col(a: Cell, b: Cell): void {
    if (a.children.length && b.children.length) {
      this.triangulate_crossing_col(a.children[2], b.children[0]);
      this.triangulate_crossing_col(a.children[3], b.children[1]);
    } else if (a.children.length) {
      this.triangulate_crossing_col(a.children[2], b);
      this.triangulate_crossing_col(a.children[3], b);
    } else if (b.children.length) {
      this.triangulate_crossing_col(a, b.children[0]);
      this.triangulate_crossing_col(a, b.children[1]);
    } else {
      const face_dual_a = this.get_face_dual(a);
      const face_dual_b = this.get_face_dual(b);
      let triangles: Triangle[];
      if (a.depth < b.depth) {
        const edge_dual = this.get_edge_dual(b.vertices[0], b.vertices[1]);
        triangles = four_triangles(b.vertices[0], face_dual_b, b.vertices[1], face_dual_a, edge_dual);
      } else {
        const edge_dual = this.get_edge_dual(a.vertices[2], a.vertices[3]);
        triangles = four_triangles(a.vertices[2], face_dual_b, a.vertices[3], face_dual_a, edge_dual);
      }
      this.add_four_triangles(triangles);
    }
  }
  add_four_triangles(triangles: Triangle[]): void {
    for (let i = 0; i < 4; i++) this.next_sandwich_triangles(triangles[i], triangles[(i + 1) % 4], triangles[(i + 2) % 4]);
    this.triangles.push(...triangles);
  }
  set_next(tri1: Triangle, tri2: Triangle, vpos: ValuedPoint, vneg: ValuedPoint): void {
    if (!(vpos.val > 0 && 0 >= vneg.val)) return;
    const [intersection, is_zero] = binary_search_zero(vpos, vneg, this.fn, this.tol);
    if (!is_zero) return;
    tri1.next_bisect_point = intersection;
    tri1.next = tri2;
    tri2.prev = tri1;
  }
  next_sandwich_triangles(a: Triangle, b: Triangle, c: Triangle): void {
    const center = b.vertices[2];
    const x = b.vertices[0];
    const y = b.vertices[1];
    if (center.val > 0 && 0 >= y.val) this.set_next(b, c, center, y);
    if (x.val > 0 && 0 >= center.val) this.set_next(b, a, x, center);
    const id = numKey(x.pos[0] + y.pos[0]) + ',' + numKey(x.pos[1] + y.pos[1]);
    const hanging = this.hanging_next.get(id);
    if (y.val > 0 && 0 >= x.val) {
      if (hanging) {
        this.set_next(b, hanging, y, x);
        this.hanging_next.delete(id);
      } else this.hanging_next.set(id, b);
    } else if (y.val <= 0 && 0 < x.val) {
      if (hanging) {
        this.set_next(hanging, b, x, y);
        this.hanging_next.delete(id);
      } else this.hanging_next.set(id, b);
    }
  }
  get_edge_dual(p1: ValuedPoint, p2: ValuedPoint): ValuedPoint {
    if (p1.val > 0 !== p2.val > 0) return ValuedPoint.midpoint(p1, p2, this.fn);
    const dt = 0.01;
    const df1 = this.fn([p1.pos[0] * (1 - dt) + p2.pos[0] * dt, p1.pos[1] * (1 - dt) + p2.pos[1] * dt]);
    const df2 = this.fn([p1.pos[0] * dt + p2.pos[0] * (1 - dt), p1.pos[1] * dt + p2.pos[1] * (1 - dt)]);
    if (df1 > 0 === df2 > 0) return ValuedPoint.midpoint(p1, p2, this.fn);
    return ValuedPoint.intersectZero(new ValuedPoint(p1.pos, df1), new ValuedPoint(p2.pos, df2), this.fn);
  }
  get_face_dual(quad: Cell): ValuedPoint {
    return ValuedPoint.midpoint(quad.vertices[0], quad.vertices[3], this.fn);
  }
}

class CurveTracer {
  active_curve: ValuedPoint[] = [];
  constructor(public triangles: Triangle[]) {}
  trace(): Pt[][] {
    const curves: ValuedPoint[][] = [];
    for (const triangle of this.triangles) {
      if (!triangle.visited && triangle.next !== null) {
        this.active_curve = [];
        this.march_triangle(triangle);
        curves.push(this.active_curve);
      }
    }
    return curves.map((curve) => curve.map((v) => v.pos));
  }
  march_triangle(triangle: Triangle): void {
    const start_triangle = triangle;
    let closed_loop = false;
    let t: Triangle | null = triangle;
    while (t.prev !== null) {
      t = t.prev;
      if (t === start_triangle) {
        closed_loop = true;
        break;
      }
    }
    while (t !== null && !t.visited) {
      if (t.next_bisect_point !== null) this.active_curve.push(t.next_bisect_point);
      t.visited = true;
      t = t.next;
    }
    if (closed_loop) this.active_curve.push(this.active_curve[0]);
  }
}

/** Curves where fn([x, y]) = 0 inside [pmin, pmax] (each a list of [x, y] points). */
export function plot_isoline(fn: Func, pmin: readonly number[], pmax: readonly number[], min_depth = 5, max_quads = 10000, tol: readonly number[] | null = null): Pt[][] {
  const lo: Pt = [pmin[0], pmin[1]], hi: Pt = [pmax[0], pmax[1]];
  const t: Pt = tol ? [tol[0], tol[1]] : [(hi[0] - lo[0]) / 1000, (hi[1] - lo[1]) / 1000];
  const quadtree = build_tree(fn, lo, hi, min_depth, max_quads, t);
  const triangles = new Triangulator(quadtree, fn, t).triangulate();
  return new CurveTracer(triangles).trace();
}
