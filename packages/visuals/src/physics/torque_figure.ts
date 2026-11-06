// Torque in 3D (the physics stress test, docs/design/PHYSICS-STRESS.md): a rigid lever about a pivot, a force acting
// at a point of it, the arm r from the pivot to that point, and the torque τ = r × F drawn from the pivot along the
// axis it would turn the lever about, with the right-hand rule's curl around it and the parallelogram of r and F
// (its area is |τ|). The learner turns the view, drags the force's tip (in the plane of the screen) and slides the
// point where it acts along the lever. All of it is the engine's minimal View3D: a solid bar shaded by one light, and
// lines cut in pieces so the axis passes behind and in front of the bar where it should. The vectors are torque.ts.
import {
  Figure, View3D, beat, column, derive, handle3d, orbit, over, reveal, row, set, t, type P3,
} from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../mpc/kit';
import * as TQ from './torque';

export interface TorqueParams extends Record<string, unknown> {
  force: number[];
  at: number;
  lang: string;
}

const DEG = Math.PI / 180;
/** Drawn length of 1 N·m of torque (m). */
const K = 0.7;

export function torque_figure(p: TorqueParams): Figure {
  const lang = figure_lang(p.lang);
  const fig = new Figure({ lang });
  const F0 = TQ.clamp_force([p.force[0] ?? 0.3, p.force[1] ?? 1.1, p.force[2] ?? 0.9]);

  // ---- state: the camera, where the force acts, the force
  const phi = fig.param('phi', 62 * DEG, { range: [8 * DEG, 172 * DEG], tutor: true, says: t('the view from above', '俯视角') });
  const theta = fig.param('theta', -62 * DEG, { range: [-Math.PI, Math.PI], tutor: true, says: t('the view around', '环视角') });
  const s = fig.param('s', Math.min(TQ.S_RANGE[1], Math.max(TQ.S_RANGE[0], p.at)), { range: TQ.S_RANGE, doc: 'where the force acts, along the lever (m)', says: t('where the force acts', '力的作用点') });
  const fx = fig.param('fx', F0[0], { range: [-2, 2], doc: 'force x (N)' }), fy = fig.param('fy', F0[1], { range: [-2, 2], doc: 'force y (N)' }), fz = fig.param('fz', F0[2], { range: [-2, 2], doc: 'force z (N)' });
  const r = derive((): TQ.V3 => [s.value, 0, 0], 'r');
  const F = derive((): TQ.V3 => [fx.value, fy.value, fz.value], 'F');
  const tau = derive(() => TQ.torque(r.value, F.value), 'tau');
  const tip = () => TQ.scale(tau.value, K);
  // (the script brings them in one by one)
  const show_r = fig.param('show_r', 0, { range: [0, 1] }), show_F = fig.param('show_F', 0, { range: [0, 1] }), show_tau = fig.param('show_tau', 0, { range: [0, 1] });

  // ---- the scene
  const view = fig.plot({ id: 'view', x: [-2.6, 2.6], y: [-2, 2], aspect: 'equal', fill: true, phone_aspect: 1, axes: 'none', grid: false, priority: 2, says: t('a lever about a pivot, in 3D', '绕支点转动的杠杆（三维）') });
  const v = view.add(new View3D({ phi, theta }, { id: 'scene3d', size: 1.6, radius: 2, center: [0, 0], target: [1, 0, 0.25], obstacles: true, says: t('the lever, the force and the torque', '杠杆、力和力矩') }));
  // a floor far below, so the eye has somewhere to stand when the view turns
  const FL = -1.2;
  for (let k = 0; k <= 6; k++) v.line([k * 0.5 - 0.5, -1, FL], [k * 0.5 - 0.5, 1, FL], { role: 'scaffold', style: { alpha: 0.3 } });
  for (let k = 0; k <= 4; k++) v.line([-0.5, k * 0.5 - 1, FL], [2.5, k * 0.5 - 1, FL], { role: 'scaffold', style: { alpha: 0.3 } });
  v.bar([TQ.LEVER[0], 0, 0], [TQ.LEVER[1], 0, 0], { half: [0.11, 0.07], segments: 14, role: 'region:lever' });
  v.dots([[0, 0, 0]], { role: 'noun:lever', r: 5.5, bias: 0.4 });
  // the axis τ turns the lever about: through the pivot, cut in pieces so the bar hides the part behind it
  const axis = () => TQ.unit(tau.value);
  const has_tau = () => TQ.norm(tau.value) > 1e-6;
  v.line(() => (has_tau() ? TQ.scale(axis(), -2.2) : [0, 0, 0]), () => (has_tau() ? TQ.scale(axis(), 2.6) : [0, 0, 0]), { role: 'scaffold', pieces: 36, style: { dash: [6, 5] }, show: show_tau });
  // the parallelogram of r and F: its area is |τ|, and τ stands square on it
  v.face(() => [[0, 0, 0], r.value, TQ.add(r.value, F.value), F.value], { role: 'region:torque', style: { fill_alpha: 0.08, alpha: 0.35 }, show: show_tau });
  const lift: P3 = [0, 0, 0.095];
  v.arrow(lift, () => TQ.add(r.value, lift), { role: 'noun:lever-arm', pieces: 10, show: show_r, bias: 0.3 });
  v.arrow(() => r.value, () => TQ.add(r.value, F.value), { role: 'noun:force', pieces: 10, style: { width: 3 }, show: show_F });
  v.arrow([0, 0, 0], tip, { role: 'noun:torque', pieces: 14, style: { width: 3 }, show: show_tau });
  // the right hand: fingers curling the way the lever would turn, around the thumb τ
  const curl = () => (has_tau() ? TQ.curl(tau.value, TQ.scale(tip(), 0.62), 0.3, r.value, 1.55 * Math.PI) : []);
  v.polyline(() => curl().slice(0, -5), { role: 'noun:torque', show: show_tau });
  v.arrow(() => curl()[curl().length - 7] ?? [0, 0, 0], () => curl()[curl().length - 1] ?? [0, 0, 0], { role: 'noun:torque', pieces: 2, show: show_tau });

  // ---- words on the 3D points
  // (a word only where its point is on the picture: an arrow running off the edge loses its word, not its place)
  const on_view = (q: P3): [number, number] | null => {
    const at = v.px(q), d = view.data;
    return at[0] >= d.x && at[0] <= d.x + d.w && at[1] >= d.y && at[1] <= d.y + d.h ? at : null;
  };
  const r_word = fig.label('\\vec r', () => on_view(TQ.add(TQ.scale(r.value, 0.5), [0, 0, 0.12])), { id: 'r_word', tex: true, role: 'noun:lever-arm', sides: ['above', 'above-left', 'above-right', 'below'], within: () => view.data });
  const F_word = fig.label('\\vec F', () => on_view(TQ.add(r.value, F.value)), { id: 'F_word', tex: true, role: 'noun:force', gap: 16, within: () => view.data });
  const tau_word = fig.label('\\vec\\tau', () => (has_tau() ? on_view(tip()) : null), { id: 'tau_word', tex: true, role: 'noun:torque', gap: 10, within: () => view.data });

  // ---- the hands: turn the view, drag the force's tip, slide where it acts
  orbit(fig, view, v, { says: t('turn the view', '转动视角') });
  handle3d(fig, view, v, {
    id: 'force_tip', says: t('the force: its tip', '力：它的箭头'), params: [fx, fy],
    get: () => TQ.add(r.value, F.value),
    put: (q) => {
      const f = TQ.clamp_force(TQ.sub(q, r.peek()));
      fx.set(f[0]);
      fy.set(f[1]);
      fz.set(f[2]);
    },
  });
  handle3d(fig, view, v, { id: 'force_point', says: t('where the force acts', '力的作用点'), params: [s, null], get: () => r.value, put: (q) => s.set(q[0]), along: () => [1, 0, 0] });

  // ---- the numbers
  // (live numbers are value parts: tabular digits in a reserved width, drawn in a fraction of a millisecond; a number
  // inside TeX is typeset again by MathJax every time it changes, 1.5-3 ms a readout a frame)
  const v2 = (f: () => number, template = '−0.00') => ({ value: f, decimals: 2, template });
  const r_line = fig.readout([{ tex: '\\vec r = (' }, v2(() => s.value, '0.00'), { tex: ',\\,0,\\,0)\\ \\mathrm{m}' }], { id: 'r_value', role: 'noun:lever-arm', kind: 'caption' });
  const F_line = fig.readout([{ tex: '\\vec F = (' }, v2(() => fx.value), { tex: ',' }, v2(() => fy.value), { tex: ',' }, v2(() => fz.value), { tex: ')\\ \\mathrm{N}' }], { id: 'F_value', role: 'noun:force', kind: 'caption' });
  const tau_def = fig.readout([{ tex: '\\vec\\tau = \\vec r\\times\\vec F' }], { id: 'tau_def', role: 'noun:torque', kind: 'caption' });
  const tau_line = fig.readout([{ tex: '= (' }, v2(() => tau.value[0]), { tex: ',' }, v2(() => tau.value[1]), { tex: ',' }, v2(() => tau.value[2]), { tex: ')\\ \\mathrm{N\\,m}' }], { id: 'tau_value', role: 'noun:torque', kind: 'caption', says: t('the torque', '力矩') });
  const size_def = fig.readout([{ tex: '|\\vec\\tau| = |\\vec r|\\,|\\vec F|\\sin\\theta' }], { id: 'tau_size_def', kind: 'caption' });
  const size_line = fig.readout([
    { tex: '=' }, v2(() => TQ.norm(r.value), '0.00'), { tex: '\\times' }, v2(() => TQ.norm(F.value), '0.00'),
    { tex: '\\times\\sin' }, { value: () => TQ.angle(r.value, F.value) / DEG, decimals: 0, template: '000' }, { tex: '^\\circ =' }, v2(() => TQ.norm(tau.value), '0.00'),
  ], { id: 'tau_size', kind: 'caption', says: t('the size of the torque', '力矩的大小') });
  const numbers = [r_line, F_line, column([tau_def, tau_line], { gap: 0 }), column([size_def, size_line], { gap: 0 })];
  fig.layout(row([view, column(numbers, { gap: 10 })], { weights: [1.6, 1], gap: 20 }), { phone: column([view, ...numbers], { gap: 6 }) });

  // ---- checks: what is drawn is r × F
  fig.check('the drawn τ is r × F (perpendicular to both, |r||F| sin θ long, right-handed)', () => {
    const drawn = TQ.scale(tip(), 1 / K), bad = TQ.check_torque(r.peek(), F.peek(), drawn, 1e-9);
    if (bad) return bad;
    // and on the screen: the arrow's tip is where the cross product projects
    const want = v.px(TQ.scale(TQ.cross(r.peek(), F.peek()), K)), got = v.px(tip());
    return Math.hypot(want[0] - got[0], want[1] - got[1]) < 1e-6 ? null : 'the arrow is not where r × F projects';
  });
  fig.report_with(() => ({ r: r.peek(), F: F.peek(), tau: tau.peek(), size: TQ.norm(tau.peek()), angle_deg: TQ.angle(r.peek(), F.peek()) / DEG }));

  // ---- the script: the lever, r, F, then τ; then the view turns a little to show it is space
  fig.script(
    over(0.6, reveal(view, v)),
    set(show_r, 1, 'reveal', 0.7), over(0.3, reveal(r_word, r_line)),
    beat(),
    set(show_F, 1, 'reveal', 0.7), over(0.3, reveal(F_word, F_line)),
    beat(),
    set(show_tau, 1, 'reveal', 0.8), over(0.3, reveal(tau_word, tau_def, tau_line, size_def, size_line)),
    set(theta, -62 * DEG + 0.55, 'travel', 2.2),
  );
  return fig;
}

export const phys_torque = define_figure<TorqueParams>({
  name: 'phys_torque',
  summary: 'Torque in 3D: a lever about a pivot, a force at a point of it, r from the pivot, and τ = r × F from the pivot along the axis it turns about, with the right-hand curl and the parallelogram of r and F (area |τ|). The learner turns the view, drags the force’s tip and slides where it acts.',
  topics: ['torque', 'cross product', 'right-hand rule', 'lever', 'moment of a force', 'rotation'],
  params: {
    force: { type: 'vector', length: 3, min: -2, max: 2, default: [0.3, 1.1, 0.9], doc: 'the force F (N) to start with [x, y, z]; its size is kept between 0.4 and 2' },
    at: { type: 'number', min: 0.4, max: 2.4, default: 1.6, doc: 'where the force acts, along the lever from the pivot (m)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { force: [0, 0, 1.5], at: 2.2 }, { force: [1.5, 0.2, 0], at: 1 }, { force: [-0.5, -1.2, 0.6], lang: 'zh' }],
  ids: ['view', 'scene3d', 'r_word', 'F_word', 'tau_word', 'tau_value', 'tau_size'],
  figure: torque_figure,
  explore: () => {},
});
