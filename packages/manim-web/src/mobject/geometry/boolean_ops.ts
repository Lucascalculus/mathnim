// manim/mobject/geometry/boolean_ops.py
//
// web: manim uses skia-pathops. Here the paths are clipped by a small
// polygon engine instead:
//   1. every subpath is converted like _convert_vmobject_to_skia_path (2D,
//      split where curves do not connect, implicitly closed like a fill) and
//      its cubic Beziers are flattened adaptively (tolerance ~1e-4 of the size),
//      remembering for every vertex which Bezier and which t it came from;
//   2. all edges are split at their mutual intersections (crossings,
//      T-junctions and collinear overlaps);
//   3. an edge is kept when the boolean result (non-zero winding of each
//      operand, like skia's default fill) differs on its two sides, and is
//      oriented with the result on its left (outer boundaries CCW, holes CW);
//   4. kept edges are chained into closed contours, and consecutive pieces of
//      the same input Bezier are rebuilt as that Bezier's exact sub-curve
//      (partial_bezier_points), so the output is made of cubic curves like
//      skia's (not a polyline). Contours end with a line back to their start,
//      as manim's CLOSE verb handling does.
// Start points and orientation of the contours may differ from skia's.
import { partial_bezier_points } from '../../utils/bezier';
import { count, getPoint, type Points } from '../../utils/points';
import { isKwargs, type Kwargs } from '../../utils/pyargs';
import type { Point3D } from '../../utils/vector';
import { VMobject } from '../types/vectorized_mobject';

type Op = (inside: boolean[]) => boolean;

interface Curve {
  /** 2D control points [x0, y0, x1, y1, x2, y2, x3, y3]. */
  p: number[];
}
interface Vtx {
  x: number;
  y: number;
}
interface Edge {
  a: Vtx;
  b: Vtx;
  curve: Curve;
  ta: number;
  tb: number;
  operand: number;
  /** split points: parameter along a->b and the (shared) vertex */
  splits: { s: number; v: Vtx }[];
}

// ---------------------------------------------------------------- input
/** Rings of the vmobject's path (manim's Cairo-renderer conversion), as Bezier lists. */
function vmobject_to_rings(vm: VMobject): Curve[][] {
  let points: Points = vm.points;
  for (let i = 0; i < points.length; i++) if (!Number.isFinite(points[i])) {
    points = new Float64Array(3);
    break;
  }
  if (count(points) === 0) return [];
  const rings: Curve[][] = [];
  for (const sp of vm.gen_subpaths_from_points_2d(points)) {
    const curves: Curve[] = vm.gen_cubic_bezier_tuples_from_points(sp).map((q) => ({ p: [q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1]] }));
    if (!curves.length) continue;
    const first = getPoint(sp, 0), last = getPoint(sp, -1);
    if (vm.consider_points_equals_2d(first, last)) {
      // closed: make the end meet the start exactly
      const c = curves[curves.length - 1].p;
      c[6] = first[0];
      c[7] = first[1];
    } else {
      // a fill implicitly closes open contours with a straight line
      const [x0, y0, x1, y1] = [last[0], last[1], first[0], first[1]];
      curves.push({ p: [x0, y0, x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, x0 + (2 * (x1 - x0)) / 3, y0 + (2 * (y1 - y0)) / 3, x1, y1] });
    }
    rings.push(curves);
  }
  return rings;
}

/** Adaptive flattening; appends [x, y, t] for t in (t0, t1]. */
function flatten(p: number[], t0: number, t1: number, tol: number, out: number[][], depth = 0): void {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const dx = x3 - x0, dy = y3 - y0;
  const L = Math.hypot(dx, dy);
  let d: number;
  if (L > 1e-300) d = Math.max(Math.abs((x1 - x0) * dy - (y1 - y0) * dx), Math.abs((x2 - x0) * dy - (y2 - y0) * dx)) / L;
  else d = Math.max(Math.hypot(x1 - x0, y1 - y0), Math.hypot(x2 - x0, y2 - y0));
  if (d <= tol || depth >= 18) {
    out.push([x3, y3, t1]);
    return;
  }
  // de Casteljau split at 1/2
  const ax = (x0 + x1) / 2, ay = (y0 + y1) / 2, bx = (x1 + x2) / 2, by = (y1 + y2) / 2, cx = (x2 + x3) / 2, cy = (y2 + y3) / 2;
  const abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2;
  const mx = (abx + bcx) / 2, my = (aby + bcy) / 2;
  const tm = (t0 + t1) / 2;
  flatten([x0, y0, ax, ay, abx, aby, mx, my], t0, tm, tol, out, depth + 1);
  flatten([mx, my, bcx, bcy, cx, cy, x3, y3], tm, t1, tol, out, depth + 1);
}

