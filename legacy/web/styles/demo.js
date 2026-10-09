// One interactive scene (the inscribed angle theorem), three visual themes.
// Only the theme changes between the three demos; the geometry, interaction
// and formula logic below are shared.
import { THEMES } from '../engine/theme.js';
import { loadMathJax, Tex, Text } from '../engine/tex.js';
import { Camera } from '../engine/scene.js';
import { VMobject, VGroup, UP, DOWN, LEFT, RIGHT, UR, DL, vadd, vsub, vmul, vunit } from '../engine/core.js';
import { Arc, Dot, Sector, Line, RoundedRectangle, Square } from '../engine/geometry.js';
import { smooth } from '../engine/animation.js';
import { Interaction } from '../engine/interact.js';

const key = new URLSearchParams(location.search).get('theme') ?? 'paper';
const th = THEMES[key];
document.body.dataset.theme = key;

// ---------------------------------------------------------------- assets
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `https://fonts.googleapis.com/css2?${th.googleFonts}&display=block`;
document.head.appendChild(link);
await new Promise((r) => (link.onload = r));
await Promise.all(['400', '500', '600', '700', '800', '900'].flatMap((w) => [
  document.fonts.load(`${w} 40px '${th.textFont}'`), document.fonts.load(`italic ${w} 40px '${th.textFont}'`),
]));
await loadMathJax({ font: th.mathFont, warmup: ['\\angle APBO = \\tfrac{1}{2} \\times 0123456789.^\\circ'] });

// ---------------------------------------------------------------- helpers
const texCache = new Map();
function tex(parts, fontSize, colors = {}) {
  parts = Array.isArray(parts) ? parts : [parts];
  const k = parts.join('\u0001') + '|' + fontSize;
  if (!texCache.has(k)) texCache.set(k, new Tex(parts, { fontSize, color: th.ink }));
  const m = texCache.get(k).copy();
  for (const [i, c] of Object.entries(colors)) m.get(+i).setFill(c);
  return m;
}
const text = (s, fontSize, o = {}) => new Text(s, { font: th.textFont, fontSize, color: o.color ?? th.ink, weight: o.weight ?? th.textWeight, italic: o.italic, letterSpacing: o.letterSpacing });
const fade = (mob, a) => {
  for (const m of mob.getFamily()) {
    m.fill[3] *= a;
    m.stroke[3] *= a;
  }
  return mob;
};
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const mod360 = (a) => ((a % 360) + 360) % 360;

// ---------------------------------------------------------------- state
const O = [-3.05, -0.2];
const R = 2.6;
const state = { a: 218, b: 322, p: 96 };
const at = (d) => [O[0] + R * Math.cos(rad(d)), O[1] + R * Math.sin(rad(d))];

function measures() {
  const A = at(state.a), B = at(state.b), P = at(state.p);
  const u = vunit(vsub(A, P)), v = vunit(vsub(B, P));
  const inscribed = deg(Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))));
  // the arc AB that P does NOT lie on is the one both angles stand on
  const ccwAB = mod360(state.b - state.a);
  const pOnCcw = mod360(state.p - state.a) < ccwAB;
  const arcStart = pOnCcw ? state.b : state.a;
  const arcSpan = pOnCcw ? 360 - ccwAB : ccwAB;
  return { A, B, P, inscribed, central: arcSpan, arcStart, arcSpan };
}

// ---------------------------------------------------------------- figure (shared)
function wedgeAt(vertex, from, span, radius, color, opacity, width) {
  return new VGroup(
    new Sector({ radius, startAngle: rad(from), angle: rad(span), arcCenter: vertex, fillColor: color, fillOpacity: opacity, strokeWidth: 0 }),
    new Arc({ radius, startAngle: rad(from), angle: rad(span), arcCenter: vertex, color, strokeWidth: width }),
  );
}

