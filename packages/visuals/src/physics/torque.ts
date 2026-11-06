// Torque about a pivot: τ = r × F, with r from the pivot to where the force acts. A lever lies along +x from the
// pivot at the origin; the force acts at a distance s along it. The checks a figure runs on what it draws: τ is
// perpendicular to r and to F, |τ| = |r||F| sin θ, and (r, F, τ) is right-handed.
export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V3): V3 => scale(a, 1 / (norm(a) || 1));
/** The angle between two vectors (rad). */
export const angle = (a: V3, b: V3): number => Math.atan2(norm(cross(a, b)), dot(a, b));

/** The lever: from a little behind the pivot to its end (m), and where a force may act on it. */
export const LEVER: [number, number] = [-0.3, 2.5];
export const S_RANGE: [number, number] = [0.4, 2.4];
/** A force's size (N), kept within these. */
export const F_RANGE: [number, number] = [0.4, 2];

export const torque = (r: V3, F: V3): V3 => cross(r, F);
/** A force with its size kept within F_RANGE (its direction as given). */
export function clamp_force(F: V3): V3 {
  const m = norm(F);
  if (m < 1e-9) return [F_RANGE[0], 0, 0];
  return scale(F, Math.min(F_RANGE[1], Math.max(F_RANGE[0], m)) / m);
}

/**
 * Is `tau` the torque of F at r? null if it is (within tol, relative to |r||F|), else what is wrong: τ ⊥ r, τ ⊥ F,
 * |τ| = |r||F| sin θ, and det[r, F, τ] ≥ 0 (right-handed).
 */
export function check_torque(r: V3, F: V3, tau: V3, tol = 1e-9): string | null {
  const s = norm(r) * norm(F) || 1;
  if (Math.abs(dot(tau, r)) > tol * s * norm(r)) return `τ·r = ${dot(tau, r).toExponential(2)}, not 0`;
  if (Math.abs(dot(tau, F)) > tol * s * norm(F)) return `τ·F = ${dot(tau, F).toExponential(2)}, not 0`;
  const want = norm(r) * norm(F) * Math.sin(angle(r, F));
  if (Math.abs(norm(tau) - want) > tol * s) return `|τ| = ${norm(tau).toFixed(6)}, |r||F| sin θ = ${want.toFixed(6)}`;
  if (dot(cross(r, F), tau) < -tol * s * s) return 'τ points the wrong way (left-handed)';
  return null;
}

/**
 * The right-hand rule's curl: a circle arc around the axis n (through `center`), from the direction `from` (projected
 * off the axis) turning the positive way about n (counter-clockwise seen from n's tip), over `sweep` radians.
 */
export function curl(n: V3, center: V3, radius: number, from: V3, sweep: number, k = 40): V3[] {
  const u = unit(n), e1 = unit(sub(from, scale(u, dot(from, u)))), e2 = cross(u, e1);
  return Array.from({ length: k + 1 }, (_, i) => {
    const a = (sweep * i) / k;
    return add(center, add(scale(e1, radius * Math.cos(a)), scale(e2, radius * Math.sin(a))));
  });
}
