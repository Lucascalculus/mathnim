// Time as matter (时间成为物质): a moving point leaves its past on the paper and shows its future as a guess. The path
// walked is a solid line; on it, ghosts of the point at equal times (every 0.1 s by default): close together where it
// was slow, far apart where it was fast, so speed is read as spacing without a number. The ghosts are deposited at
// whole multiples of `every` and stay where they fell (they do not slide along as time goes on), fading with age.
// The path ahead, when asked for, is dashed: a prediction (the same hollow-to-solid grammar as certainty). Ticks mark
// moments on it (when a constraint becomes active, when the ball lands).
//
// The point is a position function of time or a simulation (its states mapped to the plot), and the mark is a pure
// function of `at`, so seeking is exact. The past is sampled once and kept: time going on adds only the new samples,
// going back costs nothing, and what the positions read changing (a param, the sim's inputs) samples them anew.
//
//   P.add(new Trail((t) => [v0 * t, v0 * t - 4.9 * t * t], { id: 'trail', role: 'noun:ball', at: time, ahead: 0.6 }));
//   P.add(new Trail({ sim, xy: (y) => bob_at(y[0]) }, { id: 'trail', role: 'noun:bob', past: 1.5 }));   // at: sim.clock
import type { XY } from '../kernel/geom';
import { Mark } from '../kernel/kinds';
import type { Sim } from '../kernel/sim';
import { Derived, read, track, type Readable, type Val } from '../kernel/state';
import type { DrawEnv, Style } from '../kernel/thing';
import { t, type L10n } from '../kernel/text';
import { define_thing } from '../kernel/registry';

/** What moves: its position at a time (data coordinates; null: not there), or a simulation and where a state puts it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TrailSource = ((t: number) => XY | null) | { sim: Sim<any>; xy: (y: Float64Array) => XY | null };

export interface TrailOptions {
  id?: string;
  role?: string;
  says?: L10n;
  z?: number;
  style?: Style;
  /** The time now (default: the sim's clock). */
  at?: Val<number>;
  /** When the motion starts (default 0): nothing is drawn before it. */
  from?: number;
  /** How far back the past is drawn, in seconds (default: all of it). */
  past?: number;
  /** How far ahead the future is drawn, dashed, in seconds (default 0: none). */
  ahead?: number;
  /** When the motion ends (a ball lands, a horizon is reached): the future is not drawn past it. */
  until?: Val<number>;
  /** Seconds between ghosts (default 0.1; 0: no ghosts, only the path). */
  every?: number;
  /** A ghost's radius in px (default 4.5). */
  r?: number;
  /** Moments marked on the path (seconds): a short stroke across it; a moment still ahead is drawn faint. */
  ticks?: Val<number[]>;
  /** The path's width in px (default 1.6). */
  width?: number;
}

const FPS = 60;

