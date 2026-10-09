// Geometry primitives, ported from manim CE (mobject/geometry, graphing).
import {
  VMobject, VGroup, TAU, PI, DEGREES, RIGHT, UP, DOWN, ORIGIN, DEFAULT_DOT_RADIUS,
  vlerp, vsub, vnorm, vadd, vmul, bezierPoint,
} from './core.js';

export class Arc extends VMobject {
  constructor(o = {}) {
    super(o);
    this.radius = o.radius ?? 1;
    this.startAngle = o.startAngle ?? 0;
    this.angle = o.angle ?? TAU / 4;
    this.numComponents = o.numComponents ?? 9;
    this.arcCenter = o.arcCenter ?? ORIGIN;
    this.generatePoints();
    this.initColors();
  }
  generatePoints() {
    const n = this.numComponents;
    const anchors = [];
    for (let i = 0; i < n; i++) {
      const a = this.startAngle + (this.angle * i) / (n - 1);
      anchors.push([Math.cos(a), Math.sin(a)]);
    }
    const dTheta = this.angle / (n - 1);
    const f = (4 / 3) * Math.tan(dTheta / 4);
    const tan = anchors.map(([x, y]) => [-y, x]);
    const a1 = anchors.slice(0, -1), a2 = anchors.slice(1);
    const h1 = a1.map((p, i) => [p[0] + f * tan[i][0], p[1] + f * tan[i][1]]);
    const h2 = a2.map((p, i) => [p[0] - f * tan[i + 1][0], p[1] - f * tan[i + 1][1]]);
    this.setAnchorsAndHandles(a1, h1, h2, a2);
    this.scale(this.radius, { aboutPoint: ORIGIN });
    this.shift(this.arcCenter);
  }
}

export class Circle extends Arc {
  constructor(o = {}) {
    super({ color: '#FC6255', ...o, startAngle: 0, angle: TAU, radius: o.radius ?? 1 });
  }
}

export class Dot extends Circle {
  constructor(point = ORIGIN, o = {}) {
    super({ radius: DEFAULT_DOT_RADIUS, strokeWidth: 0, fillOpacity: 1, color: '#FFFFFF', ...o, arcCenter: point });
  }
}

export class AnnularSector extends VMobject {
  constructor(o = {}) {
    super({ fillOpacity: 1, strokeWidth: 0, color: '#FFFFFF', ...o });
    const mk = (r) => new Arc({ startAngle: o.startAngle ?? 0, angle: o.angle ?? TAU / 4, radius: r, arcCenter: o.arcCenter ?? ORIGIN });
    const inner = mk(o.innerRadius ?? 1), outer = mk(o.outerRadius ?? 2);
    outer.reversePoints();
    this.appendPoints(inner.pointList());
    this.addLineTo(outer.pt(0));
    this.appendPoints(outer.pointList());
    this.addLineTo(inner.pt(0));
    this.initColors();
  }
}

export class Sector extends AnnularSector {
  constructor(o = {}) {
    super({ ...o, innerRadius: 0, outerRadius: o.radius ?? 1 });
  }
}

export class Line extends VMobject {
  constructor(start = [-1, 0], end = [1, 0], o = {}) {
    super(o);
    this.setPointsAsCorners([start.slice(), end.slice()]);
    this.initColors();
  }
  getLength() {
    return vnorm(vsub(this.getEnd(), this.getStart()));
  }
  getAngle() {
    const d = vsub(this.getEnd(), this.getStart());
    return Math.atan2(d[1], d[0]);
  }
}