function pointMarker(p, name, hot) {
  const s = hot ? 1.45 : 1;
  if (th.pointShape === 'square') {
    return new Square({ sideLength: 0.2 * s, fillColor: th.point, fillOpacity: 1, strokeWidth: 0 }).moveTo(p);
  }
  if (th.pointShape === 'halo') {
    const g = new VGroup(
      new Dot(p, { radius: 0.2 * s, color: th.point, fillOpacity: 0.1, strokeWidth: 0 }),
      new Dot(p, { radius: 0.075 * s, color: th.point, strokeColor: th.point, strokeWidth: 3 }),
    );
    g.get(1).glow = true;
    return g;
  }
  if (th.pointShape === 'ring') {
    const d = new Dot(p, { radius: 0.1 * s, color: th.point, strokeColor: hot ? th.inscribed : th.pointRing, strokeWidth: 2.4 });
    d.shadow = { color: 'rgba(17,17,19,0.22)', blur: 14, offsetY: 3 };
    return new VGroup(d);
  }
  return new VGroup(new Dot(p, { radius: 0.085 * s, color: th.point, strokeColor: th.pointRing, strokeWidth: 3 }));
}

function figure(m, hot, u) {
  const w = th.stroke;
  const g = new VGroup();
  const circle = new Arc({ radius: R, startAngle: rad(state.p + 180), angle: 2 * Math.PI, arcCenter: O, color: th.circle, strokeWidth: w.figure });
  circle.glow = true;
  const drawn = circle.copy().pointwiseBecomePartial(circle, 0, smooth(clamp01(u / 0.45)));
  g.add(drawn);

  const a2 = smooth(clamp01((u - 0.3) / 0.3)), a3 = smooth(clamp01((u - 0.5) / 0.3));
  const arcHi = new Arc({ radius: R, startAngle: rad(m.arcStart), angle: rad(m.arcSpan), arcCenter: O, color: th.chord, strokeWidth: w.chord });
  arcHi.glow = true;
  const chord = new Line(m.A, m.B, { color: th.chord, strokeWidth: w.chord * (key === 'swiss' ? 0.5 : 0.7) });
  g.add(fade(new VGroup(arcHi, chord), a2 * (key === 'swiss' ? 1 : 0.9)));

  const cen = wedgeAt(O, m.arcStart, m.arcSpan, key === 'swiss' ? 1.25 : 0.62, th.central, th.wedgeOpacity, w.accent);
  const radii = new VGroup(new Line(O, m.A, { color: th.central, strokeWidth: w.accent }), new Line(O, m.B, { color: th.central, strokeWidth: w.accent }));
  radii.getFamily().forEach((x) => (x.glow = true));
  const pa = vsub(m.A, m.P), pb = vsub(m.B, m.P);
  let from = deg(Math.atan2(pa[1], pa[0]));
  let span = mod360(deg(Math.atan2(pb[1], pb[0])) - from);
  if (span > 180) { from = deg(Math.atan2(pb[1], pb[0])); span = 360 - span; }
  const ins = wedgeAt(m.P, from, span, key === 'swiss' ? 1.1 : 0.75, th.inscribed, th.wedgeOpacity, w.accent);
  const chords = new VGroup(new Line(m.P, m.A, { color: th.inscribed, strokeWidth: w.accent }), new Line(m.P, m.B, { color: th.inscribed, strokeWidth: w.accent }));
  chords.getFamily().forEach((x) => (x.glow = true));
  g.add(fade(new VGroup(cen, radii, ins, chords), a3));

  const labels = new VGroup();
  const lab = (name, p, dir, color = th.ink) => tex(name, key === 'swiss' ? 46 : 40, { 0: color }).moveTo(vadd(p, vmul(vunit(dir), 0.42)));
  const mid = rad(m.arcStart + m.arcSpan / 2);
  const oDir = m.arcSpan < 180 ? [-Math.cos(mid), -Math.sin(mid)] : [Math.cos(mid), Math.sin(mid)];
  labels.add(lab('A', m.A, vsub(m.A, O)), lab('B', m.B, vsub(m.B, O)), lab('P', m.P, vsub(m.P, O)));
  labels.add(tex('O', key === 'swiss' ? 40 : 34, { 0: th.muted }).moveTo(vadd(O, vmul(vunit(vadd(oDir, [-0.55, 0])), 0.36))));
  // live angle readouts beside each wedge
  const bis = (v, a0, s, r) => vadd(v, [r * Math.cos(rad(a0 + s / 2)), r * Math.sin(rad(a0 + s / 2))]);
  labels.add(tex(`${m.inscribed.toFixed(1)}^\\circ`, 30, { 0: th.inscribed }).moveTo(bis(m.P, from, span, key === 'swiss' ? 1.55 : 1.2)));
  const cenR = key === 'swiss' ? 1.25 : 0.62;
  const cenLabel = tex(`${m.central.toFixed(1)}^\\circ`, 30, { 0: th.central });
  const inside = key === 'swiss' && 2 * 0.74 * Math.sin(rad(Math.min(m.arcSpan, 180) / 2)) > cenLabel.width + 0.12 && m.arcSpan < 180;
  if (inside) cenLabel.setFill('#FFFFFF').moveTo(bis(O, m.arcStart, m.arcSpan, 0.74));
  else cenLabel.moveTo(bis(O, m.arcStart, m.arcSpan, cenR + 0.45));
  labels.add(cenLabel);
  g.add(fade(labels, a3));

  const pts = new VGroup();
  for (const [name, p] of [['A', m.A], ['B', m.B], ['P', m.P]]) pts.add(pointMarker(p, name, hot === name));
  pts.add(key === 'swiss' ? new Square({ sideLength: 0.14, fillColor: th.ink, fillOpacity: 1, strokeWidth: 0 }).moveTo(O) : new Dot(O, { radius: 0.05, color: th.ink }));
  g.add(fade(pts, clamp01(u / 0.3)));
  return g;
}

