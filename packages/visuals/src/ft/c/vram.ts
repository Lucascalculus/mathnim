// The VRAM estimate of part C1 (derivations D1-D6) as a pure function. The
// calculator visual is its interface; the lesson's numbers (the D5 table) are
// unit-tested against it. 1 GB = 1e9 bytes. An estimate, not a measurement.

/** Architecture of a decoder-only transformer (from its config.json). */
export interface Arch {
  id: string;
  name: string;
  family: 'Llama' | 'Qwen';
  /** Short label for a control, e.g. '8B' (the family is told by colour and the caption). */
  short: string;
  L: number;
  h: number;
  ffn: number;
  heads: number;
  kv_heads: number;
  V: number;
  /** Input embedding and LM head share one matrix. */
  tied: boolean;
}

export const MODELS: Arch[] = [
  { id: 'llama3.2-1b', family: 'Llama', name: 'Llama-3.2-1B', short: '1B', L: 16, h: 2048, ffn: 8192, heads: 32, kv_heads: 8, V: 128256, tied: true },
  { id: 'llama3.2-3b', family: 'Llama', name: 'Llama-3.2-3B', short: '3B', L: 28, h: 3072, ffn: 8192, heads: 24, kv_heads: 8, V: 128256, tied: true },
  { id: 'llama3.1-8b', family: 'Llama', name: 'Llama-3.1-8B', short: '8B', L: 32, h: 4096, ffn: 14336, heads: 32, kv_heads: 8, V: 128256, tied: false },
  { id: 'llama3.1-70b', family: 'Llama', name: 'Llama-3.1-70B', short: '70B', L: 80, h: 8192, ffn: 28672, heads: 64, kv_heads: 8, V: 128256, tied: false },
  { id: 'qwen2.5-7b', family: 'Qwen', name: 'Qwen2.5-7B', short: '7B', L: 28, h: 3584, ffn: 18944, heads: 28, kv_heads: 4, V: 152064, tied: false },
  { id: 'qwen2.5-14b', family: 'Qwen', name: 'Qwen2.5-14B', short: '14B', L: 48, h: 5120, ffn: 13824, heads: 40, kv_heads: 8, V: 152064, tied: false },
  { id: 'qwen2.5-32b', family: 'Qwen', name: 'Qwen2.5-32B', short: '32B', L: 64, h: 5120, ffn: 27648, heads: 40, kv_heads: 8, V: 152064, tied: false },
];
export const METHODS = ['full', 'lora', 'qlora'] as const;
export const OPTIMS = ['adamw', 'adamw8bit', 'bf16'] as const;
export const TARGETS = ['all-linear', 'attn'] as const;
export type Method = (typeof METHODS)[number];
export type Optim = (typeof OPTIMS)[number];
export type Targets = (typeof TARGETS)[number];

export interface VramConfig {
  model: Arch | string;
  method: Method;
  optim: Optim;
  /** LoRA rank (LoRA and QLoRA). */
  rank: number;
  targets: Targets;
  seq: number;
  batch: number;
  /** Activation recomputation ("gradient checkpointing"). */
  ckpt: boolean;
  /** Fused / chunked cross-entropy: the full logits tensor is never stored. */
  fused_ce: boolean;
  gpus: number;
  /** Shard weights, gradients and optimizer states over the GPUs (ZeRO-3 / FSDP). */
  zero3: boolean;
  /** Bytes per s·b·h per layer kept for backward: 34 (Korthikanti) or about 41 (Llama estimate). */
  act_const: number;
  /** CUDA context and fragmentation, GB (rule of thumb). */
  overhead?: number;
}

/** The parts of the bar, bottom to top. */
export const PARTS = ['frozen', 'weights', 'grads', 'optim', 'acts', 'logits', 'overhead'] as const;
export type Part = (typeof PARTS)[number];

export interface VramEstimate {
  arch: Arch;
  /** Parameter counts. */
  n_linear: number;
  n_embed: number;
  n_total: number;
  n_lora: number;
  /** GB per GPU, by part. */
  parts: Record<Part, number>;
  total: number;
  /** The largest part. */
  largest: Part;
}

export const GB = 1e9;
/** NF4 with double quantisation (block 64, 8-bit scales, one fp32 per 256 scales): bits per weight. */
export const NF4_DQ_BITS = 4 + 8 / 64 + 32 / (64 * 256);

export const arch_of = (m: Arch | string): Arch => (typeof m === 'string' ? MODELS.find((a) => a.id === m) ?? MODELS[2] : m);

