// Point charges you can drag (the physics stress test, docs/design/PHYSICS-STRESS.md): the potential as a tint (red
// where it is positive, blue where negative, two GPU fields) with its equipotentials, the electric field as a grid of
// arrows (the engine's VectorField) and as field lines traced with RK4 (the engine's streamline), as many from each
// charge as its size. Everything follows a charge while it is dragged. The physics is electro.ts (tested).
import {
  Drawn, Field, Figure, Path, VectorField, beat, column, derive, over, reveal, set, t, type FieldKind, type XY,
} from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../mpc/kit';
import * as EL from './electro';

export interface ChargesParams extends Record<string, unknown> {
  config: string;
  show: string;
  equipotentials: boolean;
  lang: string;
}

/** V = Σ q / √(r² + s²) times a sign (the negative tint shades −V), for up to three charges: u = [x, y, q] × 3, s, sign. */
const coulomb = (sign: 1 | -1, cs: () => readonly EL.Charge[]): FieldKind => ({
  name: 'coulomb',
  glsl: 'float v = 0.0; for (int k = 0; k < 3; k++) { vec2 d = p - vec2(u(3 * k), u(3 * k + 1)); v += u(3 * k + 2) / sqrt(dot(d, d) + u(9) * u(9)); } return u(10) * v;',
  wgsl: 'var v = 0.0; for (var k = 0; k < 3; k++) { let d = p - vec2f(uu(3 * k), uu(3 * k + 1)); v += uu(3 * k + 2) / sqrt(dot(d, d) + uu(9) * uu(9)); } return uu(10) * v;',
  cpu: (x, y, u) => {
    let v = 0;
    for (let k = 0; k < 3; k++) {
      const dx = x - u[3 * k], dy = y - u[3 * k + 1];
      v += u[3 * k + 2] / Math.sqrt(dx * dx + dy * dy + u[9] * u[9]);
    }
    return u[10] * v;
  },
  uniforms: () => {
    const u = new Array<number>(11).fill(0);
    cs().slice(0, 3).forEach((c, k) => u.splice(3 * k, 3, c.x, c.y, c.q));
    u[9] = EL.SOFT;
    u[10] = sign;
    return u;
  },
});

/** "+2q", "−q". */
const qname = (q: number) => `${q > 0 ? '+' : '−'}${Math.abs(q) === 1 ? '' : Math.abs(q)}q`;
/** Charges stay this far apart (a charge dragged onto another is pushed off it). */
const APART = 0.4;
const RANGE_X: [number, number] = [-2.7, 2.7], RANGE_Y: [number, number] = [-1.8, 1.8];