// ---------------------------------------------------------------- panels (per theme)
function formulaLines(m, size) {
  const rel = tex(['\\angle APB', '=', '\\tfrac{1}{2}', '\\angle AOB'], size, { 0: th.inscribed, 3: th.central });
  const num = tex([`${m.inscribed.toFixed(1)}^\\circ`, '=', '\\tfrac{1}{2}', '\\times', `${m.central.toFixed(1)}^\\circ`], size, { 0: th.inscribed, 4: th.central });
  return [rel, num];
}

function panelPaper(m) {
  const g = new VGroup();
  const x0 = 0.95;
  const kicker = text('FIG. 1', 20, { color: th.muted, weight: 'MEDIUM', letterSpacing: 0.18 }).moveTo([x0, 2.95], DL).alignTo([x0, 0], LEFT);
  const title = text('The inscribed angle', 46, { italic: true, weight: th.titleWeight }).nextTo(kicker, DOWN, 0.22).alignTo([x0, 0], LEFT);
  const rule = new Line([x0, 0], [6.55, 0], { color: th.ink, strokeWidth: 1.2 }).nextTo(title, DOWN, 0.3).alignTo([x0, 0], LEFT);
  const body = new VGroup(
    text('An angle at the circle is always', 25, { color: th.muted }),
    text('half the angle at the centre.', 25, { color: th.muted }),
  ).arrange(DOWN, 0.16, { alignedEdge: LEFT }).nextTo(rule, DOWN, 0.34).alignTo([x0, 0], LEFT);
  const [rel, num] = formulaLines(m, 50);
  rel.nextTo(body, DOWN, 0.6).alignTo([x0 + 0.02, 0], LEFT);
  num.nextTo(rel, DOWN, 0.34).alignTo([x0 + 0.02, 0], LEFT);
  const rule2 = new Line([x0, 0], [6.55, 0], { color: th.faint, strokeWidth: 1 }).nextTo(num, DOWN, 0.5).alignTo([x0, 0], LEFT);
  const note = text('Drag P — the angle holds. Drag A or B to change it.', 21, { italic: true, color: th.muted }).nextTo(rule2, DOWN, 0.24).alignTo([x0, 0], LEFT);
  g.add(kicker, title, rule, body, rel, num, rule2, note);
  // margin note with a leader line to the arc both angles stand on
  const mid = m.arcStart + m.arcSpan / 2;
  const onArc = at(mid);
  const out = vadd(O, vmul([Math.cos(rad(mid)), Math.sin(rad(mid))], R + 0.55));
  const lbl = text('the arc both angles stand on', 19, { italic: true, color: th.chord });
  lbl.moveTo(vadd(out, [Math.cos(rad(mid)) >= 0 ? lbl.width / 2 + 0.08 : -lbl.width / 2 - 0.08, Math.sin(rad(mid)) >= 0 ? 0.12 : -0.12]));
  g.add(new Line(onArc, out, { color: th.chord, strokeWidth: 1.2 }), lbl);
  return g;
}

