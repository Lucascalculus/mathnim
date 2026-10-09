// Part C of the fine-tuning course: the numbers on the pages must match the
// visuals' pure math (VRAM estimate, LoRA counts, quantisation).
import { describe, expect, it } from 'vitest';
import { DEFAULT_VRAM, MODELS, NF4_DQ_BITS, param_counts, vram_estimate, type VramConfig } from '../src/ft/c/vram';

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
