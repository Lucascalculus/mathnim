// The physics stress test's figures (docs/design/PHYSICS-STRESS.md): their physics against what is known exactly, and
// every example linting clean wide and on a phone, in both languages, with its own checks holding.
import { beforeAll, describe, expect, it } from 'vitest';
import { Sim, is_figure, load_tex } from '@mathnim/engine';
import { lint_figure } from '../../engine/node';
import { check_params, get_visual } from '../src';
import '../src/physics';
import * as PD from '../src/physics/pendulum';
import * as EL from '../src/physics/electro';
import * as TQ from '../src/physics/torque';
import { pendulum_checks } from '../src/physics/pendulum_figure';

beforeAll(async () => {
  await load_tex();
});

describe('the pendulum', () => {
  it('has the exact period of the textbooks (small angles: 2π√(L/g); 90°: 1.18034 T₀)', () => {
    expect(PD.period(1e-6)).toBeCloseTo(PD.T0, 9);
    // T(90°) / T₀ = 2 K(1/√2) / π = 1.180340599…
    expect(PD.period(Math.PI / 2) / PD.T0).toBeCloseTo(1.1803405990161, 9);
    expect(PD.agm(1, Math.SQRT1_2)).toBeCloseTo(0.8472130847939, 12);
  });
  it('keeps its energy under 0.1 % over a minute at every release, and its measured period is the exact one', () => {
    for (const deg of [5, 30, 90, 120, 150, 170, 175]) {
      const c = pendulum_checks((deg * Math.PI) / 180, 0);
      expect(c.drift, `${deg}°`).toBeLessThan(1e-3);
      expect(c.drift_small, `${deg}° (model)`).toBeLessThan(1e-3);
      expect(c.replay, `${deg}°`).toBe(true);
      expect(Math.abs(c.period! - c.exact) / c.exact, `${deg}°`).toBeLessThan(1e-3);
    }
  });
  it('loses energy when damped, never gains it', () => {
    const sim = new Sim(PD.pendulum_spec(() => ({ th0: 1.5, damping: 0.4 })));
    const E = sim.series(0, 20, 0.05).map((s) => PD.kinetic(s.y[2]) + PD.potential(s.y[0]));
    for (let k = 1; k < E.length; k++) expect(E[k]).toBeLessThanOrEqual(E[k - 1] + 1e-9);
    expect(E[E.length - 1]).toBeLessThan(E[0] * 0.01);
  });
  it('the small-angle model and the real pendulum agree at 5° and part at 120°', () => {
    const at = (deg: number) => new Sim(PD.pendulum_spec(() => ({ th0: (deg * Math.PI) / 180, damping: 0 }))).at(10);
    const a = at(5), b = at(120);
    expect(Math.abs(a[0] - a[1])).toBeLessThan(0.01 * (5 * Math.PI) / 180 * 10);
    expect(Math.abs(b[0] - b[1])).toBeGreaterThan(0.5);
  });
});

describe('point charges', () => {
  it('E is the gradient of V (the same softening in both)', () => {
    const cs = EL.PRESETS.triple, h = 1e-5;
    for (const [x, y] of [[0.3, 0.2], [-2, 1], [1.7, -0.9]]) {
      const [ex, ey] = EL.field(cs, x, y);
      expect(ex).toBeCloseTo(-(EL.potential(cs, x + h, y) - EL.potential(cs, x - h, y)) / (2 * h), 5);
      expect(ey).toBeCloseTo(-(EL.potential(cs, x, y + h) - EL.potential(cs, x, y - h)) / (2 * h), 5);
    }
  });
  it('lines cross equipotentials square and each charge has its share of lines, in every preset', () => {
    const levels = [...EL.LEVELS, ...EL.LEVELS.map((v) => -v)];
    for (const [name, cs] of Object.entries(EL.PRESETS)) {
      const lines = EL.field_lines(cs);
      const ang = EL.crossing_angles(cs, lines, levels);
      expect(ang.length, name).toBeGreaterThan(20);
      expect(Math.max(...ang), name).toBeLessThan(2);
      const n = EL.line_counts(cs, lines);
      cs.forEach((c, k) => expect(Math.abs(n[k] - EL.share(c.q)), `${name} charge ${k + 1}`).toBeLessThanOrEqual(1));
      // every line ends at a charge or the edge, none in the middle of nowhere
      for (const l of lines) expect(['stop', 'edge'], name).toContain(l.end);
    }
  });
  it('a dipole’s lines from +q end on −q (or leave the window), and the field points along each line', () => {
    const cs = EL.PRESETS.dipole, lines = EL.field_lines(cs);
    const from_pos = lines.filter((l) => l.from === 0);
    expect(from_pos.length).toBe(8);
    // (half of them: the others loop wider than the 8 × 6 window and leave it, as a 3D dipole's lines do)
    expect(from_pos.filter((l) => l.to === 1).length).toBeGreaterThanOrEqual(4);
    expect(from_pos.every((l) => l.to === 1 || l.end === 'edge')).toBe(true);
    for (const l of lines) {
      const a = l.pts[2], b = l.pts[3], e = EL.field(cs, a[0], a[1]);
      expect((b[0] - a[0]) * e[0] + (b[1] - a[1]) * e[1]).toBeGreaterThan(0);
    }
  });
});

describe('torque', () => {
  it('τ = r × F: perpendicular to both, |r||F| sin θ long, right-handed', () => {
    const r: TQ.V3 = [1.6, 0, 0], F: TQ.V3 = [0.3, 1.1, 0.9], tau = TQ.torque(r, F);
    expect(tau).toEqual([0, -1.6 * 0.9, 1.6 * 1.1]);
    expect(TQ.check_torque(r, F, tau)).toBeNull();
    expect(TQ.check_torque(r, F, TQ.scale(tau, -1))).toMatch(/wrong way/);
    expect(TQ.check_torque(r, F, TQ.add(tau, [0.1, 0, 0]))).toMatch(/τ·r/);
    // the curl turns the positive way about τ: from r toward τ × r (where F pushes the lever)
    const c = TQ.curl(tau, [0, 0, 0], 1, r, Math.PI / 2, 10), turn = TQ.cross(c[0], c[1]);
    expect(TQ.dot(turn, tau)).toBeGreaterThan(0);
    expect(TQ.norm(TQ.clamp_force([10, 0, 0]))).toBeCloseTo(TQ.F_RANGE[1], 12);
  });
});

describe('the figures', () => {
  for (const name of ['phys_pendulum', 'phys_charges', 'phys_torque'])
    for (const lang of ['en', 'zh'] as const)
      it(`${name} lints clean at every example (${lang})`, () => {
        const v = get_visual(name)!;
        expect(v.engine).toBe(true);
        for (const ex of v.examples ?? [{}]) {
          const fig = v.scene(check_params(v, { ...(ex as Record<string, unknown>), lang }).params);
          expect(is_figure(fig)).toBe(true);
          if (!is_figure(fig)) continue;
          const errors = lint_figure(fig).filter((i) => i.severity === 'error').map((i) => `[${i.size} @${i.time.toFixed(1)}] ${i.message}`);
          expect(errors, JSON.stringify(ex)).toEqual([]);
        }
      });
});