// ---------------------------------------------------------------- the engine
/** Boolean combination of the operands' filled regions, as closed Bezier contours. */
function boolean_contours(operands: Curve[][][], op: Op): Point3D[][][] {
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const rings of operands) for (const ring of rings) for (const c of ring) for (let k = 0; k < 8; k += 2) {
    xmin = Math.min(xmin, c.p[k]);
    xmax = Math.max(xmax, c.p[k]);
    ymin = Math.min(ymin, c.p[k + 1]);
    ymax = Math.max(ymax, c.p[k + 1]);
  }
  if (!Number.isFinite(xmin)) return [];
  const scale = Math.max(xmax - xmin, ymax - ymin, 1e-12);
  const tol = 1e-4 * scale;
  const eps_len = 1e-12 * scale;

  // 1. flattened edges
  const edges: Edge[] = [];
  const operand_edges: Edge[][] = operands.map(() => []);
  operands.forEach((rings, oi) => {
    for (const ring of rings) {
      const start: Vtx = { x: ring[0].p[0], y: ring[0].p[1] };
      let prev = start;
      ring.forEach((curve, ci) => {
        const pts: number[][] = [];
        flatten(curve.p, 0, 1, tol, pts);
        let ta = 0;
        pts.forEach(([x, y, t], k) => {
          const last = ci === ring.length - 1 && k === pts.length - 1;
          const v: Vtx = last ? start : { x, y };
          if (Math.hypot(v.x - prev.x, v.y - prev.y) > eps_len) {
            const e: Edge = { a: prev, b: v, curve, ta, tb: t, operand: oi, splits: [] };
            edges.push(e);
            operand_edges[oi].push(e);
            prev = v;
            ta = t;
          }
        });
      });
    }
  });

  // 2. split at intersections
  const E = 1e-10;
  const bbox = edges.map((e) => [Math.min(e.a.x, e.b.x), Math.max(e.a.x, e.b.x), Math.min(e.a.y, e.b.y), Math.max(e.a.y, e.b.y)]);
  const proj = (e: Edge, v: Vtx): [number, number] => {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, L2 = dx * dx + dy * dy;
    const s = ((v.x - e.a.x) * dx + (v.y - e.a.y) * dy) / L2;
    const dist = Math.abs((v.x - e.a.x) * dy - (v.y - e.a.y) * dx) / Math.sqrt(L2);
    return [s, dist];
  };
  const addSplit = (e: Edge, s: number, v: Vtx) => {
    if (s > E && s < 1 - E && v !== e.a && v !== e.b) e.splits.push({ s, v });
  };
  const near = 1e-9 * scale;
  for (let i = 0; i < edges.length; i++) {
    const e1 = edges[i], b1 = bbox[i];
    for (let j = i + 1; j < edges.length; j++) {
      const b2 = bbox[j];
      if (b2[0] > b1[1] + near || b2[1] < b1[0] - near || b2[2] > b1[3] + near || b2[3] < b1[2] - near) continue;
      const e2 = edges[j];
      const d1x = e1.b.x - e1.a.x, d1y = e1.b.y - e1.a.y, d2x = e2.b.x - e2.a.x, d2y = e2.b.y - e2.a.y;
      const den = d1x * d2y - d1y * d2x;
      const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
      if (Math.abs(den) > 1e-12 * l1 * l2) {
        const qx = e2.a.x - e1.a.x, qy = e2.a.y - e1.a.y;
        const s = (qx * d2y - qy * d2x) / den, u = (qx * d1y - qy * d1x) / den;
        if (s < -E || s > 1 + E || u < -E || u > 1 + E) continue;
        const s_in = s > E && s < 1 - E, u_in = u > E && u < 1 - E;
        if (s_in && u_in) {
          const v: Vtx = { x: e1.a.x + s * d1x, y: e1.a.y + s * d1y };
          addSplit(e1, s, v);
          addSplit(e2, u, v);
        } else if (s_in) addSplit(e1, proj(e1, u < 0.5 ? e2.a : e2.b)[0], u < 0.5 ? e2.a : e2.b);
        else if (u_in) addSplit(e2, proj(e2, s < 0.5 ? e1.a : e1.b)[0], s < 0.5 ? e1.a : e1.b);
      } else {
        // parallel: split at the other edge's endpoints when collinear and overlapping
        for (const [ea, eb] of [[e1, e2], [e2, e1]] as [Edge, Edge][]) {
          for (const v of [eb.a, eb.b]) {
            const [s, dist] = proj(ea, v);
            if (dist <= near) addSplit(ea, s, v);
          }
        }
      }
    }
  }
  interface Piece {
    a: Vtx;
    b: Vtx;
    curve: Curve;
    ta: number;
    tb: number;
  }
  const pieces: Piece[] = [];
  for (const e of edges) {
    e.splits.sort((p, q) => p.s - q.s);
    let a = e.a, sa = 0;
    for (const sp of [...e.splits, { s: 1, v: e.b }]) {
      if (sp.v === a || Math.hypot(sp.v.x - a.x, sp.v.y - a.y) <= eps_len) continue;
      pieces.push({ a, b: sp.v, curve: e.curve, ta: e.ta + sa * (e.tb - e.ta), tb: e.ta + sp.s * (e.tb - e.ta) });
      a = sp.v;
      sa = sp.s;
    }
  }

  // 3. classify pieces
  const winding = (es: Edge[], px: number, py: number): number => {
    let w = 0;
    for (const e of es) {
      const { x: x1, y: y1 } = e.a, { x: x2, y: y2 } = e.b;
      if (y1 <= py) {
        if (y2 > py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) > 0) w++;
      } else if (y2 <= py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) < 0) w--;
    }
    return w;
  };
  const inside = (px: number, py: number) => op(operand_edges.map((es) => winding(es, px, py) !== 0));
  const off = 1e-7 * scale;
  interface Directed {
    from: string;
    to: string;
    a: Vtx;
    b: Vtx;
    curve: Curve;
    ta: number;
    tb: number;
    used: boolean;
  }
  const key = (v: Vtx) => `${v.x},${v.y}`;
  const seen = new Set<string>();
  const out_edges = new Map<string, Directed[]>();
  for (const pc of pieces) {
    const dx = pc.b.x - pc.a.x, dy = pc.b.y - pc.a.y, L = Math.hypot(dx, dy);
    const mx = (pc.a.x + pc.b.x) / 2, my = (pc.a.y + pc.b.y) / 2;
    const nx = (-dy / L) * off, ny = (dx / L) * off;
    const left = inside(mx + nx, my + ny), right = inside(mx - nx, my - ny);
    if (left === right) continue;
    const d: Directed = left
      ? { from: key(pc.a), to: key(pc.b), a: pc.a, b: pc.b, curve: pc.curve, ta: pc.ta, tb: pc.tb, used: false }
      : { from: key(pc.b), to: key(pc.a), a: pc.b, b: pc.a, curve: pc.curve, ta: pc.tb, tb: pc.ta, used: false };
    const id = `${d.from}|${d.to}`;
    if (seen.has(id)) continue; // coincident edges of different operands
    seen.add(id);
    if (!out_edges.has(d.from)) out_edges.set(d.from, []);
    out_edges.get(d.from)!.push(d);
  }

  // 4. chain into contours
  const contours: Directed[][] = [];
  for (const list of out_edges.values()) {
    for (const first of list) {
      if (first.used) continue;
      const ring: Directed[] = [first];
      first.used = true;
      let cur = first;
      while (cur.to !== first.from) {
        const cands = (out_edges.get(cur.to) ?? []).filter((c) => !c.used);
        if (!cands.length) break;
        let next = cands[0];
        if (cands.length > 1) {
          // keep the face on the left: smallest clockwise turn from the reversed incoming edge
          const r = Math.atan2(cur.a.y - cur.b.y, cur.a.x - cur.b.x);
          let best = Infinity;
          for (const c of cands) {
            let delta = r - Math.atan2(c.b.y - c.a.y, c.b.x - c.a.x);
            delta = ((delta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            if (delta === 0) delta = 2 * Math.PI;
            if (delta < best) {
              best = delta;
              next = c;
            }
          }
        }
        next.used = true;
        ring.push(next);
        cur = next;
      }
      if (cur.to === first.from && ring.length >= 2) contours.push(ring);
    }
  }

  // 5. rebuild Bezier runs
  const mergeable = (p: Directed, q: Directed) => p.curve === q.curve && p.tb === q.ta;
  return contours.map((ring) => {
    let s = ring.findIndex((d, i) => !mergeable(ring[(i - 1 + ring.length) % ring.length], d));
    if (s < 0) s = 0;
    const rot = [...ring.slice(s), ...ring.slice(0, s)];
    const curves: Point3D[][] = [];
    let i = 0;
    while (i < rot.length) {
      let j = i;
      while (j + 1 < rot.length && mergeable(rot[j], rot[j + 1])) j++;
      const a = rot[i], b = rot[j];
      const c = a.curve.p;
      const ctrl: Point3D[] = [[c[0], c[1], 0], [c[2], c[3], 0], [c[4], c[5], 0], [c[6], c[7], 0]];
      const t0 = a.ta, t1 = b.tb;
      let sub = partial_bezier_points(ctrl, Math.min(t0, t1), Math.max(t0, t1));
      if (t0 > t1) sub = sub.reverse();
      sub[0] = [a.a.x, a.a.y, 0];
      sub[3] = [b.b.x, b.b.y, 0];
      curves.push(sub);
      i = j + 1;
    }
    return curves;
  });
}

// ---------------------------------------------------------------- mobjects
function splitMobjects(args: unknown[]): [VMobject[], Kwargs] {
  if (args.length && isKwargs(args[args.length - 1])) return [args.slice(0, -1) as VMobject[], args[args.length - 1] as Kwargs];
  return [args as VMobject[], {}];
}

/** Base class of the boolean operations (web: see the note at the top of the file). */
export class _BooleanOps extends VMobject {
  protected _set_contours(contours: Point3D[][][]): this {
    for (const contour of contours) {
      const start = contour[0][0];
      this.start_new_path(start);
      for (const [, h1, h2, a2] of contour) this.add_cubic_bezier_curve_to(h1, h2, a2);
      this.add_line_to(start);
    }
    return this;
  }
  protected _apply(vmobjects: VMobject[], op: Op): this {
    return this._set_contours(boolean_contours(vmobjects.map(vmobject_to_rings), op));
  }
}

/** The union of two or more VMobjects. */
export class Union extends _BooleanOps {
  constructor(...args: unknown[]) {
    const [vmobjects, kw] = splitMobjects(args);
    if (vmobjects.length < 2) throw new Error('At least 2 mobjects needed for Union.');
    super(kw);
    this._apply(vmobjects, (ins) => ins.some(Boolean));
  }
}

/** `subject` minus `clip`. */
export class Difference extends _BooleanOps {
  constructor(subject: VMobject, clip: VMobject, kw: Kwargs = {}) {
    super(kw);
    this._apply([subject, clip], ([a, b]) => a && !b);
  }
}

/** The intersection of two or more VMobjects. */
export class Intersection extends _BooleanOps {
  constructor(...args: unknown[]) {
    const [vmobjects, kw] = splitMobjects(args);
    if (vmobjects.length < 2) throw new Error('At least 2 mobjects needed for Intersection.');
    super(kw);
    this._apply(vmobjects, (ins) => ins.every(Boolean));
  }
}

/** The regions covered by exactly one of `subject` and `clip` (xor). */
export class Exclusion extends _BooleanOps {
  constructor(subject: VMobject, clip: VMobject, kw: Kwargs = {}) {
    super(kw);
    this._apply([subject, clip], ([a, b]) => a !== b);
  }
}