export function charges_figure(p: ChargesParams): Figure {
  const lang = figure_lang(p.lang);
  const fig = new Figure({ lang });
  const preset = EL.PRESETS[p.config] ?? EL.PRESETS.dipole;
  const lines_on = p.show !== 'arrows', arrows_on = p.show !== 'lines';

  // ---- state: where each charge is (its sign and size are the preset's)
  const cx = preset.map((c, k) => fig.param(`x${k + 1}`, c.x, { range: RANGE_X, doc: `charge ${k + 1}: x` }));
  const cy = preset.map((c, k) => fig.param(`y${k + 1}`, c.y, { range: RANGE_Y, doc: `charge ${k + 1}: y` }));
  const CS = derive((): EL.Charge[] => preset.map((c, k) => ({ x: cx[k].value, y: cy[k].value, q: c.q })), 'the charges');
  const LINES = derive(() => (lines_on ? EL.field_lines(CS.value) : []), 'the field lines');
  const grow = fig.param('grow', 0, { range: [0, 1], doc: 'how much of each line is drawn (the script draws them on)' });

  // ---- the plane
  const space = fig.plot({ id: 'space', x: [-3, 3], y: [-2, 2], aspect: 'equal', fill: true, phone_aspect: 1, axes: 'none', grid: false, priority: 2, says: t('a plane through the charges', '过这些电荷的一个平面') });
  const levels = p.equipotentials ? EL.LEVELS : [];
  const pos = space.add(new Field(coulomb(1, () => CS.value), { id: 'potential_pos', role: 'region:positive', levels, range: [0, 3], low_deep: false, fill: 0.22, line: 0.3, says: t('the potential where it is positive, and its equipotentials', '电势为正的区域和它的等势线') }));
  const neg = space.add(new Field(coulomb(-1, () => CS.value), { id: 'potential_neg', role: 'region:negative', levels, range: [0, 3], low_deep: false, fill: 0.22, line: 0.3, says: t('the potential where it is negative, and its equipotentials', '电势为负的区域和它的等势线') }));
  // (no arrow on top of a charge: the field there has no one direction worth drawing)
  const near = (x: number, y: number) => CS.value.some((c) => Math.hypot(x - c.x, y - c.y) < 0.22);
  const arrows = arrows_on ? space.add(new VectorField((x, y) => (near(x, y) ? null : EL.field(CS.value, x, y)), { id: 'field_arrows', role: 'noun:field', spacing: lines_on ? 40 : 32, style: lines_on ? { alpha: 0.42 } : undefined, says: t('the electric field at points of a grid', '网格上各点的电场') })) : null;
  const lines = space.add(new Path(() => LINES.value.map((l) => l.pts), { id: 'field_lines', role: 'noun:field', upto: grow, width: 1.6, says: t('field lines: as many from a charge as its size', '电场线：从电荷出发的条数与电量成正比') }));
  // (each line's arrowhead: halfway along it, or a little out from its charge on a line that runs off the page)
  const heads = space.add(new Path(() => (grow.value < 1 ? [] : LINES.value.map(head_piece)), { id: 'field_heads', role: 'noun:field', width: 1.6, heads: [1] }));
  const charges = space.add(new Drawn((env, P) => {
    const g = env.g, pal = env.look.palette;
    let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
    CS.value.forEach((c, k) => {
      const [x, y] = P.P([c.x, c.y]), r = 11 + 4 * Math.abs(c.q), col = c.q > 0 ? pal.vermilion : pal.cobalt;
      const h = fig.handles[k], live = h ? h.opacity.value : 0, state = h ? h.state.value : 0;
      // where the hand can take it: a glass ring, brighter under the pointer, wider when held
      if (live > 0) {
        g.beginPath();
        g.arc(x, y, r + 6 + (state === 2 ? 3 : 0), 0, Math.PI * 2);
        g.fillStyle = `rgba(255,255,255,${0.55 + 0.25 * live})`;
        g.fill();
        g.lineWidth = state ? 1.5 : 1;
        g.strokeStyle = `rgba(17,17,19,${state ? 0.45 : 0.22})`;
        g.stroke();
      }
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = col;
      g.fill();
      // the sign, drawn (not set in type): a bar, and a cross bar for +
      g.strokeStyle = pal.bg;
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - r * 0.45, y);
      g.lineTo(x + r * 0.45, y);
      if (c.q > 0) {
        g.moveTo(x, y - r * 0.45);
        g.lineTo(x, y + r * 0.45);
      }
      g.stroke();
      const b = { x0: x - r - 9, y0: y - r - 9, x1: x + r + 9, y1: y + r + 9 };
      box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) } : b;
    });
    const b = box as { x0: number; y0: number; x1: number; y1: number } | null;
    return b ? { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 } : null;
  }, { id: 'charges', role: 'noun:positive', z: 4, says: t('the charges: red positive, blue negative, larger is more charge', '电荷：红色为正，蓝色为负，越大电量越多') }));
  // each charge's size, by it
  const words = preset.map((c, k) => fig.label(`${c.q > 0 ? '+' : '-'}${Math.abs(c.q) === 1 ? '' : Math.abs(c.q)}q`, () => space.P([cx[k].value, cy[k].value]), {
    id: `charge_word_${k + 1}`, tex: true, role: c.q > 0 ? 'noun:positive' : 'noun:negative', sides: ['above-right', 'below-right', 'above-left', 'below-left'], gap: 14 + 4 * Math.abs(c.q), within: () => space.data,
  }));
  // the hands: one per charge (the charge is its own handle; the glass ring shows where the hand can take it)
  preset.forEach((c, k) => fig.handle(space, cx[k], cy[k], {
    id: `charge_${k + 1}`, says: t(`charge ${k + 1} (${qname(c.q)})`, `电荷 ${k + 1}（${qname(c.q)}）`), look: 'none', r: 18,
    to: (d) => keep_apart(d, k, CS.peek()),
  }));
  const legend = fig.legend([
    ...(lines_on || arrows_on ? [{ role: 'noun:field', text: t('electric field', '电场'), mark: 'line' as const }] : []),
    ...(p.equipotentials ? [{ role: 'noun:positive', text: t('equipotential, V > 0', '等势线，V > 0'), mark: 'line' as const }, { role: 'noun:negative', text: t('equipotential, V < 0', '等势线，V < 0'), mark: 'line' as const }] : []),
  ], { id: 'legend' });
  fig.layout(column([space, legend], { gap: 8 }));

  // ---- checks: lines meet equipotentials square, and each charge has its share of lines
  fig.check('field lines cross equipotentials at right angles (within 2°)', () => {
    const ang = EL.crossing_angles(CS.peek(), EL.field_lines(CS.peek()), [...EL.LEVELS, ...EL.LEVELS.map((v) => -v)]);
    const worst = Math.max(0, ...ang);
    return ang.length && worst > 2 ? `a crossing ${worst.toFixed(2)}° off square (of ${ang.length})` : null;
  });
  fig.check('lines at a charge are proportional to its size (± 1)', () => {
    const cs = CS.peek(), n = EL.line_counts(cs, EL.field_lines(cs));
    const bad = cs.map((c, k) => [k, n[k], EL.share(c.q)] as const).filter(([, got, want]) => Math.abs(got - want) > 1);
    return bad.length ? bad.map(([k, got, want]) => `charge ${k + 1}: ${got} lines, ${want} expected`).join('; ') : null;
  });
  fig.report_with(() => ({ config: p.config, charges: CS.peek().map((c) => [+c.x.toFixed(2), +c.y.toFixed(2), c.q]), lines: EL.line_counts(CS.peek(), LINES.peek()) }));

  // ---- the script: the potential, the arrows, then the lines drawn out of the charges
  fig.script(
    over(0.7, reveal(space, pos, neg, charges, ...words, legend)),
    ...(arrows ? [over(0.6, reveal(arrows))] : []),
    beat(),
    over(0.01, reveal(lines, heads)),
    set(grow, 1, 'draw', 1.4),
  );
  if (!lines_on) grow.set(1, true);
  return fig;
}

