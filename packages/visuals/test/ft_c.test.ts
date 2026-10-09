// Part C of the fine-tuning course: the numbers on the pages must match the
// visuals' pure math (VRAM estimate, LoRA counts, quantisation).
import { describe, expect, it } from 'vitest';
import { DEFAULT_VRAM, MODELS, NF4_DQ_BITS, param_counts, vram_estimate, type VramConfig } from '../src/ft/c/vram';
import { change_of, mat_dist, rank_one } from '../src/ft/c/rank_one_update';
import { energy_kept, lora_params, rank_for, reconstruct, rel_error } from '../src/ft/c/lowrank';
import { LOWRANK_SOURCES } from '../src/ft/c/lowrank_data';
import { INT4, NF4, absmax_quant, levels_of, nearest_level, overhead_bits, quant_stats, quantize_blockwise } from '../src/ft/c/quant';
import { OUTLIER_IX, weights, with_outlier } from '../src/ft/c/quant_levels';
import { gaussian, rng } from '../src/linalg/math';

const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol);
const cfg = (o: Partial<VramConfig>): VramConfig => ({ ...DEFAULT_VRAM, ...o });

describe('vram_estimate (C1 D1-D6)', () => {
  it('counts Llama-3.1-8B like D2', () => {
    const n = param_counts(MODELS[2], 16, 'all-linear');
    near(n.linear / 1e9, 6.98, 0.005);
    near(n.embed / 1e9, 1.05, 0.005);
    near(n.total / 1e9, 8.03, 0.005);
    expect(n.lora).toBe(41_943_040);
    // attention only: r ≈ 49 gives the same count (D1.5)
    expect(param_counts(MODELS[2], 1, 'attn').lora / 32).toBe(26_624);
  });
  it('matches the other presets', () => {
    const b = (id: string) => param_counts(MODELS.find((m) => m.id === id)!).total / 1e9;
    near(b('llama3.2-1b'), 1.24, 0.01);
    near(b('llama3.2-3b'), 3.21, 0.01);
    near(b('qwen2.5-7b'), 7.62, 0.01);
    near(b('qwen2.5-14b'), 14.77, 0.01);
    near(param_counts(MODELS.find((m) => m.id === 'qwen2.5-14b')!).linear / 1e9, 13.2, 0.02);
    near(b('qwen2.5-32b'), 32.76, 0.01);
    near(b('llama3.1-70b'), 70.55, 0.01);
  });
  it('reproduces the D5 table (8B, s = 4096, b = 1, recomputation on)', () => {
    const full = (fused: boolean) => vram_estimate(cfg({ method: 'full', fused_ce: fused }));
    const lora = (fused: boolean, b = 1) => vram_estimate(cfg({ method: 'lora', fused_ce: fused, batch: b }));
    const qlora = (fused: boolean, b = 1) => vram_estimate(cfg({ method: 'qlora', fused_ce: fused, batch: b }));
    near(full(false).total, 135, 0.5);
    near(full(true).total, 131, 0.5);
    near(full(false).parts.optim + full(false).parts.weights + full(false).parts.grads, 128.5, 0.05);
    expect(full(false).largest).toBe('optim');
    near(lora(false).total, 23.6, 0.05);
    near(lora(true).total, 19.4, 0.05);
    near(lora(true).parts.frozen, 16.06, 0.01);
    near(lora(true).parts.weights + lora(true).parts.grads + lora(true).parts.optim, 0.67, 0.005);
    near(qlora(false).total, 13.2, 0.05);
    near(qlora(true).total, 9.0, 0.05);
    near(qlora(true).parts.frozen, 3.60 + 2.10, 0.01);
    near(vram_estimate(cfg({ method: 'qlora', fused_ce: false })).parts.logits, 4.2, 0.01);
    near(vram_estimate(cfg({ method: 'qlora' })).parts.acts, 1.6, 0.05);
    // batch 16, fused: LoRA 44.0, QLoRA 33.7; the saving falls from 54% to 23%
    near(lora(true, 16).total, 44.0, 0.05);
    near(qlora(true, 16).total, 33.7, 0.05);
    near(1 - qlora(true).total / lora(true).total, 0.54, 0.01);
    near(1 - qlora(true, 16).total / lora(true, 16).total, 0.23, 0.01);
  });
  it('follows recomputation, ZeRO-3 and the world goals of C1', () => {
    near(vram_estimate(cfg({ ckpt: false })).parts.acts, 18.3, 0.1);
    near(vram_estimate(cfg({ ckpt: false })).total - vram_estimate(cfg({})).total, 16.6, 0.1);
    const z = vram_estimate(cfg({ gpus: 2, zero3: true }));
    near(z.parts.weights + z.parts.grads + z.parts.optim, 64.2, 0.05);
    near(z.total, 71, 0.5);
    // goal 1: 8B, s = 4096 in 24 GB (LoRA, recomputation, fused CE)
    expect(vram_estimate(cfg({ method: 'lora', fused_ce: true })).total).toBeLessThan(24);
    // goal 2: QLoRA 8B, s = 16k in 16 GB
    const q16 = vram_estimate(cfg({ method: 'qlora', fused_ce: true, seq: 16384 }));
    expect(q16.total).toBeLessThan(16);
    near(q16.total, 14, 0.5);
    expect(NF4_DQ_BITS).toBeCloseTo(4.127, 3);
  });
});

