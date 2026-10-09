// Pure math of the rank-r approximation (C2 D1-D2): energy kept, relative
// error, LoRA parameter counts and the rank-r reconstruction of a crop from
// its top singular components (Eckart-Young: the truncated SVD is the best
// rank-r approximation, error² = sum of the dropped σᵢ²).

/** Fraction of Σσᵢ² kept by the top r singular values. */
export function energy_kept(sigma: readonly number[], r: number): number {
  let kept = 0, all = 0;
  sigma.forEach((s, i) => {
    all += s * s;
    if (i < r) kept += s * s;
  });
  return all > 0 ? kept / all : 1;
}
/** ‖ΔW − W_r‖_F / ‖ΔW‖_F = √(dropped energy). */
export const rel_error = (sigma: readonly number[], r: number): number => Math.sqrt(Math.max(0, 1 - energy_kept(sigma, r)));
/** Smallest r whose energy kept reaches `frac` (e.g. 0.9), counting all singular values. */
export function rank_for(sigma: readonly number[], frac: number): number {
  let all = 0;
  for (const s of sigma) all += s * s;
  let kept = 0;
  for (let i = 0; i < sigma.length; i++) {
    kept += sigma[i] * sigma[i];
    if (kept >= frac * all - 1e-15) return i + 1;
  }
  return sigma.length;
}
/** LoRA parameters for a d x k layer at rank r, and the full count dk. */
export const lora_params = (d: number, k: number, r: number): { lora: number; full: number; ratio: number } => ({ lora: r * (d + k), full: d * k, ratio: (r * (d + k)) / (d * k) });
/** Rank-r reconstruction of the crop: R[a][b] = Σ_{i<r} σᵢ U[a][i] V[b][i]. */
export function reconstruct(sigma: readonly number[], U: readonly (readonly number[])[], V: readonly (readonly number[])[], r: number): number[][] {
  const N = U.length, M = V.length, R = Math.min(r, U[0]?.length ?? 0);
  const out = Array.from({ length: N }, () => new Array<number>(M).fill(0));
  for (let a = 0; a < N; a++) {
    const ua = U[a], row = out[a];
    for (let i = 0; i < R; i++) {
      const s = sigma[i] * ua[i];
      if (s === 0) continue;
      for (let b = 0; b < M; b++) row[b] += s * V[b][i];
    }
  }
  return out;
}
