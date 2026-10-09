// S03 "Bridge" rebuilt on the browser engine. Mirrors
// engine/mathkit/*.py + engine/lessons/best_angle/common.py + s1_engage.py
// line by line so the two renderers can be compared frame by frame.
import { VMobject, VGroup, PI, TAU, UP, DOWN, LEFT, RIGHT, DR, vadd, vsub, vmul, vunit } from '../engine/core.js';
import { Arc, Circle, Dot, Sector, Line, DashedLine, DashedVMobject, Polygon, Axes } from '../engine/geometry.js';
import { Tex, Text } from '../engine/tex.js';
import { Create, FadeIn, FadeOut, Indicate, TransformFromCopy, animate } from '../engine/animation.js';

// ---------------------------------------------------------------- theme.py
export const BG = '#0E1217';
const INK = '#E9EDF2', MUTED = '#8B96A8', FAINT = '#4A5566';
const GOLD = '#F5C85C', TEAL = '#3FD7C7', BLUE = '#79A6FF';
const PITCH_A = '#18452F', PITCH_B = '#1B4E35', PITCH_LINE = '#D9EFE2';
const FONT = 'Avenir Next';

// ---------------------------------------------------------------- geo.py
const heading = (v) => Math.atan2(v[1], v[0]);
const pyMod = (a, m) => ((a % m) + m) % m;

const texCache = new Map();
export function T(parts, o = {}) {
  parts = Array.isArray(parts) ? parts : [parts];
  const fontSize = o.fontSize ?? 40, color = o.color ?? INK;
  const key = JSON.stringify([parts, fontSize, color]);
  if (!texCache.has(key)) texCache.set(key, new Tex(parts, { fontSize, color }));
  const m = texCache.get(key).copy();
  for (const [k, c] of Object.entries(o.colors ?? {})) m.get(+k).setFill(c);
  return m;
}
export function label(text, fontSize = 28, color = INK, weight = 'MEDIUM') {
  return new Text(text, { font: FONT, fontSize, color, weight, compat: true });
}
export function wedge(vertex, p1, p2, o = {}) {
  const radius = o.radius ?? 0.5, color = o.color ?? TEAL, opacity = o.opacity ?? 0.32, stroke = o.stroke ?? 3.0;
  const a1 = heading(vsub(p1, vertex)), a2 = heading(vsub(p2, vertex));
  const d = pyMod(a2 - a1 + PI, 2 * PI) - PI;
  const sector = new Sector({ radius, startAngle: a1, angle: d, arcCenter: vertex, fillColor: color, fillOpacity: opacity, strokeWidth: 0 });
  const arc = new Arc({ radius, startAngle: a1, angle: d, arcCenter: vertex, color, strokeWidth: stroke });
  return new VGroup(sector, arc);
}
export function glowDot(point, color = INK, r = 0.075) {
  const g = new VGroup();
  for (const [k, op] of [[4.2, 0.07], [2.8, 0.12], [1.8, 0.2]]) g.add(new Dot(point, { radius: r * k, color, fillOpacity: op, strokeWidth: 0 }));
  g.add(new Dot(point, { radius: r, color, strokeWidth: 0 }));
  return g;
}
export function pointLabel(name, point, direction, o = {}) {
  const t = T(name, { fontSize: o.fontSize ?? 38, color: o.color ?? INK });
  return t.moveTo(vadd(point, vmul(vunit(direction), (o.buff ?? 0.2) + 0.12)));
}

