// A pendulum, integrated: θ'' = −(g/L) sin θ − c θ' beside its small-angle model θ'' = −(g/L) θ − c θ', released from
// rest at the same angle. Both are integrated together, one state [θ, θₛ, ω, ωₛ], by the engine's Sim (velocity
// Verlet, 240 steps a second). The exact period of the real one, from the arithmetic-geometric mean, is what the
// simulation is checked against. A 1 kg bob on a 1 m rod: energies in joules.
import type { SimSpec } from '@mathnim/engine';

export const G = 9.81;
export const L = 1;
/** The step: 240 a second, so every frame of a 60 fps timeline is a whole number of steps. */
export const DT = 1 / 240;
/** The small-angle period 2π√(L/g) (s). */
export const T0 = 2 * Math.PI * Math.sqrt(L / G);

export interface Inputs { th0: number; damping: number }

/** The arithmetic-geometric mean. */
export function agm(a: number, b: number): number {
  for (let k = 0; k < 40 && Math.abs(a - b) > 1e-15 * a; k++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return a;
}
/** The exact period of an undamped pendulum released from rest at θ₀: T = T₀ / agm(1, cos(θ₀/2)). */
export function period(th0: number): number {
  return T0 / agm(1, Math.cos(Math.abs(th0) / 2));
}
/** Energy per kg of the real pendulum: ½ L²ω² + gL(1 − cos θ). */
export const kinetic = (w: number): number => 0.5 * L * L * w * w;
export const potential = (th: number): number => G * L * (1 - Math.cos(th));
/** Energy per kg of the small-angle model (its potential is the parabola ½ gL θ²). */
export const potential_small = (th: number): number => 0.5 * G * L * th * th;

/** The system for the engine's Sim: [θ, θₛ] and [ω, ωₛ]. */
export const pendulum_spec = (inputs: () => Inputs): SimSpec<Inputs> => ({
  id: 'pendulum',
  inputs,
  start: (i) => [i.th0, i.th0, 0, 0],
  accel: (q, v, _t, i, a) => {
    a[0] = -(G / L) * Math.sin(q[0]) - i.damping * v[0];
    a[1] = -(G / L) * q[1] - i.damping * v[1];
  },
  method: 'verlet',
  dt: DT,
  max_t: 3600,
});

/**
 * The period measured from samples of θ(t): the mean time between its last few upward crossings of zero (interpolated
 * linearly between samples). null with fewer than two crossings.
 */
export function measured_period(ts: number[], th: number[], last = 4): number | null {
  const up: number[] = [];
  for (let k = 1; k < th.length; k++) if (th[k - 1] < 0 && th[k] >= 0) up.push(ts[k - 1] + ((ts[k] - ts[k - 1]) * -th[k - 1]) / (th[k] - th[k - 1]));
  if (up.length < 2) return null;
  const u = up.slice(-Math.min(up.length, last + 1));
  return (u[u.length - 1] - u[0]) / (u.length - 1);
}
