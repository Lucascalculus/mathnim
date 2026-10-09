// Core of the browser engine: a port of manim's VMobject model.
// Points are cubic Bezier curves stored as a flat [x0,y0,x1,y1,...] array,
// four points per curve (anchor, handle, handle, anchor), exactly like
// manim CE's `points` array, so every algorithm below can follow the Python
// source line by line. Only the 2D (z = 0) case is supported.

export const FRAME_H = 8;
export const FRAME_W = (8 * 16) / 9;
export const PI = Math.PI;
export const TAU = 2 * Math.PI;
export const DEGREES = PI / 180;
export const ORIGIN = [0, 0];
export const UP = [0, 1];
export const DOWN = [0, -1];
export const LEFT = [-1, 0];
export const RIGHT = [1, 0];
export const UL = [-1, 1];
export const UR = [1, 1];
export const DL = [-1, -1];
export const DR = [1, -1];
export const DEFAULT_STROKE_WIDTH = 4;
export const MED_SMALL_BUFF = 0.25;
export const EDGE_BUFF = 0.5;
export const DEFAULT_DOT_RADIUS = 0.08;
const TOL = 1e-6; // tolerance_for_point_equality

// ------------------------------------------------------------------ vectors
export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const vmul = (a, k) => [a[0] * k, a[1] * k];
export const vnorm = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1]); // numpy.linalg.norm, bit-for-bit
export const vunit = (a) => {
  const n = vnorm(a);
  return n > 1e-9 ? [a[0] / n, a[1] / n] : [a[0], a[1]];
};
// same formula as manim.utils.bezier.interpolate, so rounding matches bit for bit
export const vlerp = (a, b, t) => [(1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]];
export const lerp = (a, b, t) => (1 - t) * a + t * b;