// ---------------------------------------------------------------- pitch.py
export class Pitch extends VGroup {
  constructor(o = {}) {
    super();
    this.origin = o.origin ?? [-6.17, 3.075];
    this.s = o.scale ?? 0.21;
    const [x0, x1] = o.xRange ?? [-3, 27];
    const [, y1] = o.yRange ?? [-2.5, 30];
    const y0 = (o.yRange ?? [-2.5, 30])[0];
    [this.a, this.b] = o.posts ?? [9, 16];
    const stripe = 4;
    const grass = new VGroup();
    let y = 0, k = 0;
    while (y < y1) {
      const h = Math.min(stripe, y1 - y);
      grass.add(this.rect(x0, y, x1, y + h, k % 2 === 0 ? PITCH_A : PITCH_B));
      y += h;
      k++;
    }
    const behind = this.rect(x0, y0, x1, 0, PITCH_A).setFill(null, 0.55);
    this.grass = new VGroup(behind, grass);

    const lw = 2.2;
    const lines = new VGroup();
    lines.add(this.seg([x0, 0], [x1, 0], PITCH_LINE, lw * 1.3));
    const sixL = this.a - 5.5, sixR = this.b + 5.5;
    lines.add(this.poly([[sixL, 0], [sixL, 5.5], [sixR, 5.5], [sixR, 0]], PITCH_LINE, lw));
    lines.add(this.seg([x0, 16.5], [x1, 16.5], PITCH_LINE, lw));
    const spot = [(this.a + this.b) / 2, 11];
    lines.add(new Dot(this.p(...spot), { radius: 0.045, color: PITCH_LINE, fillOpacity: 0.7 }));
    const t0 = Math.asin((16.5 - 11) / 9.15);
    const arcPts = [];
    for (let i = 0; i < 40; i++) {
      const t = t0 + ((PI - 2 * t0) * i) / 39;
      arcPts.push(this.p(spot[0] + 9.15 * Math.cos(t), spot[1] + 9.15 * Math.sin(t)));
    }
    const arc = new VMobject({ strokeColor: PITCH_LINE, strokeWidth: lw });
    arc.setPointsAsCorners(arcPts).makeSmooth();
    lines.add(arc);
    lines.setStroke(null, null, 0.5);
    this.lines = lines;

    const depth = 2;
    const net = new VGroup();
    net.add(this.rect(this.a, -depth, this.b, 0, INK).setFill(null, 0.06).setStroke(INK, 1.2, 0.5));
    for (let i = 1; i < 14; i++) {
      const xx = this.a + ((this.b - this.a) * i) / 14;
      net.add(this.seg([xx, -depth], [xx, 0], INK, 0.8).setStroke(null, null, 0.22));
    }
    for (let j = 1; j < 4; j++) {
      const yy = (-depth * j) / 4;
      net.add(this.seg([this.a, yy], [this.b, yy], INK, 0.8).setStroke(null, null, 0.22));
    }
    this.net = net;
    this.postA = new Dot(this.p(this.a, 0), { radius: 0.085, color: GOLD });
    this.postB = new Dot(this.p(this.b, 0), { radius: 0.085, color: GOLD });
    this.mouth = this.seg([this.a, 0], [this.b, 0], GOLD, 5);
    this.path = new DashedLine(this.p(0, 0), this.p(0, y1), { dashLength: 0.12, dashedRatio: 0.55, color: INK, strokeWidth: 2.2 }).setStroke(null, null, 0.55);
    this.add(this.grass, this.lines, this.net, this.mouth, this.postA, this.postB);
  }
  p(x, y) {
    return [this.origin[0] + x * this.s, this.origin[1] - y * this.s];
  }
  A() { return this.p(this.a, 0); }
  B() { return this.p(this.b, 0); }
  rect(x0, y0, x1, y1, color) {
    return new Polygon([this.p(x0, y0), this.p(x1, y0), this.p(x1, y1), this.p(x0, y1)], { fillColor: color, fillOpacity: 1, strokeWidth: 0 });
  }
  seg(a, b, color, width) {
    return new Line(this.p(...a), this.p(...b), { color, strokeWidth: width });
  }
  poly(pts, color, width) {
    return new VMobject({ strokeColor: color, strokeWidth: width }).setPointsAsCorners(pts.map((q) => this.p(...q)));
  }
  circleThroughPosts(k, color, width = 3) {
    const cx = (this.a + this.b) / 2;
    const r = Math.hypot(cx - this.a, k);
    return new Circle({ radius: r * this.s, color, strokeWidth: width }).moveTo(this.p(cx, k));
  }
  theta(d) {
    if (d <= 0) return 0;
    return ((Math.atan(this.b / d) - Math.atan(this.a / d)) * 180) / PI;
  }
}

// ---------------------------------------------------------------- common.py
const PITCH_KW = { origin: [-6.17, 3.075], scale: 0.21 };
const BEST = 12;

export function playerToken(point, color = INK) {
  return new VGroup(
    new Dot(point, { radius: 0.24, color, fillOpacity: 0.12, strokeWidth: 0 }),
    new Dot(point, { radius: 0.115, color, strokeColor: BG, strokeWidth: 2.5 }),
  );
}

export function viewCone(pitch, d, o = {}) {
  const arcR = o.arcR ?? 0.8, color = o.color ?? TEAL;
  const P_ = pitch.p(0, d), A_ = pitch.A(), B_ = pitch.B();
  const g = new VGroup();
  g.add(new Polygon([P_, A_, B_], { fillColor: color, fillOpacity: o.coneOpacity ?? 0.17, strokeWidth: 0 }));
  g.add(new Line(P_, A_, { color, strokeWidth: 2.5 }), new Line(P_, B_, { color, strokeWidth: 2.5 }));
  if (d > 0.4) g.add(wedge(P_, A_, B_, { radius: arcR, color, opacity: 0.45 }));
  if (o.token !== false) g.add(playerToken(P_));
  return g;
}

