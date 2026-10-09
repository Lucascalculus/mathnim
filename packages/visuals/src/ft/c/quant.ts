// Pure math of blockwise absmax quantisation (C3 D0-D2): uniform int4/int8
// grids and the NF4 levels, nearest-level rounding per block, the error and
// the scale overhead. Values are dequantised as absmax · level.

/** int4 absmax: k/7 for k = -7..7 (15 levels). */
export const INT4 = Array.from({ length: 15 }, (_, i) => (i - 7) / 7);
/** int8 absmax: k/127 for k = -127..127. */
export const INT8 = Array.from({ length: 255 }, (_, i) => (i - 127) / 127);
/** NF4 (QLoRA; bitsandbytes create_normal_map): levels at normal quantiles, an exact 0, 7 negative and 8 positive. */
export const NF4 = [
  -1, -0.6961928009986877, -0.5250730514526367, -0.39491748809814453, -0.28444138169288635, -0.18477343022823334, -0.09105003625154495, 0,
  0.07958029955625534, 0.16093020141124725, 0.24611230194568634, 0.33791524171829224, 0.44070982933044434, 0.5626170039176941, 0.7229568362236023, 1,
];
export const FORMATS = ['int4', 'nf4', 'int8'] as const;
export type Format = (typeof FORMATS)[number];
export const levels_of = (f: Format): number[] => (f === 'nf4' ? NF4 : f === 'int8' ? INT8 : INT4);

/** Symmetric absmax integer quantisation of one block (C3 D0): s = max|x| / (2^(bits-1) - 1), q = round(x / s), x̂ = s·q. */
export function absmax_quant(x: readonly number[], bits = 4): { s: number; q: number[]; xhat: number[] } {
  const qmax = 2 ** (bits - 1) - 1;
  const s = Math.max(...x.map(Math.abs)) / qmax;
  const q = x.map((v) => (s > 0 ? Math.round(v / s) : 0));
  return { s, q, xhat: q.map((k) => k * s) };
}

/** Index of the level nearest to t (levels sorted ascending). */
export function nearest_level(t: number, levels: readonly number[]): number {
  let lo = 0, hi = levels.length - 1;
  if (t <= levels[lo]) return lo;
  if (t >= levels[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (levels[mid] <= t) lo = mid;
    else hi = mid;
  }
  return t - levels[lo] <= levels[hi] - t ? lo : hi;
}

/** Quantise x in blocks of B (B ≥ x.length: one scale for the whole tensor). */
export function quantize_blockwise(x: readonly number[], B: number, levels: readonly number[]): { idx: Int32Array; xhat: Float64Array; absmax: number[] } {
  const n = x.length, idx = new Int32Array(n), xhat = new Float64Array(n), absmax: number[] = [];
  for (let b0 = 0; b0 < n; b0 += B) {
    const b1 = Math.min(n, b0 + B);
    let m = 0;
    for (let i = b0; i < b1; i++) m = Math.max(m, Math.abs(x[i]));
    absmax.push(m);
    for (let i = b0; i < b1; i++) {
      const k = m > 0 ? nearest_level(x[i] / m, levels) : nearest_level(0, levels);
      idx[i] = k;
      xhat[i] = m * levels[k];
    }
  }
  return { idx, xhat, absmax };
}

/** Bits per parameter spent on scales: one fp32 per block, or with double quantisation 8-bit scales plus one fp32 per 256 scales. */
export const overhead_bits = (B: number, double_quant: boolean): number => (double_quant ? 8 / B + 32 / (B * 256) : 32 / B);

export interface QuantStats {
  /** Mean squared error over all weights except the outlier. */
  mse: number;
  /** Levels used by the other weights of the outlier's block. */
  levels_used: number;
  levels_total: number;
  /** Share of the other weights of the outlier's block that become exactly 0. */
  zero_frac: number;
  /** absmax of the outlier's block. */
  absmax: number;
  /** Count of weights (outlier included) on each level, in the outlier's block. */
  counts: number[];
  overhead: number;
}

/** Quantise and measure: x with its outlier at index `outlier_ix`, blocks of B. */
export function quant_stats(x: readonly number[], format: Format, B: number, double_quant: boolean, outlier_ix: number): QuantStats {
  const levels = levels_of(format);
  const q = quantize_blockwise(x, B, levels);
  let se = 0;
  for (let i = 0; i < x.length; i++) if (i !== outlier_ix) se += (x[i] - q.xhat[i]) ** 2;
  const b = Math.floor(outlier_ix / B), b0 = b * B, b1 = Math.min(x.length, b0 + B);
  const counts = new Array<number>(levels.length).fill(0), used = new Set<number>();
  const zero = nearest_level(0, levels);
  let zeros = 0;
  for (let i = b0; i < b1; i++) {
    counts[q.idx[i]]++;
    if (i === outlier_ix) continue;
    used.add(q.idx[i]);
    if (q.idx[i] === zero && levels[zero] === 0) zeros++;
  }
  return {
    mse: se / (x.length - 1), levels_used: used.size, levels_total: levels.length, zero_frac: zeros / Math.max(1, b1 - b0 - 1),
    absmax: q.absmax[b], counts, overhead: overhead_bits(Math.min(B, x.length), double_quant),
  };
}
