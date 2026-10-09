// numpy's default bit generator (PCG64 seeded through SeedSequence), for code
// that manim runs with `np.random.default_rng(seed)` (e.g. StreamLines), so the
// same pseudo-random numbers come out. Not in manim itself (web extension).
const M64 = (1n << 64n) - 1n;
const M128 = (1n << 128n) - 1n;
const MULT = (2549297995355413924n << 64n) + 4865540595714422341n;

/** numpy.random.SeedSequence(entropy).generate_state(n_words, uint32). */
export function seed_sequence_state(entropy: number, n_words: number): number[] {
  const INIT_A = 0x43b0d7e5, MULT_A = 0x931e8875, INIT_B = 0x8b51f9dd, MULT_B = 0x58f38ded;
  const MIX_MULT_L = 0xca01f9dd, MIX_MULT_R = 0x4973f715;
  let hc = INIT_A;
  const hashmix = (value: number): number => {
    value = (value ^ hc) >>> 0;
    hc = Math.imul(hc, MULT_A) >>> 0;
    value = Math.imul(value, hc) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  };
  const mix = (x: number, y: number): number => {
    const r = (Math.imul(MIX_MULT_L, x) - Math.imul(MIX_MULT_R, y)) >>> 0;
    return (r ^ (r >>> 16)) >>> 0;
  };
  // entropy as little-endian uint32 words ([0] for 0)
  const words: number[] = [];
  let n = BigInt(Math.trunc(entropy));
  do {
    words.push(Number(n & 0xffffffffn));
    n >>= 32n;
  } while (n > 0n);
  const pool = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) pool[i] = hashmix(i < words.length ? words[i] : 0);
  for (let s = 0; s < 4; s++) for (let d = 0; d < 4; d++) if (s !== d) pool[d] = mix(pool[d], hashmix(pool[s]));
  for (let s = 4; s < words.length; s++) for (let d = 0; d < 4; d++) pool[d] = mix(pool[d], hashmix(words[s]));
  const out: number[] = [];
  let hb = INIT_B;
  for (let i = 0; i < n_words; i++) {
    let v = pool[i % 4];
    v = (v ^ hb) >>> 0;
    hb = Math.imul(hb, MULT_B) >>> 0;
    v = Math.imul(v, hb) >>> 0;
    out.push((v ^ (v >>> 16)) >>> 0);
  }
  return out;
}

/** numpy.random.PCG64 (XSL-RR 128/64). */
export class PCG64 {
  state = 0n;
  inc = 0n;
  constructor(seed = 0) {
    const w = seed_sequence_state(seed, 8).map(BigInt);
    const u64 = (k: number) => w[2 * k] | (w[2 * k + 1] << 32n);
    const initstate = (u64(0) << 64n) | u64(1);
    const initseq = (u64(2) << 64n) | u64(3);
    this.state = 0n;
    this.inc = ((initseq << 1n) | 1n) & M128;
    this.step();
    this.state = (this.state + initstate) & M128;
    this.step();
  }
  private step(): void {
    this.state = (this.state * MULT + this.inc) & M128;
  }
  next64(): bigint {
    this.step();
    const s = this.state;
    const x = ((s >> 64n) ^ s) & M64;
    const rot = s >> 122n;
    return ((x >> rot) | (x << ((64n - rot) & 63n))) & M64;
  }
  /** Generator.random(): a double in [0, 1). */
  random(): number {
    return Number(this.next64() >> 11n) * (1.0 / 9007199254740992.0);
  }
}

/** A tiny stand-in for `np.random.default_rng(seed)` (only `.random(size)`). */
export function default_rng(seed = 0): { random: (size?: number | null) => number | number[] } {
  const g = new PCG64(seed);
  return { random: (size: number | null = null) => (size === null ? g.random() : Array.from({ length: size }, () => g.random())) };
}