export class AngleGraph extends VGroup {
  constructor(pitch, center = [3.75, -0.35]) {
    super();
    this.pitch = pitch;
    const ax = new Axes({
      xRange: [0, 30, 5], yRange: [0, 20, 5], xLength: 5.6, yLength: 4.4,
      axisConfig: { color: MUTED, strokeWidth: 2, tickSize: 0.06 },
    }).moveTo(center);
    this.ax = ax;
    const nums = new VGroup();
    for (let x = 0; x <= 30; x += 5) nums.add(T(String(x), { fontSize: 24, color: MUTED }).nextTo(ax.c2p(x, 0), DOWN, 0.16));
    for (const y of [5, 10, 15, 20]) nums.add(T(`${y}^\\circ`, { fontSize: 24, color: MUTED }).nextTo(ax.c2p(0, y), LEFT, 0.14));
    const xl = label('distance from goal line, d (m)', 22, MUTED).nextTo(ax.xAxis, DOWN, 0.55);
    const yl = new VGroup(T('\\theta', { fontSize: 32, color: TEAL }), label('shooting angle', 22, MUTED)).arrange(RIGHT, 0.14);
    yl.nextTo(ax.c2p(0, 20), UP, 0.22).alignTo(ax, LEFT).shift(vmul(LEFT, 0.35));
    const grid = new VGroup(...[5, 10, 15, 20].map((y) => new DashedLine(ax.c2p(0, y), ax.c2p(30, y), { dashLength: 0.05, color: FAINT, strokeWidth: 1 })));
    this.frameParts = new VGroup(grid, ax, nums, xl, yl);
    this.add(this.frameParts);
  }
  curve(d0 = 0.02, d1 = 30, color = TEAL, width = 4) {
    return this.ax.plot((d) => this.pitch.theta(d), [d0, Math.max(d1, d0 + 0.01), 0.05], { color, strokeWidth: width });
  }
  point(d) {
    return this.ax.c2p(d, this.pitch.theta(d));
  }
}

export function readout(d, th, fontSize = 34) {
  const a = T(['d', '=', d.toFixed(1), '\\,\\text{m}'], { fontSize });
  const b = T(['\\theta', '=', `${th.toFixed(1)}^\\circ`], { fontSize, colors: { 0: TEAL, 2: TEAL } });
  return new VGroup(a, b).arrange(RIGHT, 0.6);
}

// ---------------------------------------------------------------- S03_Bridge
export const LINES = [
  'Dragging finds the peak: about 12 meters out, where the angle tops out near 16.3°.',
  'But why 12? Move the goal, or change her run, and we would have to measure all over again.',
  'Mathematicians want to see why. And the key is a surprisingly simple fact about circles.',
];