function interp1(x, xs, ys) {
  // numpy.interp
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

export class DashedVMobject extends VMobject {
  constructor(vmobject, o = {}) {
    super({ color: '#FFFFFF', ...o });
    const base = vmobject;
    const vm = base.copy();
    const r = o.dashedRatio ?? 0.5, n = o.numDashes ?? 15, offset = o.dashOffset ?? 0;
    if (n > 0) {
      const dashLen = r / n;
      const closed = vm.isClosed();
      const voidLen = closed ? (1 - r) / n : n === 1 ? 1 - r : (1 - r) / (n - 1);
      const period = dashLen + voidLen;
      const phase = (offset % 1) * period;
      const patternLen = closed ? 1 : 1 + voidLen;
      const mod = (a, m) => ((a % m) + m) % m;
      const starts = [], ends = [];
      for (let i = 0; i < n; i++) {
        starts.push(mod(i * period + phase, patternLen));
        ends.push(mod(i * period + dashLen + phase, patternLen));
      }
      if (!closed) {
        const L = starts.length - 1;
        if (ends[L] > 1 && starts[L] > 1) {
          ends.pop();
          starts.pop();
        } else if (ends[L] < dashLen) {
          if (starts[L] < 1) {
            starts.push(0);
            ends.push(ends[L]);
            ends[L] = 1;
          } else starts[L] = 0;
        } else if (starts[L] > 1 - dashLen) ends[L] = 1;
      }
      const norms = [0];
      for (let k = 0; k < vm.getNumCurves(); k++) norms.push(...vm.curveLengthPieces(k));
      const lens = [];
      norms.reduce((acc, v) => (lens.push(acc + v), acc + v), 0);
      const refs = lens.map((_, i) => i / (lens.length - 1));
      const total = lens[lens.length - 1];
      for (let i = 0; i < starts.length; i++) {
        this.add(vm.getSubcurve(interp1(starts[i] * total, lens, refs), interp1(ends[i] * total, lens, refs)));
      }
    }
    this.matchStyle(base, false);
  }
}

export class DashedLine extends Line {
  constructor(start, end, o = {}) {
    super(start, end, o);
    const dashLength = o.dashLength ?? 0.05, ratio = o.dashedRatio ?? 0.5;
    const num = Math.max(2, Math.ceil((this.getLength() / dashLength) * ratio));
    const dashes = new DashedVMobject(this, { numDashes: num, dashedRatio: ratio });
    this.clearPoints();
    this.add(...dashes.submobjects);
  }
}

export class Polygon extends VMobject {
  constructor(vertices, o = {}) {
    super({ color: '#58C4DD', ...o });
    this.startNewPath(vertices[0]);
    this.addPointsAsCorners([...vertices.slice(1), vertices[0]]);
    this.initColors();
  }
}

export class Rectangle extends Polygon {
  constructor(o = {}) {
    const w = (o.width ?? 4) / 2, h = (o.height ?? 2) / 2;
    super([[w, h], [-w, h], [-w, -h], [w, -h]], { color: '#FFFFFF', ...o });
  }
}

export class Square extends Rectangle {
  constructor(o = {}) {
    const side = o.sideLength ?? 2;
    super({ ...o, width: side, height: side });
  }
}

// Rectangle with circular-arc corners (manim's RoundedRectangle).
export class RoundedRectangle extends VMobject {
  constructor(o = {}) {
    super({ color: '#FFFFFF', ...o });
    const w = (o.width ?? 4) / 2, h = (o.height ?? 2) / 2;
    const r = Math.min(o.cornerRadius ?? 0.5, w, h);
    const k = (4 / 3) * Math.tan(Math.PI / 8) * r;
    const corners = [[w - r, h - r, 0], [-w + r, h - r, PI / 2], [-w + r, -h + r, PI], [w - r, -h + r, 1.5 * PI]];
    this.startNewPath([w, -h + r]);
    for (const [cx, cy, a0] of corners) {
      const a1 = a0 + PI / 2;
      const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      this.addLineTo(p0);
      this.addCubicBezierCurveTo([p0[0] - k * Math.sin(a0), p0[1] + k * Math.cos(a0)], [p1[0] + k * Math.sin(a1), p1[1] - k * Math.cos(a1)], p1);
    }
    this.addLineTo([w, -h + r]);
    this.initColors();
  }
}

function arange(a, b, step) {
  const n = Math.max(0, Math.ceil((b - a) / step));
  return Array.from({ length: n }, (_, i) => a + i * step);
}

export class ParametricFunction extends VMobject {
  constructor(fn, tRange, o = {}) {
    super({ color: '#FFFF00', ...o });
    const [t1, t2, step] = tRange;
    const ts = [...arange(t1, t2, step), t2];
    const pts = ts.map(fn);
    this.startNewPath(pts[0]);
    this.addPointsAsCorners(pts.slice(1));
    if (o.useSmoothing !== false) this.makeSmooth();
    this.initColors();
  }
}

export class NumberLine extends Line {
  constructor(xRange, o = {}) {
    super([xRange[0], 0], [xRange[1], 0], { strokeWidth: 2, ...o });
    this.xMin = xRange[0];
    this.xMax = xRange[1];
    this.xStep = xRange[2] ?? 1;
    this.tickSize = o.tickSize ?? 0.1;
    this.excludeOriginTick = o.excludeOriginTick ?? false;
    if (o.length) this.scale(o.length / this.getLength());
    else this.scale(o.unitSize ?? 1);
    this.center();
    if (o.includeTicks !== false) {
      const ticks = new VGroup();
      for (const x of this.tickRange()) {
        const t = new Line(vmul(DOWN, this.tickSize), vmul(UP, this.tickSize));
        t.rotate(this.getAngle());
        t.moveTo(this.n2p(x));
        t.matchStyle(this);
        ticks.add(t);
      }
      this.add(ticks);
      this.ticks = ticks;
    }
    this.rotate(o.rotation ?? 0);
  }
  tickRange() {
    let [a, b, s] = [this.xMin, this.xMax + 1e-6, this.xStep];
    if ((a < b && b < 0) || (b > a && a > 0)) return arange(a, b, s);
    let start = this.excludeOriginTick ? s : 0;
    const neg = arange(start, Math.abs(a) + 1e-6, s).map((v) => -v);
    const pos = arange(start, b, s);
    return [...new Set([...neg, ...pos])].sort((x, y) => x - y);
  }
  n2p(x) {
    const alpha = (x - this.xMin) / (this.xMax - this.xMin);
    return vlerp(this.getStart(), this.getEnd(), alpha);
  }
}

export class Axes extends VGroup {
  constructor(o = {}) {
    super();
    const ac = o.axisConfig ?? {};
    const mk = (range, len, rot) => {
      const ax = new NumberLine(range, { ...ac, length: len, rotation: rot, excludeOriginTick: true });
      const o0 = range[0] > 0 ? range[0] : range[1] < 0 ? range[1] : 0;
      ax.shift(vmul(ax.n2p(o0), -1));
      ax.origin0 = o0;
      return ax;
    };
    this.xAxis = mk(o.xRange, o.xLength, 0);
    this.yAxis = mk(o.yRange, o.yLength, 90 * DEGREES);
    this.add(this.xAxis, this.yAxis);
    const c = [(o.xRange[0] + o.xRange[1]) / 2, (o.yRange[0] + o.yRange[1]) / 2];
    this.shift(vmul(this.c2p(c[0], c[1]), -1));
  }
  c2p(x, y) {
    const origin = this.xAxis.n2p(this.xAxis.origin0);
    return vadd(this.xAxis.n2p(x), vsub(this.yAxis.n2p(y), origin));
  }
  plot(fn, xRange, o = {}) {
    return new ParametricFunction((t) => this.c2p(t, fn(t)), xRange, o);
  }
}

export { bezierPoint };