/** A short piece of a line ending where its arrowhead goes: halfway, or 0.9 out from its charge on a long line. */
function head_piece(l: EL.Line): XY[] {
  const pts = l.pts;
  let len = 0;
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push((len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])));
  // (the charge it was traced from is at its start, or at its end for a line traced back into a negative charge)
  const d = Math.min(len / 2, 0.9), at = l.dir > 0 ? d : len - d, i = acc.findIndex((a) => a >= at);
  return i <= 0 ? [] : [pts[Math.max(0, i - 2)], pts[i]];
}
/** Where a dragged charge may go: the pointer, pushed off any other charge it would sit on. */
function keep_apart(d: XY, k: number, cs: readonly EL.Charge[]): number[] {
  let [x, y] = d;
  for (let j = 0; j < cs.length; j++) {
    if (j === k) continue;
    const dx = x - cs[j].x, dy = y - cs[j].y, r = Math.hypot(dx, dy);
    if (r < APART) {
      const ux = r > 1e-9 ? dx / r : 1, uy = r > 1e-9 ? dy / r : 0;
      [x, y] = [cs[j].x + ux * APART, cs[j].y + uy * APART];
    }
  }
  return [Math.min(RANGE_X[1], Math.max(RANGE_X[0], x)), Math.min(RANGE_Y[1], Math.max(RANGE_Y[0], y))];
}

export const phys_charges = define_figure<ChargesParams>({
  name: 'phys_charges',
  summary: 'Two or three point charges (signs and sizes from a preset) the learner drags: the potential as a red/blue tint with equipotentials, the electric field as a grid of arrows and as field lines traced with RK4 (as many from a charge as its size), all following the charge.',
  topics: ['electric field', 'field lines', 'electric potential', 'equipotential', 'point charge', 'dipole', 'superposition'],
  params: {
    config: { type: 'enum', values: Object.keys(EL.PRESETS), default: 'dipole', doc: "'dipole' (+q, −q), 'like' (+q, +q), 'unequal' (+2q, −q), 'triple' (+2q, −q, −q)" },
    show: { type: 'enum', values: ['both', 'lines', 'arrows'], default: 'both', doc: 'the field as lines, as a grid of arrows, or both' },
    equipotentials: { type: 'boolean', default: true, doc: 'draw the equipotentials (V = ±0.25, 0.5, 1, 2, 4)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { config: 'like', show: 'lines' }, { config: 'unequal' }, { config: 'triple', show: 'arrows', lang: 'zh' }, { config: 'triple' }],
  ids: ['space', 'potential_pos', 'potential_neg', 'field_lines', 'field_arrows', 'charges', 'legend'],
  figure: charges_figure,
  explore: () => {},
});