export function buildS03(scene) {
  const pitch = new Pitch(PITCH_KW);
  const graph = new AngleGraph(pitch);
  const full = graph.curve(0.02, 30);
  const cone = viewCone(pitch, BEST);
  const dot = glowDot(graph.point(BEST), TEAL, 0.07);
  const ro = readout(BEST, pitch.theta(BEST)).moveTo([3.75, 3.25]);
  scene.add(pitch, pitch.path, graph, full, cone, dot, ro);

  const peakLines = new VGroup(
    new DashedLine(graph.ax.c2p(BEST, 0), graph.point(BEST), { dashLength: 0.06, color: TEAL, strokeWidth: 1.5 }),
    new DashedLine(graph.ax.c2p(0, pitch.theta(BEST)), graph.point(BEST), { dashLength: 0.06, color: TEAL, strokeWidth: 1.5 }),
  );
  scene.say(LINES[0], () => {
    scene.play(new Create(peakLines), { runTime: 1.2 });
    scene.play(new Indicate(dot, { color: TEAL, scaleFactor: 1.6 }), new Indicate(ro, { color: TEAL, scaleFactor: 1.08 }), { runTime: 1.4 });
  });

  const alt = new Pitch({ ...PITCH_KW, posts: [12, 20] });
  const altCurve = new DashedVMobject(graph.ax.plot((v) => alt.theta(v), [0.05, 30, 0.05]), { numDashes: 60 }).setColor(GOLD);
  const altPeak = Math.sqrt(12 * 20);
  const qmark = T('?', { fontSize: 48, color: GOLD }).nextTo(graph.ax.c2p(altPeak, alt.theta(altPeak)), UP, 0.15);
  const ghostMouth = alt.mouth.copy().setStroke(null, null, 0.9);
  const ghostPosts = new VGroup(alt.postA.copy(), alt.postB.copy());
  scene.say(LINES[1], (t) => {
    scene.play(new FadeOut(cone), new FadeOut(peakLines), { runTime: 0.5 });
    scene.play(new TransformFromCopy(pitch.mouth, ghostMouth), new TransformFromCopy(new VGroup(pitch.postA, pitch.postB), ghostPosts),
      new Create(altCurve), { runTime: t.duration * 0.5 });
    scene.play(new FadeIn(qmark, { scale: 1.5 }), { runTime: 0.6 });
  });

  scene.say(LINES[2], (t) => {
    scene.play(new FadeOut(new VGroup(ghostMouth, ghostPosts, altCurve, qmark, graph, full, dot, ro)),
      animate(pitch.grass).setOpacity(0.25), animate(pitch.lines).setStroke(null, null, 0.15),
      animate(pitch.net).setOpacity(0.1), { runTime: 1.2 });
    const P_ = pitch.p(0, BEST);
    const circ = pitch.circleThroughPosts(BEST, BLUE, 4);
    const tri = new VGroup(new Line(P_, pitch.A(), { color: TEAL, strokeWidth: 3 }), new Line(P_, pitch.B(), { color: TEAL, strokeWidth: 3 }),
      wedge(P_, pitch.A(), pitch.B(), { radius: 0.8, opacity: 0.45 }), playerToken(P_));
    scene.play(new FadeIn(tri), { runTime: 0.6 });
    scene.play(new Create(circ), { runTime: t.duration * 0.45 });
    const labs = new VGroup(
      pointLabel('A', pitch.A(), vadd(UP, vmul(LEFT, 0.4)), { color: GOLD, fontSize: 34 }),
      pointLabel('B', pitch.B(), vadd(UP, vmul(RIGHT, 0.4)), { color: GOLD, fontSize: 34 }),
      pointLabel('P', P_, LEFT, { color: INK, fontSize: 34 }).shift(vmul(RIGHT, 0.05)),
    );
    scene.play(new FadeIn(labs), { runTime: 0.6 });
  });
  scene.wait(0.4);
  return { pitch, graph, full, cone, dot, ro, altCurve, qmark, peakLines };
}

// objects for the golden-data check (built fresh, in the same state manim dumped them)
export function goldenObjects() {
  const pitch = new Pitch(PITCH_KW);
  const graph = new AngleGraph(pitch);
  const alt = new Pitch({ ...PITCH_KW, posts: [12, 20] });
  const altPeak = Math.sqrt(12 * 20);
  const P_ = pitch.p(0, BEST);
  return {
    pitch: [pitch], path: [pitch.path], graph: [graph], full: [graph.curve(0.02, 30)],
    cone: [viewCone(pitch, BEST)], dot: [glowDot(graph.point(BEST), TEAL, 0.07)],
    ro: [readout(BEST, pitch.theta(BEST)).moveTo([3.75, 3.25])],
    alt_curve: [new DashedVMobject(graph.ax.plot((v) => alt.theta(v), [0.05, 30, 0.05]), { numDashes: 60 }).setColor(GOLD)],
    qmark: [T('?', { fontSize: 48, color: GOLD }).nextTo(graph.ax.c2p(altPeak, alt.theta(altPeak)), UP, 0.15)],
    peak_lines: [new VGroup(
      new DashedLine(graph.ax.c2p(BEST, 0), graph.point(BEST), { dashLength: 0.06, color: TEAL, strokeWidth: 1.5 }),
      new DashedLine(graph.ax.c2p(0, pitch.theta(BEST)), graph.point(BEST), { dashLength: 0.06, color: TEAL, strokeWidth: 1.5 }),
    )],
    circ: [pitch.circleThroughPosts(BEST, BLUE, 4)],
    labs: [new VGroup(
      pointLabel('A', pitch.A(), vadd(UP, vmul(LEFT, 0.4)), { color: GOLD, fontSize: 34 }),
      pointLabel('B', pitch.B(), vadd(UP, vmul(RIGHT, 0.4)), { color: GOLD, fontSize: 34 }),
      pointLabel('P', P_, LEFT, { color: INK, fontSize: 34 }).shift(vmul(RIGHT, 0.05)),
    )],
    xl: graph.frameParts.get(3), yl: graph.frameParts.get(4).get(1),
  };
}