// ------------------------------------------------------------------ colours
const NAMED = { WHITE: '#FFFFFF', BLACK: '#000000', RED: '#FC6255', BLUE: '#58C4DD', YELLOW: '#FFFF00', PURE_YELLOW: '#FFFF00' };
export function rgb(c) {
  if (Array.isArray(c)) return c.slice(0, 3);
  let h = NAMED[c] || c;
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

// ------------------------------------------------------------------ bezier utilities
export function bezierPoint(p, t) {
  // p: [[x,y] x4]
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
}

// manim.utils.bezier.partial_bezier_points (cubic case)
export function partialBezier(p, a, b) {
  if (a === 1) return [p[3], p[3], p[3], p[3]].map((q) => q.slice());
  if (b === 0) return [p[0], p[0], p[0], p[0]].map((q) => q.slice());
  const ma = 1 - a, mb = 1 - b;
  const a2 = a * a, b2 = b * b, ma2 = ma * ma, mb2 = mb * mb;
  const a3 = a2 * a, b3 = b2 * b, ma3 = ma2 * ma, mb3 = mb2 * mb;
  const M = [
    [ma3, 3 * ma2 * a, 3 * ma * a2, a3],
    [ma2 * mb, 2 * ma * a * mb + ma2 * b, a2 * mb + 2 * ma * a * b, a2 * b],
    [ma * mb2, a * mb2 + 2 * ma * mb * b, 2 * a * mb * b + ma * b2, a * b2],
    [mb3, 3 * mb2 * b, 3 * mb * b2, b3],
  ];
  return M.map((row) => [
    row[0] * p[0][0] + row[1] * p[1][0] + row[2] * p[2][0] + row[3] * p[3][0],
    row[0] * p[0][1] + row[1] * p[1][1] + row[2] * p[2][1] + row[3] * p[3][1],
  ]);
}

// manim.utils.bezier.integer_interpolate
export function integerInterpolate(start, end, alpha) {
  if (alpha >= 1) return [Math.trunc(end - 1), 1.0];
  if (alpha <= 0) return [Math.trunc(start), 0];
  const value = Math.trunc(lerp(start, end, alpha));
  let residue = ((end - start) * alpha) % 1;
  if (residue < 0) residue += 1;
  return [value, residue];
}

// de Casteljau subdivision into n equal-parameter pieces (manim subdivide_bezier)
function subdivideBezier(p, n) {
  if (n === 1) return [p];
  const out = [];
  for (let i = 0; i < n; i++) out.push(partialBezier(p, i / n, (i + 1) / n));
  return out;
}

// manim.utils.bezier.bezier_remap
function bezierRemap(tuples, newN) {
  const cur = tuples.length;
  const split = new Array(cur).fill(0);
  for (let i = 0; i < newN; i++) split[Math.floor((i * cur) / newN)] += 1;
  const out = [];
  tuples.forEach((c, i) => {
    if (split[i] > 0) out.push(...subdivideBezier(c, split[i]));
  });
  return out;
}

// manim get_smooth_cubic_bezier_handle_points (open + closed variants)
let CP_OPEN = [0.5];
let CP_CLOSED = [1 / 3];
let UP_CLOSED = [1 / 3];
function isClosedAnchors(A) {
  const s = A[0], e = A[A.length - 1];
  for (let k = 0; k < 2; k++) {
    const tol = 1e-8 + 1e-5 * s[k];
    if (Math.abs(e[k] - s[k]) > tol) return false;
  }
  return true;
}
function smoothHandles(A) {
  const n = A.length;
  if (n === 1) return [[], []];
  if (n === 2) return [[vlerp(A[0], A[1], 1 / 3)], [vlerp(A[0], A[1], 2 / 3)]];
  return isClosedAnchors(A) ? smoothClosed(A) : smoothOpen(A);
}
function smoothOpen(A) {
  const N = A.length - 1;
  if (CP_OPEN.length < N - 1) {
    for (let i = CP_OPEN.length; i < N - 1; i++) CP_OPEN.push(1 / (4 - CP_OPEN[i - 1]));
  }
  const cp = CP_OPEN;
  const Dp = new Array(N);
  Dp[0] = [0.5 * A[0][0] + A[1][0], 0.5 * A[0][1] + A[1][1]];
  for (let i = 1; i < N - 1; i++) {
    const aux = [4 * A[i][0] + 2 * A[i + 1][0], 4 * A[i][1] + 2 * A[i + 1][1]];
    Dp[i] = [cp[i] * (aux[0] - Dp[i - 1][0]), cp[i] * (aux[1] - Dp[i - 1][1])];
  }
  const f = 1 / (7 - 2 * cp[N - 2]);
  Dp[N - 1] = [f * (8 * A[N - 1][0] + A[N][0] - 2 * Dp[N - 2][0]), f * (8 * A[N - 1][1] + A[N][1] - 2 * Dp[N - 2][1])];
  const H1 = Dp;
  for (let i = N - 2; i >= 0; i--) H1[i] = [Dp[i][0] - cp[i] * H1[i + 1][0], Dp[i][1] - cp[i] * H1[i + 1][1]];
  const H2 = new Array(N);
  for (let i = 0; i < N - 1; i++) H2[i] = [2 * A[i + 1][0] - H1[i + 1][0], 2 * A[i + 1][1] - H1[i + 1][1]];
  H2[N - 1] = [0.5 * (A[N][0] + H1[N - 1][0]), 0.5 * (A[N][1] + H1[N - 1][1])];
  return [H1, H2];
}
function smoothClosed(A) {
  const N = A.length - 1;
  if (CP_CLOSED.length < N - 1) {
    for (let i = CP_CLOSED.length; i < N - 1; i++) {
      CP_CLOSED.push(1 / (4 - CP_CLOSED[i - 1]));
      UP_CLOSED.push(-CP_CLOSED[i] * UP_CLOSED[i - 1]);
    }
  }
  const cp = CP_CLOSED, up = UP_CLOSED;
  const cpLast = 1 / (3 - cp[N - 2]);
  const upLast = cpLast * (1 - up[N - 2]);
  const q = new Array(N);
  q[N - 1] = upLast;
  for (let i = N - 2; i >= 0; i--) q[i] = up[i] - cp[i] * q[i + 1];
  const AUX = [];
  for (let i = 0; i < N; i++) AUX.push([4 * A[i][0] + 2 * A[i + 1][0], 4 * A[i][1] + 2 * A[i + 1][1]]);
  const Dp = new Array(N);
  Dp[0] = [AUX[0][0] / 3, AUX[0][1] / 3];
  for (let i = 1; i < N - 1; i++) Dp[i] = [cp[i] * (AUX[i][0] - Dp[i - 1][0]), cp[i] * (AUX[i][1] - Dp[i - 1][1])];
  Dp[N - 1] = [cpLast * (AUX[N - 1][0] - Dp[N - 2][0]), cpLast * (AUX[N - 1][1] - Dp[N - 2][1])];
  const Y = Dp;
  for (let i = N - 2; i >= 0; i--) Y[i] = [Dp[i][0] - cp[i] * Y[i + 1][0], Dp[i][1] - cp[i] * Y[i + 1][1]];
  const k = 1 / (1 + q[0] + q[N - 1]);
  const s = [Y[0][0] + Y[N - 1][0], Y[0][1] + Y[N - 1][1]];
  const H1 = Y.map((y, i) => [y[0] - k * q[i] * s[0], y[1] - k * q[i] * s[1]]);
  const H2 = new Array(N);
  for (let i = 0; i < N - 1; i++) H2[i] = [2 * A[i + 1][0] - H1[i + 1][0], 2 * A[i + 1][1] - H1[i + 1][1]];
  H2[N - 1] = [2 * A[N][0] - H1[0][0], 2 * A[N][1] - H1[0][1]];
  return [H1, H2];
}

// np.isclose-style comparison of two points
function close2(x0, y0, x1, y1) {
  return Math.abs(x0 - x1) <= TOL + 1e-5 * Math.abs(x1) && Math.abs(y0 - y1) <= TOL + 1e-5 * Math.abs(y1);
}

// ------------------------------------------------------------------ VMobject
let NEXT_ID = 1;

export class VMobject {
  constructor(o = {}) {
    this.id = NEXT_ID++;
    this.points = [];
    this.submobjects = [];
    const color = o.color ?? '#FFFFFF';
    this.fill = [...rgb(o.fillColor ?? color), o.fillOpacity ?? 0];
    this.stroke = [...rgb(o.strokeColor ?? color), o.strokeOpacity ?? 1];
    this.strokeWidth = o.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    this.bgStroke = [0, 0, 0, 1];
    this.bgStrokeWidth = 0;
    this.zIndex = 0;
    this.updaters = [];
  }

  // style is applied to the whole family once the subclass has built its points,
  // mirroring manim's init_colors(propagate_colors=True)
  initColors() {
    const f = this.fill, s = this.stroke, w = this.strokeWidth;
    for (const m of this.getFamily()) {
      m.fill = f.slice();
      m.stroke = s.slice();
      m.strokeWidth = w;
    }
    return this;
  }

  // ---------- structure
  add(...mobs) {
    for (const m of mobs) {
      const i = this.submobjects.indexOf(m);
      if (i >= 0) this.submobjects.splice(i, 1);
      this.submobjects.push(m);
    }
    return this;
  }
  remove(...mobs) {
    this.submobjects = this.submobjects.filter((m) => !mobs.includes(m));
    return this;
  }
  get(i) {
    return this.submobjects[i < 0 ? this.submobjects.length + i : i];
  }
  get length() {
    return this.submobjects.length;
  }
  getFamily() {
    const all = [this];
    for (const s of this.submobjects) all.push(...s.getFamily());
    return removeRedundancies(all);
  }
  familyWithPoints() {
    return this.getFamily().filter((m) => m.points.length > 0);
  }
  copy() {
    const c = Object.create(Object.getPrototypeOf(this));
    Object.assign(c, this);
    c.id = NEXT_ID++;
    c.points = this.points.slice();
    c.fill = this.fill.slice();
    c.stroke = this.stroke.slice();
    c.bgStroke = this.bgStroke.slice();
    c.submobjects = this.submobjects.map((s) => s.copy());
    c.updaters = this.updaters.slice();
    return c;
  }

  // ---------- points
  numPoints() {
    return this.points.length / 2;
  }
  pt(i) {
    return [this.points[2 * i], this.points[2 * i + 1]];
  }
  setPoints(arr) {
    // arr: flat array or array of [x,y]
    this.points = Array.isArray(arr[0]) ? arr.flat() : arr.slice();
    return this;
  }
  pointList() {
    const out = [];
    for (let i = 0; i < this.points.length; i += 2) out.push([this.points[i], this.points[i + 1]]);
    return out;
  }
  appendPoints(list) {
    for (const p of list) this.points.push(p[0], p[1]);
    return this;
  }
  clearPoints() {
    this.points = [];
    return this;
  }
  getNumCurves() {
    return Math.floor(this.numPoints() / 4);
  }
  curve(n) {
    return [this.pt(4 * n), this.pt(4 * n + 1), this.pt(4 * n + 2), this.pt(4 * n + 3)];
  }
  hasNewPathStarted() {
    return this.numPoints() % 4 === 1;
  }
  lastPoint() {
    return this.pt(this.numPoints() - 1);
  }
  startNewPath(p) {
    const n = this.numPoints();
    if (n % 4 !== 0) {
      const lastAnchor = this.pt(n - (n % 4));
      for (let i = 0; i < 4 - (n % 4); i++) this.appendPoints([lastAnchor]);
    }
    this.appendPoints([p]);
    return this;
  }
  addCubicBezierCurveTo(h1, h2, a) {
    if (this.hasNewPathStarted()) this.appendPoints([h1, h2, a]);
    else this.appendPoints([this.lastPoint(), h1, h2, a]);
    return this;
  }
  addQuadraticBezierCurveTo(h, a) {
    const l = this.lastPoint();
    return this.addCubicBezierCurveTo([(2 / 3) * h[0] + (1 / 3) * l[0], (2 / 3) * h[1] + (1 / 3) * l[1]], [(2 / 3) * h[0] + (1 / 3) * a[0], (2 / 3) * h[1] + (1 / 3) * a[1]], a);
  }
  addLineTo(p) {
    const l = this.lastPoint();
    return this.addCubicBezierCurveTo(vlerp(l, p, 1 / 3), vlerp(l, p, 2 / 3), p);
  }
  setAnchorsAndHandles(a1, h1, h2, a2) {
    const pts = [];
    for (let i = 0; i < a1.length; i++) pts.push(a1[i], h1[i], h2[i], a2[i]);
    return this.setPoints(pts);
  }
  setPointsAsCorners(corners) {
    const a1 = corners.slice(0, -1), a2 = corners.slice(1);
    return this.setAnchorsAndHandles(a1, a1.map((p, i) => vlerp(p, a2[i], 1 / 3)), a1.map((p, i) => vlerp(p, a2[i], 2 / 3)), a2);
  }
  addPointsAsCorners(pts) {
    if (!pts.length) return this;
    const starts = [this.lastPoint(), ...pts.slice(0, -1)];
    if (this.hasNewPathStarted()) this.points.splice(-2, 2);
    const out = [];
    for (let i = 0; i < pts.length; i++) out.push(starts[i], vlerp(starts[i], pts[i], 1 / 3), vlerp(starts[i], pts[i], 2 / 3), pts[i]);
    return this.appendPoints(out);
  }
  isClosed() {
    const n = this.numPoints();
    if (!n) return false;
    const [x0, y0] = this.pt(0), [x1, y1] = this.pt(n - 1);
    return Math.abs(x0 - x1) <= TOL + 1e-5 * Math.abs(x1) && Math.abs(y0 - y1) <= TOL + 1e-5 * Math.abs(y1);
  }
  closePath() {
    if (!this.isClosed()) {
      const sp = this.getSubpaths();
      this.addLineTo(sp[sp.length - 1][0]);
    }
    return this;
  }
  reversePoints() {
    for (const m of this.familyWithPoints()) m.setPoints(m.pointList().reverse());
    return this;
  }
  // subpath split: a new subpath starts where one curve's end != next curve's start
  splitIndices() {
    const n = this.numPoints();
    if (n < 4) return [];
    const splits = [0];
    for (let b = 4; b < n; b += 4) {
      const e = this.pt(b - 1), s = this.pt(b);
      if (!close2(e[0], e[1], s[0], s[1])) splits.push(b);
    }
    splits.push(n);
    const out = [];
    for (let i = 0; i < splits.length - 1; i++) out.push([splits[i], splits[i + 1]]);
    return out;
  }
  getSubpaths() {
    const pl = this.pointList();
    return this.splitIndices().map(([a, b]) => pl.slice(a, b));
  }
  makeSmooth() {
    for (const sm of this.familyWithPoints()) {
      const subs = sm.getSubpaths();
      sm.clearPoints();
      for (const sp of subs) {
        const anchors = [];
        for (let i = 0; i < sp.length; i += 4) anchors.push(sp[i]);
        anchors.push(sp[sp.length - 1]);
        const [h1, h2] = smoothHandles(anchors);
        const ns = sp.map((p) => p.slice());
        for (let i = 0; i < h1.length; i++) {
          ns[4 * i + 1] = h1[i];
          ns[4 * i + 2] = h2[i];
        }
        sm.appendPoints(ns);
      }
    }
    return this;
  }
  insertNCurvesToPointList(n, pts) {
    if (pts.length === 1) return Array(4 * n).fill(pts[0]).map((p) => p.slice());
    const tuples = [];
    for (let i = 0; i + 3 < pts.length; i += 4) tuples.push(pts.slice(i, i + 4));
    return bezierRemap(tuples, tuples.length + n).flat();
  }
  insertNCurves(n) {
    let np = null;
    if (this.hasNewPathStarted()) np = this.lastPoint();
    this.setPoints(this.insertNCurvesToPointList(n, this.pointList()));
    if (np) this.appendPoints([np]);
    return this;
  }
  curveLengthPieces(n, samples = 10) {
    const c = this.curve(n);
    const pts = [];
    for (let i = 0; i < samples; i++) pts.push(bezierPoint(c, i / (samples - 1)));
    const out = [];
    for (let i = 1; i < pts.length; i++) out.push(vnorm(vsub(pts[i], pts[i - 1])));
    return out;
  }
  getSubcurve(a, b) {
    const v = this.copy();
    v.pointwiseBecomePartial(this, a, b);
    return v;
  }

  // manim VMobject.pointwise_become_partial
  pointwiseBecomePartial(vm, a, b) {
    if (a <= 0 && b >= 1) {
      this.points = vm.points.slice();
      return this;
    }
    const nc = vm.getNumCurves();
    if (nc === 0) return this;
    const [li, lr] = integerInterpolate(0, nc, a);
    const [ui, ur] = integerInterpolate(0, nc, b);
    const src = vm.points.slice();
    const cur = (k) => [0, 1, 2, 3].map((j) => [src[2 * (4 * k + j)], src[2 * (4 * k + j) + 1]]);
    if (li === ui) {
      this.setPoints(partialBezier(cur(li), lr, ur));
    } else {
      const out = [...partialBezier(cur(li), lr, 1)];
      for (let k = li + 1; k < ui; k++) out.push(...cur(k));
      out.push(...partialBezier(cur(ui), 0, ur));
      this.setPoints(out);
    }
    return this;
  }

  // ---------- geometry queries
  allPoints() {
    const out = [];
    for (const m of this.getFamily()) for (let i = 0; i < m.points.length; i++) out.push(m.points[i]);
    return out;
  }
  criticalPoint(dir) {
    const p = this.allPoints();
    if (!p.length) return [0, 0];
    const res = [0, 0];
    for (let d = 0; d < 2; d++) {
      let mn = Infinity, mx = -Infinity;
      for (let i = d; i < p.length; i += 2) {
        if (p[i] < mn) mn = p[i];
        if (p[i] > mx) mx = p[i];
      }
      res[d] = dir[d] < 0 ? mn : dir[d] > 0 ? mx : (mn + mx) / 2;
    }
    return res;
  }
  getCenter() {
    return this.criticalPoint(ORIGIN);
  }
  get width() {
    return this.criticalPoint(RIGHT)[0] - this.criticalPoint(LEFT)[0];
  }
  get height() {
    return this.criticalPoint(UP)[1] - this.criticalPoint(DOWN)[1];
  }
  getLeft() { return this.criticalPoint(LEFT); }
  getRight() { return this.criticalPoint(RIGHT); }
  getTop() { return this.criticalPoint(UP); }
  getBottom() { return this.criticalPoint(DOWN); }
  getCorner(d) { return this.criticalPoint(d); }
  getStart() { return this.pt(0); }
  getEnd() { return this.lastPoint(); }

  // ---------- transforms
  applyPoints(fn) {
    for (const m of this.familyWithPoints()) {
      const p = m.points;
      for (let i = 0; i < p.length; i += 2) {
        const r = fn(p[i], p[i + 1]);
        p[i] = r[0];
        p[i + 1] = r[1];
      }
    }
    return this;
  }
  shift(v) {
    return this.applyPoints((x, y) => [x + v[0], y + v[1]]);
  }
  aboutPoint(o) {
    if (o.aboutPoint) return o.aboutPoint.slice();
    return this.criticalPoint(o.aboutEdge ?? ORIGIN);
  }
  scale(f, o = {}) {
    const c = this.aboutPoint(o);
    return this.applyPoints((x, y) => [c[0] + f * (x - c[0]), c[1] + f * (y - c[1])]);
  }
  stretch(f, dim, o = {}) {
    const c = this.aboutPoint(o);
    return this.applyPoints((x, y) => (dim === 0 ? [c[0] + f * (x - c[0]), y] : [x, c[1] + f * (y - c[1])]));
  }
  rotate(angle, o = {}) {
    const c = this.aboutPoint(o);
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return this.applyPoints((x, y) => [c[0] + cs * (x - c[0]) - sn * (y - c[1]), c[1] + sn * (x - c[0]) + cs * (y - c[1])]);
  }
  flipY(o = {}) {
    const c = this.aboutPoint(o);
    return this.applyPoints((x, y) => [x, 2 * c[1] - y]);
  }
  center() {
    return this.shift(vmul(this.getCenter(), -1));
  }
  moveTo(target, alignedEdge = ORIGIN) {
    const t = target instanceof VMobject ? target.criticalPoint(alignedEdge) : target;
    const p = this.criticalPoint(alignedEdge);
    return this.shift(vsub(t, p));
  }
  nextTo(target, direction = RIGHT, buff = MED_SMALL_BUFF, alignedEdge = ORIGIN) {
    const tp = target instanceof VMobject ? target.criticalPoint(vadd(alignedEdge, direction)) : target;
    const p = this.criticalPoint(vsub(alignedEdge, direction));
    return this.shift(vadd(vsub(tp, p), vmul(direction, buff)));
  }
  alignTo(target, direction) {
    const point = target instanceof VMobject ? target.criticalPoint(direction) : target;
    for (let d = 0; d < 2; d++) {
      if (direction[d] !== 0) {
        const cur = this.criticalPoint(d === 0 ? [direction[0], 0] : [0, direction[1]])[d];
        const v = [0, 0];
        v[d] = point[d] - cur;
        this.shift(v);
      }
    }
    return this;
  }
  toEdge(edge, buff = EDGE_BUFF) {
    const target = [Math.sign(edge[0]) * FRAME_W / 2, Math.sign(edge[1]) * FRAME_H / 2];
    const p = this.criticalPoint(edge);
    const v = [(target[0] - p[0] - buff * edge[0]) * Math.abs(Math.sign(edge[0])), (target[1] - p[1] - buff * edge[1]) * Math.abs(Math.sign(edge[1]))];
    return this.shift(v);
  }
  arrange(direction = RIGHT, buff = MED_SMALL_BUFF, o = {}) {
    const s = this.submobjects;
    for (let i = 1; i < s.length; i++) s[i].nextTo(s[i - 1], direction, buff, o.alignedEdge ?? ORIGIN);
    if (o.center !== false) this.center();
    return this;
  }

  // ---------- style
  setFill(color = null, opacity = null, family = true) {
    if (family) for (const s of this.submobjects) s.setFill(color, opacity, family);
    if (color != null) this.fill.splice(0, 3, ...rgb(color));
    if (opacity != null) this.fill[3] = opacity;
    return this;
  }
  setStroke(color = null, width = null, opacity = null, family = true, background = false) {
    if (family) for (const s of this.submobjects) s.setStroke(color, width, opacity, family, background);
    const arr = background ? this.bgStroke : this.stroke;
    if (color != null) arr.splice(0, 3, ...rgb(color));
    if (opacity != null) arr[3] = opacity;
    if (width != null) {
      if (background) this.bgStrokeWidth = width;
      else this.strokeWidth = width;
    }
    return this;
  }
  setColor(color, family = true) {
    this.setFill(color, null, family);
    this.setStroke(color, null, null, family);
    return this;
  }
  setOpacity(op, family = true) {
    this.setFill(null, op, family);
    this.setStroke(null, null, op, family);
    this.setStroke(null, null, op, family, true);
    return this;
  }
  fade(darkness = 0.5, family = true) {
    const f = 1 - darkness;
    this.fill[3] *= f;
    this.stroke[3] *= f;
    this.bgStroke[3] *= f;
    if (family) for (const s of this.submobjects) s.fade(darkness, family);
    return this;
  }
  matchStyle(vm, family = true) {
    this.fill = vm.fill.slice();
    this.stroke = vm.stroke.slice();
    this.strokeWidth = vm.strokeWidth;
    this.bgStroke = vm.bgStroke.slice();
    this.bgStrokeWidth = vm.bgStrokeWidth;
    if (family && this.submobjects.length) {
      const s2 = vm.submobjects.length ? vm.submobjects : [vm];
      this.submobjects.forEach((s, i) => s.matchStyle(s2[Math.min(i, s2.length - 1)]));
    }
    return this;
  }

  // ---------- interpolation (Transform)
  interpolate(m1, m2, alpha) {
    const a = m1.points, b = m2.points;
    const out = new Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (1 - alpha) * a[i] + alpha * b[i];
    this.points = out;
    this.interpolateColor(m1, m2, alpha);
    return this;
  }
  interpolateColor(m1, m2, alpha) {
    const L = (x, y) => x.map((v, i) => (1 - alpha) * v + alpha * y[i]);
    if (alpha === 1) {
      this.fill = m2.fill.slice();
      this.stroke = m2.stroke.slice();
      this.bgStroke = m2.bgStroke.slice();
      this.strokeWidth = m2.strokeWidth;
      this.bgStrokeWidth = m2.bgStrokeWidth;
      return this;
    }
    this.fill = L(m1.fill, m2.fill);
    this.stroke = L(m1.stroke, m2.stroke);
    this.bgStroke = L(m1.bgStroke, m2.bgStroke);
    this.strokeWidth = lerp(m1.strokeWidth, m2.strokeWidth, alpha);
    this.bgStrokeWidth = lerp(m1.bgStrokeWidth, m2.bgStrokeWidth, alpha);
    return this;
  }

  // manim Mobject.align_data and friends
  alignData(m) {
    this.nullPointAlign(m);
    this.alignSubmobjects(m);
    this.alignPoints(m);
    this.submobjects.forEach((s, i) => s.alignData(m.submobjects[i]));
    return this;
  }
  nullPointAlign(m) {
    for (const [m1, m2] of [[this, m], [m, this]]) {
      if (m1.points.length === 0 && m2.points.length > 0) m2.pushSelfIntoSubmobjects();
    }
    return this;
  }
  pushSelfIntoSubmobjects() {
    const c = this.copy();
    c.submobjects = [];
    this.points = [];
    this.add(c);
    return this;
  }
  alignSubmobjects(m) {
    const n1 = this.submobjects.length, n2 = m.submobjects.length;
    this.addNMoreSubmobjects(Math.max(0, n2 - n1));
    m.addNMoreSubmobjects(Math.max(0, n1 - n2));
    return this;
  }
  pointMobject() {
    const p = new VMobject();
    p.points = this.getCenter().slice();
    p.matchStyle(this, false);
    return p;
  }
  addNMoreSubmobjects(n) {
    if (n === 0) return this;
    const curr = this.submobjects.length;
    if (curr === 0) {
      this.submobjects = Array.from({ length: n }, () => this.pointMobject());
      return this;
    }
    const target = curr + n;
    const split = new Array(curr).fill(0);
    for (let i = 0; i < target; i++) split[Math.floor((i * curr) / target)] += 1;
    const out = [];
    this.submobjects.forEach((s, i) => {
      out.push(s);
      for (let k = 1; k < split[i]; k++) out.push(s.copy().fade(1));
    });
    this.submobjects = out;
    return this;
  }
  alignPoints(vm) {
    if (this.numPoints() === vm.numPoints()) return this;
    for (const mob of [this, vm]) {
      if (mob.points.length === 0) mob.startNewPath(mob.getCenter());
      if (mob.hasNewPathStarted()) mob.addLineTo(mob.lastPoint());
    }
    const s1 = this.getSubpaths(), s2 = vm.getSubpaths();
    const n = Math.max(s1.length, s2.length);
    const nth = (list, i) => {
      if (i >= list.length) {
        if (!list.length) return Array.from({ length: 4 }, () => [0, 0]);
        const last = list[list.length - 1];
        return Array.from({ length: 4 }, () => last[last.length - 1].slice());
      }
      let path = list[i];
      while (path.length > 4) {
        const ref = path[path.length - 5];
        const tail = path.slice(-4);
        if (tail.every((p) => Math.abs(p[0] - ref[0]) <= TOL + 1e-5 * Math.abs(ref[0]) && Math.abs(p[1] - ref[1]) <= TOL + 1e-5 * Math.abs(ref[1]))) path = path.slice(0, -4);
        else break;
      }
      return path;
    };
    const p1 = [], p2 = [];
    for (let i = 0; i < n; i++) {
      let a = nth(s1, i), b = nth(s2, i);
      const d1 = Math.max(0, Math.floor((b.length - a.length) / 4));
      const d2 = Math.max(0, Math.floor((a.length - b.length) / 4));
      a = this.insertNCurvesToPointList(d1, a);
      b = this.insertNCurvesToPointList(d2, b);
      p1.push(...a);
      p2.push(...b);
    }
    this.setPoints(p1);
    vm.setPoints(p2);
    return this;
  }

  // ---------- updaters (always_redraw)
  addUpdater(fn) {
    this.updaters.push(fn);
    return this;
  }
  update() {
    for (const f of this.updaters) f(this);
    for (const s of this.submobjects) s.update();
    return this;
  }
  become(other) {
    const c = other.copy();
    this.points = c.points;
    this.submobjects = c.submobjects;
    this.fill = c.fill;
    this.stroke = c.stroke;
    this.strokeWidth = c.strokeWidth;
    this.bgStroke = c.bgStroke;
    this.bgStrokeWidth = c.bgStrokeWidth;
    this.drawText = c.drawText;
    this.glow = c.glow;
    this.shadow = c.shadow;
    return this;
  }
}

export class VGroup extends VMobject {
  constructor(...mobs) {
    super();
    this.add(...mobs);
  }
}

export function removeRedundancies(list) {
  const seen = new Set();
  const out = [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (!seen.has(list[i])) {
      seen.add(list[i]);
      out.push(list[i]);
    }
  }
  return out.reverse();
}

export function alwaysRedraw(fn) {
  const m = fn();
  m.addUpdater((mob) => mob.become(fn()));
  return m;
}
