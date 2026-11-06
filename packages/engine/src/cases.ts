// Development (显影): a family of cases drawn in transparent ink, one after another, so that where they agree the ink
// is deepest. Secants through a point as h is halved close onto the tangent; a pencil of lines under a matrix keeps
// its eigen-directions; sample paths settle on their mean. The limit, the invariant, the law is not drawn by anyone:
// it develops where the cases agree.
//
// `upto` says how many of the cases are shown (a fraction fades the last one in), so the mark is a pure function of
// it and seeking is exact. The cases shown are kept on a film (an offscreen canvas): when `upto` grows only the new
// ones are drawn onto it, when it goes back, or what the cases read changes, or the plot is laid out again, the film
// is drawn anew. A frame otherwise costs one image copy.
import type { XY } from './geom';
import { Mark } from './kinds';
import { make_canvas } from './render';
import { read, track, type Readable, type Val } from './state';
import type { DrawEnv, Style } from './thing';
import type { L10n } from './text';

export class Cases extends Mark {
  kind = 'cases';
  private film: HTMLCanvasElement | null = null;
  private fg: CanvasRenderingContext2D | null = null;
  /** How many cases the film holds, the layout it was drawn for, and what the cases read when it was. */
  private held = 0;
  private key = '';
  private deps: Readable<unknown>[] = [];
  private sig = -1;
  /**
   * `fn(i)`: case i (0 … count - 1) as a polyline in the plot's data coordinates (null: no such case). `upto`: how many
   * are shown. `ink`: each case's strength (0..1, default 0.14: a dozen cases that agree are full ink). `width` in px.
   */
  constructor(public fn: (i: number) => XY[] | null, public o: { id?: string; role?: string; says?: L10n; z?: number; count: number; upto: Val<number>; ink?: number; width?: number; style?: Style }) {
    super({ ...o, z: o.z ?? 1.8 });
  }
  /** How many cases are shown now (0 … count; a fraction: the last one fading in). */
  shown(): number {
    return Math.max(0, Math.min(this.o.count, read(this.o.upto)));
  }
  private ink(): number {
    return this.style.alpha ?? this.o.ink ?? 0.14;
  }
  private trace(g: CanvasRenderingContext2D, i: number): void {
    const pts = this.fn(i);
    if (!pts || pts.length < 2) return;
    g.beginPath();
    pts.forEach((p, k) => {
      const [x, y] = this.plot.P(p);
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
  }
  draw(env: DrawEnv): void {
    // (the film is in device px: the context's own scale, which is the figure's dpr times any layout scale)
    const m = env.g.getTransform(), dpr = m.a || env.dpr;
    const n = this.shown(), whole = Math.floor(n), part = n - whole, d = this.plot.data;
    // (what the cases read is read here too, every frame, so the renderer redraws this mark when it changes)
    for (const r of this.deps) void r.value;
    const W = Math.max(1, Math.ceil(d.w * dpr) + 4), H = Math.max(1, Math.ceil(d.h * dpr) + 4);
    const key = `${d.x},${d.y},${d.w},${d.h},${dpr},${this.plot.P([0, 0])},${this.plot.P([1, 1])},${this.color},${this.ink()},${this.o.width ?? 1.1}`;
    const sig = this.deps.reduce((a, r) => Math.max(a, r.version), 0);
    if (!this.film || key !== this.key || sig !== this.sig || whole < this.held) {
      if (!this.film || this.film.width !== W || this.film.height !== H) {
        this.film = make_canvas(W, H) as unknown as HTMLCanvasElement;
        this.fg = this.film.getContext('2d') as CanvasRenderingContext2D;
      }
      this.fg!.setTransform(1, 0, 0, 1, 0, 0);
      this.fg!.clearRect(0, 0, W, H);
      this.held = 0;
      this.key = key;
      // (what the cases read, recorded on a rebuild: a change to it rebuilds)
      const t = track(() => { for (let i = 0; i < Math.max(1, whole); i++) this.fn(i); });
      this.deps = t.deps;
      this.sig = this.deps.reduce((a, r) => Math.max(a, r.version), 0);
    }
    const fg = this.fg!;
    if (whole > this.held) {
      fg.setTransform(dpr, 0, 0, dpr, 2 - Math.round(d.x * dpr), 2 - Math.round(d.y * dpr));
      fg.strokeStyle = this.color;
      fg.lineWidth = this.style.width ?? this.o.width ?? 1.1;
      fg.lineCap = 'round';
      fg.lineJoin = 'round';
      fg.globalAlpha = this.ink();
      for (let i = this.held; i < whole; i++) this.trace(fg, i);
      fg.globalAlpha = 1;
      this.held = whole;
    }
    const g = env.g;
    g.save();
    this.clip(env);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.film as unknown as CanvasImageSource, Math.round(m.e + d.x * dpr) - 2, Math.round(m.f + d.y * dpr) - 2);
    g.restore();
    // the case on its way in, faint as it arrives
    if (part > 0.001 && whole < this.o.count) {
      g.strokeStyle = this.color;
      g.lineWidth = this.style.width ?? this.o.width ?? 1.1;
      g.lineCap = 'round';
      g.globalAlpha *= this.ink() * part;
      this.trace(g, whole);
    }
    g.restore();
    this.box = { ...d };
  }
  // a family is a background: labels may sit on it
  override obstacles() {
    return [];
  }
}