// ---------------------------------------------------------------- C2: rank-1 update and rank-r approximation

describe('rank_one_update (C2 I1)', () => {
  it('builds the shear [[1, 1], [0, 1]] from I with u = (1, 0), v = (0, 1)', () => {
    expect(mat_dist(rank_one([[1, 0], [0, 1]], [1, 0], [0, 1]), [[1, 1], [0, 1]])).toBe(0);
    // the default of the spec: u = (0.5, 1), v = (1, 0) gives [[1.5, 0], [1, 1]]
    expect(mat_dist(rank_one([[1, 0], [0, 1]], [0.5, 1], [1, 0]), [[1.5, 0], [1, 1]])).toBe(0);
  });
  it('changes every input along u by v·x, and nothing on the line perpendicular to v', () => {
    const u: [number, number] = [0.5, 1], v: [number, number] = [0.6, 0.8];
    const d = change_of(u, v, [2, -1]);
    expect(d[0] * u[1] - d[1] * u[0]).toBeCloseTo(0, 12); // parallel to u
    for (const q of change_of(u, v, [-0.8, 0.6])) expect(Math.abs(q)).toBeLessThan(1e-12);
    expect(change_of([1, 0], [0, 1], [1, 0])).toEqual([0, 0]); // the world's solve: x on the unchanged line
  });
});

describe('lowrank_update (C2 D1-D2, I2)', () => {
  const src = (id: string, layer: string) => LOWRANK_SOURCES.find((s) => s.id === id && s.layer === layer)!;
  it('has the three matrices for both layers, in the documented shape', () => {
    for (const layer of ['q_proj', 'down_proj']) for (const id of ['full_ft', 'rank16', 'random']) {
      const s = src(id, layer);
      expect(s, `${id} ${layer}`).toBeTruthy();
      expect(s.sigma.length).toBe(Math.min(s.d, s.k));
      expect(s.crop.length).toBe(s.N);
      expect(s.U.length).toBe(s.N);
      expect(s.V.length).toBe(s.N);
      // the top 64 components, or all of them when the rank is lower (rank16 keeps 16; the rest have σ = 0)
      const comps = Math.min(64, s.sigma.filter((x) => x > 0).length);
      expect(s.U[0].length).toBe(comps);
      expect(s.V[0].length).toBe(comps);
      expect(s.crop[0].length).toBe(s.N);
      for (let i = 1; i < s.sigma.length; i++) expect(s.sigma[i]).toBeLessThanOrEqual(s.sigma[i - 1] + 1e-12);
    }
  });
  it('computes energy, error and parameter counts like D1-D2', () => {
    // the PCA lesson's number: σ = 3, 2, 1 keeps (9 + 4) / 14 at rank 2
    expect(energy_kept([3, 2, 1], 2)).toBeCloseTo(13 / 14, 12);
    expect(rel_error([3, 2, 1], 2)).toBeCloseTo(Math.sqrt(1 / 14), 12);
    expect(rank_for([3, 2, 1], 0.9)).toBe(2);
    expect(lora_params(4096, 4096, 16).ratio).toBeCloseTo(0.0078125, 10);
    expect(lora_params(3584, 18944, 32).lora).toBe(720_896);
    expect(lora_params(896, 896, 16).lora).toBe(28_672);
  });
  it('reproduces the crop of the rank-16 matrix exactly at r = 16 (it is built low-rank)', () => {
    for (const layer of ['q_proj', 'down_proj']) {
      const s = src('rank16', layer), m = Math.max(...s.crop.flat().map(Math.abs));
      const R = reconstruct(s.sigma, s.U, s.V, 16);
      const err = Math.max(...s.crop.flatMap((row, a) => row.map((v, b) => Math.abs(v - R[a][b]))));
      expect(err / m).toBeLessThan(0.02);
      expect(energy_kept(s.sigma, 16)).toBeGreaterThan(0.9999);
      expect(rank_for(s.sigma, 0.999)).toBeLessThanOrEqual(16);
    }
  });
  it('keeps the observations of I2: the official ΔW needs far more than 64 for 90%, the random one keeps about r/n', () => {
    for (const layer of ['q_proj', 'down_proj']) {
      const full = src('full_ft', layer), rnd = src('random', layer);
      expect(rank_for(full.sigma, 0.9)).toBeGreaterThan(64);
      expect(energy_kept(full.sigma, 64)).toBeLessThan(0.9);
      expect(energy_kept(rnd.sigma, 64)).toBeLessThan(energy_kept(full.sigma, 64) + 0.1);
    }
  });
});

// ---------------------------------------------------------------- C3: quantisation