function panelGlass(m) {
  const g = new VGroup();
  const [rel, num] = formulaLines(m, 46);
  const title = text('Inscribed angle theorem', 34, { weight: th.titleWeight });
  const sub = new VGroup(text('The angle at the circle is', 21, { color: th.muted }), text('half the angle at the centre.', 21, { color: th.muted })).arrange(DOWN, 0.12, { alignedEdge: LEFT });
  const chip = (s, c) => {
    const t = text(s, 18, { color: c, weight: 'MEDIUM', letterSpacing: 0.06 });
    const box = new RoundedRectangle({ width: t.width + 0.34, height: t.height + 0.2, cornerRadius: (t.height + 0.2) / 2, fillColor: c, fillOpacity: 0.12, strokeColor: c, strokeWidth: 1.2, strokeOpacity: 0.5 }).moveTo(t);
    return new VGroup(box, t);
  };
  const chips = new VGroup(chip('INSCRIBED  ∠APB', th.inscribed), chip('CENTRAL  ∠AOB', th.central)).arrange(RIGHT, 0.18);
  const hint = text('Drag  P · A · B', 20, { color: th.muted, letterSpacing: 0.04 });
  const col = new VGroup(title, sub, chips, rel, num, hint).arrange(DOWN, 0.34, { alignedEdge: LEFT });
  rel.shift([0, -0.12]);
  num.shift([0, -0.12]);
  hint.shift([0, -0.2]);
  col.moveTo([3.6, 0.05]);
  const card = new RoundedRectangle({ width: col.width + 0.9, height: col.height + 0.95, cornerRadius: th.panel.radius, fillColor: '#FFFFFF', fillOpacity: 0.055, strokeColor: '#FFFFFF', strokeWidth: 1.4, strokeOpacity: 0.14 }).moveTo(col);
  card.shadow = { color: th.panel.shadow, blur: 60, offsetY: 18 };
  g.add(card, col);
  return g;
}

function panelSwiss(m) {
  const g = new VGroup();
  const x0 = 0.75;
  g.add(new Line([x0 - 0.3, 3.55], [x0 - 0.3, -3.55], { color: th.rules, strokeWidth: 2 }));
  const num = text('01', 30, { weight: 'HEAVY' }).moveTo([x0, 3.2], DL).alignTo([x0, 0], LEFT);
  const title = text('INSCRIBED ANGLE', 30, { weight: 'HEAVY', letterSpacing: 0.04 }).nextTo(num, RIGHT, 0.35);
  const bar = new Line([x0, 2.72], [6.7, 2.72], { color: th.rules, strokeWidth: 6 });
  const big1 = text(`${m.inscribed.toFixed(1)}°`, 132, { weight: 'BLACK', color: th.inscribed, letterSpacing: -0.03 }).moveTo([x0, 2.45], UR).alignTo([x0, 0], LEFT).alignTo([0, 2.45], UP);
  const cap1 = text('∠APB  AT THE CIRCLE', 20, { weight: 'BOLD', letterSpacing: 0.08 }).nextTo(big1, DOWN, 0.18).alignTo([x0, 0], LEFT);
  const big2 = text(`${m.central.toFixed(1)}°`, 132, { weight: 'BLACK', color: th.central, letterSpacing: -0.03 }).nextTo(cap1, DOWN, 0.42).alignTo([x0, 0], LEFT);
  const cap2 = text('∠AOB  AT THE CENTRE', 20, { weight: 'BOLD', letterSpacing: 0.08 }).nextTo(big2, DOWN, 0.18).alignTo([x0, 0], LEFT);
  const bar2 = new Line([x0, 0], [6.7, 0], { color: th.rules, strokeWidth: 2 }).nextTo(cap2, DOWN, 0.4).alignTo([x0, 0], LEFT);
  const [rel] = formulaLines(m, 46);
  rel.nextTo(bar2, DOWN, 0.35).alignTo([x0, 0], LEFT);
  const hint = text('DRAG P, A, B', 18, { weight: 'BOLD', color: th.muted, letterSpacing: 0.1 }).moveTo([x0, -3.45], DL).alignTo([x0, 0], LEFT);
  g.add(num, title, bar, big1, cap1, big2, cap2, bar2, rel, hint);
  return g;
}

