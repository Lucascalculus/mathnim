// Mersenne Twister with the seeding and sampling rules of CPython's `random`
// and numpy's legacy `np.random` (RandomState), so seeded scenes reproduce
// manim's pseudo-random layouts exactly.

const N = 624;
const M = 397;

export class MT19937 {
  mt = new Uint32Array(N);
  mti = N + 1;
  gauss: number | null = null;

  constructor(seed?: number) {
    this.init_genrand(seed ?? ((Math.random() * 0x100000000) >>> 0));
  }
  init_genrand(s: number): void {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < N; i++) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = (Math.imul(1812433253, p) + i) >>> 0;
    }
    this.mti = N;
    this.gauss = null;
  }
  init_by_array(key: number[]): void {
    this.init_genrand(19650218);
    const mt = this.mt;
    let i = 1, j = 0;
    for (let k = Math.max(N, key.length); k > 0; k--) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(p, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= N) {
        mt[0] = mt[N - 1];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = N - 1; k > 0; k--) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(p, 1566083941)) - i) >>> 0;
      i++;
      if (i >= N) {
        mt[0] = mt[N - 1];
        i = 1;
      }
    }
    mt[0] = 0x80000000;
    this.gauss = null;
  }
  next32(): number {
    const mt = this.mt;
    if (this.mti >= N) {
      let k = 0;
      for (; k < N - M; k++) {
        const y = (mt[k] & 0x80000000) | (mt[k + 1] & 0x7fffffff);
        mt[k] = mt[k + M] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      for (; k < N - 1; k++) {
        const y = (mt[k] & 0x80000000) | (mt[k + 1] & 0x7fffffff);
        mt[k] = mt[k + (M - N)] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      const y = (mt[N - 1] & 0x80000000) | (mt[0] & 0x7fffffff);
      mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      this.mti = 0;
    }
    let y = mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }
  /** Uniform double in [0, 1) with 53 random bits. */
  random(): number {
    const a = this.next32() >>> 5, b = this.next32() >>> 6;
    return (a * 67108864.0 + b) / 9007199254740992.0;
  }
  getrandbits(k: number): number {
    if (k <= 32) return this.next32() >>> (32 - k);
    // up to 53 bits
    const lo = this.next32();
    const hi = this.next32() >>> (64 - k);
    return hi * 0x100000000 + lo;
  }
  randbelow(n: number): number {
    const k = Math.floor(Math.log2(n)) + 1;
    let r = this.getrandbits(k);
    while (r >= n) r = this.getrandbits(k);
    return r;
  }
  /** numpy's legacy Box-Muller (polar) normal deviate. */
  legacy_gauss(): number {
    if (this.gauss !== null) {
      const g = this.gauss;
      this.gauss = null;
      return g;
    }
    let x1: number, x2: number, r2: number;
    do {
      x1 = 2.0 * this.random() - 1.0;
      x2 = 2.0 * this.random() - 1.0;
      r2 = x1 * x1 + x2 * x2;
    } while (r2 >= 1.0 || r2 === 0.0);
    const f = Math.sqrt((-2.0 * Math.log(r2)) / r2);
    this.gauss = f * x1;
    return f * x2;
  }
  /** numpy legacy bounded integer in [0, rng] (masked rejection sampling). */
  bounded(rng: number): number {
    if (rng === 0) return 0;
    let mask = rng;
    mask |= mask >>> 1;
    mask |= mask >>> 2;
    mask |= mask >>> 4;
    mask |= mask >>> 8;
    mask |= mask >>> 16;
    mask >>>= 0;
    let v: number;
    do v = (this.next32() & mask) >>> 0;
    while (v > rng);
    return v;
  }
}

/** Seed like CPython's random.seed(int). */
export function python_seed(mt: MT19937, a: number | null): void {
  if (a === null || a === undefined) {
    mt.init_genrand((Math.random() * 0x100000000) >>> 0);
    return;
  }
  let x = Math.abs(Math.trunc(a));
  const key: number[] = [];
  do {
    key.push(x % 0x100000000);
    x = Math.floor(x / 0x100000000);
  } while (x > 0);
  mt.init_by_array(key);
}