export class Trail extends Mark {
  kind = 'trail';
  /** The past, sampled from `from` every `fine` seconds: samples[k] is the position at from + k·fine. */
  private samples: (XY | null)[] = [];
  private deps: Readable<unknown>[] = [];
  private sig = -1;
  readonly fine: number;
  /** Samples between ghosts. */
  private per_ghost: number;
  constructor(public source: TrailSource, public o: TrailOptions = {}) {
    super({ ...o, z: o.z ?? 1.9 });
    const every = o.every ?? 0.1;
    const sim = this.sim();
    // the sampling step: a frame's worth (or the ghosts' spacing over a whole number), on the sim's steps
    let fine = every > 0 ? every / Math.max(1, Math.round(every * FPS)) : 1 / FPS;
    if (sim) fine = Math.max(1, Math.round(fine / sim.dt)) * sim.dt;
    this.fine = fine;
    this.per_ghost = every > 0 ? Math.max(1, Math.round(every / fine)) : 0;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sim(): Sim<any> | null {
    return typeof this.source === 'function' ? null : this.source.sim;
  }
  /** The time now. */
  now(): number {
    const s = this.sim();
    return this.o.at !== undefined ? read(this.o.at) : s ? s.clock.value : 0;
  }
  /** The position at a time (not kept). */
  pos(t: number): XY | null {
    const s = this.source;
    if (typeof s === 'function') return s(t);
    return s.xy(s.sim.at(t));
  }
  /** Positions at t0 + i·fine for i = 0 … n (a sim integrates them in one pass). */
  private run(t0: number, n: number): (XY | null)[] {
    const s = this.source;
    if (typeof s === 'function') return Array.from({ length: n + 1 }, (_, i) => s(t0 + i * this.fine));
    return s.sim.series(t0, t0 + n * this.fine, this.fine).map((x) => s.xy(x.y));
  }
  /** The past sampled up to sample k (kept; only what is missing is computed). */
  private extend(k: number): void {
    const have = this.samples.length, from = this.o.from ?? 0;
    if (k < have) return;
    if (!have) {
      // (what the positions read, recorded when they are first sampled: a change to it samples them anew)
      const t = track(() => this.run(from, k)), sim = this.sim();
      this.samples = t.value;
      // (a sim's run is its inputs': they are what a change shows up in)
      this.deps = sim ? [sim.inputs, ...t.deps] : t.deps;
      this.sig = sig_of(this.deps);
      return;
    }
    const more = this.run(from + (have - 1) * this.fine, k - have + 1);
    for (let i = 1; i < more.length; i++) this.samples.push(more[i]);
  }
  draw(env: DrawEnv): void {
    const g = env.g, from = this.o.from ?? 0, at = this.now();
    // (what the positions read is read here too, every frame, so the renderer redraws this mark when it changes)
    for (const r of this.deps) void r.value;
    const sim = this.sim();
    if (sim) void sim.inputs.value;
    if (sig_of(this.deps) !== this.sig) this.samples = [];
    this.box = { ...this.plot.data };
    if (!(at > from - 1e-9)) return;
    const fine = this.fine, k_now = Math.floor((at - from) / fine + 1e-9);
    this.extend(k_now);
    const k0 = this.o.past === undefined ? 0 : Math.max(0, Math.ceil((at - this.o.past - from) / fine - 1e-9));
    const P = (p: XY) => this.plot.P(p);
    const here = this.pos_now(at);
    const color = this.color, width = this.style.width ?? this.o.width ?? 1.6;
    g.save();
    this.clip(env);
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const base = g.globalAlpha * (this.style.alpha ?? 1);
    // the path walked: solid
    g.lineWidth = width;
    g.globalAlpha = base * 0.62;
    this.polyline(g, [...this.samples.slice(k0, k_now + 1), here], P);
    // the ghosts, where they fell: whole multiples of `every`, fading with age (none on the point itself)
    const n = this.per_ghost, r = this.o.r ?? 4.5;
    if (n) {
      const fade = Math.min(this.o.past ?? 3, 3), every = n * fine;
      for (let k = Math.ceil(k0 / n) * n; k <= k_now; k += n) {
        const t = from + k * fine, age = at - t, p = this.samples[k];
        if (!p || age < every * 0.35) continue;
        const [x, y] = P(p);
        g.globalAlpha = base * (0.1 + 0.26 * Math.max(0, 1 - age / fade));
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    // the path ahead: dashed (a prediction)
    const end = this.o.until === undefined ? Infinity : read(this.o.until);
    const ahead = Math.max(0, Math.min(this.o.ahead ?? 0, end - at));
    if (ahead > fine * 0.5) {
      const m = Math.max(1, Math.round(ahead / fine));
      const future = this.run(at, m);
      g.globalAlpha = base * 0.62;
      g.setLineDash(this.future_dash(width));
      this.polyline(g, [here, ...future.slice(1)], P);
      g.setLineDash([]);
    }
    // moments marked on the path
    const ticks = this.o.ticks === undefined ? [] : read(this.o.ticks);
    for (const tt of ticks) {
      if (!(tt >= from) || (tt > at && tt > at + ahead) || (this.o.past !== undefined && tt < at - this.o.past)) continue;
      const p = this.pos(tt), q = this.pos(tt + fine), q0 = this.pos(tt - fine);
      if (!p) continue;
      const [x, y] = P(p), a = P(q ?? p), b = P(q0 ?? p);
      let dx = a[0] - b[0], dy = a[1] - b[1];
      const len = Math.hypot(dx, dy) || 1;
      [dx, dy] = [-dy / len, dx / len];
      g.globalAlpha = base * (tt > at ? 0.45 : 1);
      g.lineWidth = Math.max(2, width + 0.6);
      g.beginPath();
      g.moveTo(x - dx * 7, y - dy * 7);
      g.lineTo(x + dx * 7, y + dy * 7);
      g.stroke();
    }
    g.restore();
  }
  /** Where the point is now (exactly at `at`, between samples). */
  private pos_now(at: number): XY | null {
    const s = this.source;
    if (typeof s === 'function') return s(at);
    // (the clock's own state when `at` is the clock: already computed)
    return this.o.at === undefined ? s.xy(s.sim.state.value) : s.xy(s.sim.at(at));
  }
  private future_dash(width: number): number[] {
    // (the dash of a guess, as certainty draws it at 0)
    return [Math.max(3, width * 2.4), width + Math.max(2.5, width * 1.8)];
  }
  private polyline(g: CanvasRenderingContext2D, pts: (XY | null)[], P: (p: XY) => XY): void {
    g.beginPath();
    let pen = false;
    for (const p of pts) {
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
        pen = false;
        continue;
      }
      const [x, y] = P(p);
      if (pen) g.lineTo(x, y);
      else g.moveTo(x, y);
      pen = true;
    }
    g.stroke();
  }
  // the past is a background: labels may sit on it
  override obstacles() {
    return [];
  }
}

/** The newest version of what was read (a derived value's version moves only when it is recomputed, so peek first). */
const sig_of = (deps: Readable<unknown>[]): number => deps.reduce((a, d) => Math.max(a, d instanceof Derived ? (d.peek(), d.version) : d.version), 0);

// ---------------------------------------------------------------- entry
define_thing({
  name: 'trail', says: t('time as matter: equal-time ghosts of the past (spacing is speed), the future dashed', '时间是一种材质：过去留下等时残影（间距就是速度），未来是虚线'),
  zones: ['world', 'figure'], maturity: 'stable', since: '0.2.1', from: 'int/time',
  syntax: "P.add(new Trail({ sim, xy: (s) => [s[0], s[1]] }, { every: 1 / 12, ahead: 1 }))",
  accept: t('the arc between neighbouring ghosts over the time step is the speed at the midpoint (within 2%)', '相邻残影的弧长 ÷ 时间步 = 中点速度（误差 2% 以内）'),
  source: 'packages/engine/src/lib/trail.ts',
});
