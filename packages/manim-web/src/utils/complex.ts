// Python's complex numbers (manim uses them for complex planes and functions).
export class Complex {
  constructor(public re = 0, public im = 0) {}
  static from(z: number | Complex | readonly number[]): Complex {
    if (z instanceof Complex) return z;
    if (typeof z === 'number') return new Complex(z, 0);
    return new Complex(z[0] ?? 0, z[1] ?? 0);
  }
  get real(): number { return this.re; }
  get imag(): number { return this.im; }
  add(o: number | Complex): Complex { const b = Complex.from(o); return new Complex(this.re + b.re, this.im + b.im); }
  sub(o: number | Complex): Complex { const b = Complex.from(o); return new Complex(this.re - b.re, this.im - b.im); }
  mul(o: number | Complex): Complex { const b = Complex.from(o); return new Complex(this.re * b.re - this.im * b.im, this.re * b.im + this.im * b.re); }
  div(o: number | Complex): Complex {
    const b = Complex.from(o);
    const d = b.re * b.re + b.im * b.im;
    return new Complex((this.re * b.re + this.im * b.im) / d, (this.im * b.re - this.re * b.im) / d);
  }
  neg(): Complex { return new Complex(-this.re, -this.im); }
  conjugate(): Complex { return new Complex(this.re, -this.im); }
  abs(): number { return Math.hypot(this.re, this.im); }
  arg(): number { return Math.atan2(this.im, this.re); }
  exp(): Complex { const e = Math.exp(this.re); return new Complex(e * Math.cos(this.im), e * Math.sin(this.im)); }
  log(): Complex { return new Complex(Math.log(this.abs()), this.arg()); }
  pow(o: number | Complex): Complex {
    const b = Complex.from(o);
    if (this.re === 0 && this.im === 0) return b.re === 0 && b.im === 0 ? new Complex(1, 0) : new Complex(0, 0);
    if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
      let r: Complex = new Complex(1, 0);
      const base: Complex = b.re >= 0 ? this : new Complex(1, 0).div(this);
      for (let i = 0; i < Math.abs(b.re); i++) r = r.mul(base);
      return r;
    }
    return this.log().mul(b).exp();
  }
  sqrt(): Complex { return this.pow(0.5); }
  sin(): Complex { return new Complex(Math.sin(this.re) * Math.cosh(this.im), Math.cos(this.re) * Math.sinh(this.im)); }
  cos(): Complex { return new Complex(Math.cos(this.re) * Math.cosh(this.im), -Math.sin(this.re) * Math.sinh(this.im)); }
  toString(): string { return `(${this.re}${this.im >= 0 ? '+' : '-'}${Math.abs(this.im)}j)`; }
}
export const complex = (re = 0, im = 0): Complex => new Complex(re, im);
/** Accepts Complex, [re, im] or a real number. */
export const toComplex = (z: unknown): Complex => (z instanceof Complex ? z : Array.isArray(z) ? new Complex(z[0], z[1]) : typeof z === 'number' ? new Complex(z, 0) : new Complex((z as any).re ?? 0, (z as any).im ?? 0));
