// The math of the InfoNCE (in-batch negatives) loss on unit vectors in 2D,
// exactly as derived in lesson A2b (docs/lessons/llm-finetuning/part-a-map-rag.md,
// D-A2-5): L = -log softmax(s/τ)_0 with s_j = q·d_j,
// ∂L/∂d_0 = -(1-w_0)/τ · q,  ∂L/∂d_j = w_j/τ · q (j ≥ 1),  ∂L/∂q = (Σ w_j d_j - d_0)/τ.
// Vectors are kept on the unit circle: gradients are projected on the tangent.

export type V2 = [number, number];
export const unit = (a: number): V2 => [Math.cos(a), Math.sin(a)];
export const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];

/** Softmax weights w_j over the candidates (index 0 = the positive); `active[j] = false` removes a candidate (filtered). */
export function weights(q: V2, docs: V2[], tau: number, active: boolean[] = docs.map(() => true)): number[] {
  const s = docs.map((d, j) => (active[j] ? dot(q, d) / tau : -Infinity));
  const m = Math.max(...s);
  const e = s.map((x) => (Number.isFinite(x) ? Math.exp(x - m) : 0));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / z);
}
/** The loss -log w_0. */
export function loss(q: V2, docs: V2[], tau: number, active?: boolean[]): number {
  return -Math.log(Math.max(1e-300, weights(q, docs, tau, active)[0]));
}
/** Gradient of the loss with respect to every candidate (2D vectors, before projection). */
export function grad_docs(q: V2, docs: V2[], tau: number, active?: boolean[]): V2[] {
  const w = weights(q, docs, tau, active);
  return docs.map((_, j) => {
    const c = j === 0 ? -(1 - w[0]) / tau : w[j] / tau;
    return [c * q[0], c * q[1]];
  });
}
/** Gradient of the loss with respect to the query. */
export function grad_query(q: V2, docs: V2[], tau: number, active?: boolean[]): V2 {
  const w = weights(q, docs, tau, active);
  const g: V2 = [-docs[0][0], -docs[0][1]];
  docs.forEach((d, j) => {
    g[0] += w[j] * d[0];
    g[1] += w[j] * d[1];
  });
  return [g[0] / tau, g[1] / tau];
}
/** d/dθ of the loss for a unit vector at angle θ whose 2D gradient is g: the tangential component. */
export const tangential = (theta: number, g: V2) => -Math.sin(theta) * g[0] + Math.cos(theta) * g[1];

/**
 * Share of the total push on the negatives that negative j receives: w_j / Σ_{k≥1} w_k
 * (the push on d_j is w_j/τ · q, so the shares are the weights renormalised over the negatives).
 */
export function push_shares(q: V2, docs: V2[], tau: number, active?: boolean[]): number[] {
  const w = weights(q, docs, tau, active);
  const neg = w.slice(1).reduce((a, b) => a + b, 0);
  return w.map((x, j) => (j === 0 || neg <= 0 ? 0 : x / neg));
}

/**
 * One gradient-descent step on the angles (query and candidates), learning rate lr.
 * Filtered candidates (active = false) neither push nor move.
 */
export function sgd_step(theta_q: number, thetas: number[], tau: number, lr: number, active?: boolean[]): { q: number; docs: number[] } {
  const q = unit(theta_q), docs = thetas.map(unit);
  const gd = grad_docs(q, docs, tau, active), gq = grad_query(q, docs, tau, active);
  const nq = theta_q - lr * tangential(theta_q, gq);
  const nd = thetas.map((t, j) => (active && !active[j] ? t : t - lr * tangential(t, gd[j])));
  return { q: nq, docs: nd };
}

/** Angle between two directions, in degrees (0..180). */
export function angle_deg(a: number, b: number): number {
  const d = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  return (d * 180) / Math.PI;
}