function panelWhite(m) {
  const g = new VGroup();
  const kicker = text('THEOREM  ·  01', 17, { color: th.muted, weight: 'MEDIUM', letterSpacing: 0.16 });
  const title = text('Inscribed angle', 42, { weight: th.titleWeight, letterSpacing: -0.02 });
  const desc = text('At the circle, half the angle at the centre.', 22, { color: th.muted });
  const [rel] = formulaLines(m, 44);
  // ratio bars on one scale: the blue bar is always exactly half the black one
  const L = 2.5, H = 0.1, unit = L / 360;
  const labs = [tex('\\angle APB', 28, { 0: th.inscribed }), tex('\\angle AOB', 28, { 0: th.central })];
  const labW = Math.max(...labs.map((l) => l.width));
  const bar = (lab, value, color, y) => {
    lab.moveTo([0, y], LEFT);
    const track = new RoundedRectangle({ width: L, height: H, cornerRadius: H / 2, fillColor: th.faint, fillOpacity: 1, strokeWidth: 0 });
    track.moveTo([labW + 0.3, y], LEFT);
    const fill = new RoundedRectangle({ width: Math.max(H, value * unit), height: H, cornerRadius: H / 2, fillColor: color, fillOpacity: 1, strokeWidth: 0 });
    fill.moveTo(track, LEFT);
    const val = tex(`${value.toFixed(1)}^\\circ`, 28, { 0: color }).moveTo([labW + 0.3 + L + 0.3, y], LEFT);
    return new VGroup(lab, track, fill, val);
  };
  const bars = new VGroup(bar(labs[0], m.inscribed, th.inscribed, 0), bar(labs[1], m.central, th.central, -0.5));
  const hint = text('Drag P, A or B', 19, { color: th.muted });
  const col = new VGroup(kicker, title, desc, rel, bars, hint).arrange(DOWN, 0.3, { alignedEdge: LEFT });
  title.shift([0, 0.06]);
  rel.shift([0, -0.18]);
  bars.shift([0, -0.3]);
  hint.shift([0, -0.36]);
  col.moveTo([3.45, 0.02]);
  const card = new RoundedRectangle({ width: col.width + 0.9, height: col.height + 1.0, cornerRadius: th.panel.radius, fillColor: th.panel.fill, fillOpacity: 1, strokeColor: th.panel.stroke, strokeWidth: 1.4 }).moveTo(col);
  card.shadow = { color: th.panel.shadow, blur: 70, offsetY: 22 };
  g.add(card, col);
  return g;
}

const PANELS = { paper: panelPaper, glass: panelGlass, swiss: panelSwiss, white: panelWhite };

// ---------------------------------------------------------------- run
const canvas = document.getElementById('c');
const cam = new Camera(canvas, { theme: th });
const ui = new Interaction(canvas, { onChange: () => request() });
const clampAway = (name, d) => {
  const others = ['a', 'b', 'p'].filter((k) => k !== name).map((k) => state[k]);
  for (const o of others) {
    const diff = mod360(d - o + 180) - 180;
    if (Math.abs(diff) < 9) d = o + Math.sign(diff || 1) * 9;
  }
  return mod360(d);
};
for (const [name, k] of [['P', 'p'], ['A', 'a'], ['B', 'b']]) {
  ui.addHandle({
    name,
    get: () => at(state[k]),
    set: (q) => { state[k] = clampAway(k, deg(Math.atan2(q[1] - O[1], q[0] - O[0]))); },
    radius: 0.42,
  });
}

let t0 = performance.now();
let pending = false;
function request() {
  if (!pending) {
    pending = true;
    requestAnimationFrame(frame);
  }
}
function frame() {
  pending = false;
  const u = Math.min(1, (performance.now() - t0) / 1900);
  draw(u);
  if (u < 1) request();
}
function draw(u) {
  const m = measures();
  const hot = (ui.active ?? ui.hot)?.name;
  const panel = fade(PANELS[key](m), smooth(clamp01((u - 0.45) / 0.5)));
  panel.shift([0, -0.15 * (1 - smooth(clamp01((u - 0.45) / 0.5)))]);
  const scene = new VGroup(figure(m, hot, u), panel);
  cam.render(scene.familyWithPoints());
}
// test hooks: render a given intro progress / set the draggable angles directly
window.renderAt = (u, st) => { Object.assign(state, st ?? {}); const t = performance.now(); draw(u); return performance.now() - t; };
document.getElementById('replay')?.addEventListener('click', () => { t0 = performance.now(); request(); });
request();
window.demoReady = true;