describe('quantisation (C3 D0-D2)', () => {
  it('reproduces the hand example of D0', () => {
    const r = absmax_quant([0.12, -0.05, 0.31, -0.27, 0.02, 0.44, -0.18, 0.07], 4);
    expect(r.s).toBeCloseTo(0.44 / 7, 12);
    expect(r.q).toEqual([2, -1, 5, -4, 0, 7, -3, 1]);
    expect(r.xhat.map((v) => +v.toFixed(3))).toEqual([0.126, -0.063, 0.314, -0.251, 0, 0.44, -0.189, 0.063]);
    expect(Math.max(...r.xhat.map((v, i) => Math.abs(v - [0.12, -0.05, 0.31, -0.27, 0.02, 0.44, -0.18, 0.07][i])))).toBeLessThanOrEqual(r.s / 2);
    // the same through the blockwise path with the int4 grid
    const b = quantize_blockwise([0.12, -0.05, 0.31, -0.27, 0.02, 0.44, -0.18, 0.07], 8, INT4);
    expect([...b.idx].map((i) => i - 7)).toEqual([2, -1, 5, -4, 0, 7, -3, 1]);
  });
  it('has the NF4 levels of D1 (16, an exact 0, 7 below and 8 above, ±1 at the ends)', () => {
    expect(NF4.length).toBe(16);
    expect(NF4.filter((x) => x < 0).length).toBe(7);
    expect(NF4.filter((x) => x > 0).length).toBe(8);
    expect(NF4).toContain(0);
    expect(NF4[0]).toBe(-1);
    expect(NF4[15]).toBe(1);
    expect(nearest_level(0.03, NF4)).toBe(7);
    expect(nearest_level(0.05, NF4)).toBe(8);
    expect(levels_of('int8').length).toBe(255);
  });
  it('gives the overheads of D2', () => {
    expect(overhead_bits(64, false)).toBe(0.5);
    expect(overhead_bits(64, true)).toBeCloseTo(0.127, 3);
    expect(overhead_bits(128, true)).toBeCloseTo(0.0635, 4);
    expect(overhead_bits(32, false)).toBe(1);
    expect(overhead_bits(256, false)).toBe(0.125);
    // 65B: (0.5 - 0.127) bits x 65e9 / 8 ≈ 3.03 GB
    expect(((overhead_bits(64, false) - overhead_bits(64, true)) * 65e9) / 8 / 1e9).toBeCloseTo(3.03, 2);
  });
  it('an outlier of 0.5 in a N(0, 0.02²) block of 64 sends ~93% of the other weights to 0 (int4)', () => {
    // expected share: P(|z| < 0.5/7/2/0.02) = P(|z| < 1.786) ≈ 0.926
    const g = gaussian(rng(99));
    let zeros = 0, n = 0;
    for (let b = 0; b < 400; b++) {
      const x = Array.from({ length: 64 }, () => 0.02 * g());
      x[5] = 0.5;
      const s = quant_stats(x, 'int4', 64, false, 5);
      zeros += s.zero_frac * 63;
      n += 63;
    }
    expect(zeros / n).toBeGreaterThan(0.91);
    expect(zeros / n).toBeLessThan(0.94);
    // and in the visual's own data: few levels used, most weights at 0
    const { w, sigma } = weights('gaussian', 7);
    const s = quant_stats(with_outlier(w, sigma, 25), 'int4', 64, false, OUTLIER_IX);
    expect(s.levels_used).toBeLessThanOrEqual(4);
    expect(s.zero_frac).toBeGreaterThan(0.85);
  });
  it('keeps the damage inside one block, and NF4 beats int4 without outliers (C3 I1)', () => {
    const { w, sigma } = weights('gaussian', 7);
    const x25 = with_outlier(w, sigma, 25), x0 = with_outlier(w, sigma, 0);
    const whole = quant_stats(x25, 'int4', 4096, false, OUTLIER_IX).mse;
    const b64 = quant_stats(x25, 'int4', 64, false, OUTLIER_IX).mse;
    const b64_clean = quant_stats(x0, 'int4', 64, false, OUTLIER_IX).mse;
    expect(whole / b64).toBeGreaterThan(10); // "tens of times smaller"
    expect(b64 / b64_clean).toBeLessThan(3.5); // only about twice the error without an outlier
    // world goal 1 (outlier ≥ 20σ: MSE below a tenth of whole-tensor scaling) is reachable with B ≤ 256
    for (const k of [20, 25]) {
      const xk = with_outlier(w, sigma, k), base = quant_stats(xk, 'int4', 4096, false, OUTLIER_IX).mse;
      for (const B of [32, 64, 256]) expect(quant_stats(xk, 'int4', B, false, OUTLIER_IX).mse, `${k}σ B=${B}`).toBeLessThan(base / 10);
    }
    // world goal 2: at B = 64 without an outlier NF4 has the lower MSE
    expect(quant_stats(x0, 'nf4', 64, false, OUTLIER_IX).mse).toBeLessThan(b64_clean);
  });
});