/** Parameters of the linear layers of one block, and the sum of their input and output dimensions (for LoRA). */
export function layer_linears(a: Arch): { name: string; d_in: number; d_out: number; attn: boolean }[] {
  const hd = a.h / a.heads, kv = a.kv_heads * hd;
  return [
    { name: 'q_proj', d_in: a.h, d_out: a.h, attn: true },
    { name: 'k_proj', d_in: a.h, d_out: kv, attn: true },
    { name: 'v_proj', d_in: a.h, d_out: kv, attn: true },
    { name: 'o_proj', d_in: a.h, d_out: a.h, attn: true },
    { name: 'gate_proj', d_in: a.h, d_out: a.ffn, attn: false },
    { name: 'up_proj', d_in: a.h, d_out: a.ffn, attn: false },
    { name: 'down_proj', d_in: a.ffn, d_out: a.h, attn: false },
  ];
}

/** Parameter counts: linear layers, embeddings (+ untied head), total, and LoRA's r·L·Σ(d_in + d_out). */
export function param_counts(a: Arch, rank = 16, targets: Targets = 'all-linear'): { linear: number; embed: number; total: number; lora: number } {
  const lin = layer_linears(a);
  const linear = a.L * lin.reduce((s, l) => s + l.d_in * l.d_out, 0);
  const embed = a.V * a.h * (a.tied ? 1 : 2);
  const dims = lin.filter((l) => targets === 'all-linear' || l.attn).reduce((s, l) => s + l.d_in + l.d_out, 0);
  return { linear, embed, total: linear + embed, lora: rank * a.L * dims };
}

/** Bytes per trainable parameter: [weights, gradients, optimizer states]. Full: bf16 weights and grads; adapters are fp32. */
export function trainable_bytes(method: Method, optim: Optim): [number, number, number] {
  const w = method === 'full' ? 2 : optim === 'bf16' ? 2 : 4;
  if (optim === 'adamw') return [w, w, method === 'full' ? 12 : 8]; // full: fp32 master + m + v
  if (optim === 'adamw8bit') return [w, w, method === 'full' ? 6 : 2]; // m, v one byte each (+ fp32 master for full)
  return [2, 2, 4]; // pure bf16: m, v in bf16, no master copy
}

/** Activation bytes per GPU (FlashAttention, so no s² term). */
export function activation_bytes(a: Arch, seq: number, batch: number, ckpt: boolean, act_const = 34): number {
  const sbh = seq * batch * a.h;
  const per_layer = sbh * act_const;
  // recomputation: keep each layer's input (2 bytes), recompute one layer at a time in backward
  return ckpt ? 2 * sbh * a.L + per_layer : per_layer * a.L;
}

/** The estimate of C1 D1-D6 (GB per GPU). */
export function vram_estimate(cfg: VramConfig): VramEstimate {
  const a = arch_of(cfg.model);
  const n = param_counts(a, cfg.rank, cfg.targets);
  const shard = cfg.zero3 && cfg.gpus > 1 ? cfg.gpus : 1;
  const parts = { frozen: 0, weights: 0, grads: 0, optim: 0, acts: 0, logits: 0, overhead: cfg.overhead ?? 1 } as Record<Part, number>;
  const [bw, bg, bo] = trainable_bytes(cfg.method, cfg.optim);
  const n_train = cfg.method === 'full' ? n.total : n.lora;
  if (cfg.method === 'lora') parts.frozen = (2 * n.total) / GB;
  if (cfg.method === 'qlora') parts.frozen = ((n.linear * NF4_DQ_BITS) / 8 + 2 * n.embed) / GB;
  parts.weights = (bw * n_train) / GB;
  parts.grads = (bg * n_train) / GB;
  parts.optim = (bo * n_train) / GB;
  for (const k of ['frozen', 'weights', 'grads', 'optim'] as const) parts[k] /= shard;
  parts.acts = activation_bytes(a, cfg.seq, cfg.batch, cfg.ckpt, cfg.act_const) / GB;
  // fp32 logits and their gradient
  parts.logits = cfg.fused_ce ? 0 : (2 * 4 * cfg.batch * cfg.seq * a.V) / GB;
  const total = PARTS.reduce((s, k) => s + parts[k], 0);
  let largest: Part = 'frozen';
  for (const k of PARTS) if (k !== 'overhead' && parts[k] > parts[largest]) largest = k;
  return { arch: a, n_linear: n.linear, n_embed: n.embed, n_total: n.total, n_lora: n.lora, parts, total, largest };
}

/** The default configuration (Llama-3.1-8B, full AdamW, s = 4096, b = 1, recomputation on). */
export const DEFAULT_VRAM: VramConfig = {
  model: 'llama3.1-8b', method: 'full', optim: 'adamw', rank: 16, targets: 'all-linear', seq: 4096, batch: 1,
  ckpt: true, fused_ce: false, gpus: 1, zero3: false, act_const: 34,
};
