// Guess, then see (猜，再看): the learner commits to a guess before the figure shows the answer, and the distance
// between the two is drawn and said. The benefit of predicting comes from the surprise (Kim, Reinecke & Hullman 2017;
// Brod 2018), so the gap is never left for the learner to judge by eye: it is a mark with its size in words.
//
// A guess is a hollow ring the hand drags (hollow: a guess is not established, the same grammar as certainty).
// Letting go commits it, once: there is no button, letting go is the commitment. The figure decides what showing
// the answer is (a throw that lands, a fan of secants that develops, a truth that converges from the guess) through
// on_commit; the lesson hears the guess (an answer: right within the tolerance, the value the learner gave). A replay
// starts it again: the guess and whether it was committed are params, so seeking back undoes both.
//
//   const g = guess(fig, stage, fig.param('land', 1, { range: [0, 6] }), { id: 'landing', role: 'noun:ball',
//     at: (v) => [v, 0], to: (d) => d[0], truth: () => range, tolerance: 0.15, says: t('where it lands', '落点') });
//   g.on_commit(() => { sim.restart(); sim.play(); });
//   stage.add(new Gap(() => [g.guessed.value, -0.2], () => [range, -0.2], { shown, text: () => '0.4 m short' }));
import type { Figure } from './figure';
import type { XY } from './geom';
import { Mark, Marker, type Handle, type Plot } from './kinds';
import { call, type Step } from './script';
import type { Sim } from './sim';
import { derive, read, type Derived, type Param, type Val } from './state';
import { font_css, font_of, text_width, type L10n } from './text';
import type { DrawEnv, Style } from './thing';

export interface GuessSpec {
  id: string;
  /** The noun guessed (its colour). */
  role: string;
  /** What the guess is, for the mirror and the tutor. */
  says: L10n;
  /** Where a guess of v is drawn (data coordinates). */
  at: (v: number) => XY;
  /** The guess a pointer at data point d means. */
  to: (d: XY) => number;
  /** The true value. */
  truth: Val<number>;
  /** How far off still counts as right (in the value's units). */
  tolerance: number;
  /** The ring's radius (px, default 8). */
  r?: number;
}
export interface Guess {
  /** What the hand is setting now. */
  value: Param<number>;
  /** 1 once the learner has let go of a guess (then it stays until a replay). */
  committed: Param<number>;
  /** The guess: what the hand set while it is being made, what was let go of after. */
  guessed: Derived<number>;
  /** Guess − truth. */
  error: Derived<number>;
  right: Derived<boolean>;
  ring: Marker;
  handle: Handle;
  on_commit(f: () => void): void;
  /**
   * A script step that does nothing but names the guess's params, so a seek or a replay puts them back (the script
   * resets what it touches): the first step of a figure with a guess. Pass more params (a sim's clock) to reset too.
   */
  fresh(...more: Param<number>[]): Step;
}

/** A guess of a number on a plot: a hollow ring the hand drags, committed when it lets go (once). */
export function guess(fig: Figure, P: Plot, value: Param<number>, spec: GuessSpec): Guess {
  const committed = fig.param(`${spec.id}.committed`, 0, { range: [0, 1] });
  const locked = fig.param(`${spec.id}.guessed`, value.peek(), value.spec.range ? { range: value.spec.range } : {});
  const guessed = derive(() => (committed.value ? locked.value : value.value), `${spec.id} guessed`);
  const error = derive(() => guessed.value - read(spec.truth), `${spec.id} error`);
  const right = derive(() => Math.abs(error.value) <= spec.tolerance, `${spec.id} right`);
  const hooks: (() => void)[] = [];
  const ring = P.add(new Marker(() => spec.at(guessed.value), { id: spec.id, role: spec.role, certain: 0, r: spec.r ?? 8, says: spec.says }));
  const handle = fig.handle(P, value, null, {
    id: `${spec.id}_handle`, says: spec.says,
    at: () => P.P(spec.at(guessed.peek())),
    // (once committed the hand cannot move it: a guess is made once)
    to: (d) => [committed.peek() ? value.peek() : spec.to(d)],
    on_end: () => {
      if (committed.peek() || Object.is(value.peek(), locked.peek())) return; // (let go without moving it: no guess yet)
      locked.set(value.peek(), true);
      committed.set(1, true);
      const e = error.peek();
      fig.tell({ kind: 'answer', item: spec.id, correct: Math.abs(e) <= spec.tolerance, response: String(+value.peek().toFixed(4)) });
      for (const f of hooks) f();
    },
  });
  // (once made, the guess has no glass on it: nothing there to take hold of; a replay brings it back)
  const look0 = handle.o.look;
  committed.listeners.add((v) => { handle.o.look = v ? 'none' : look0; });
  return { value, committed, guessed, error, right, ring, handle, on_commit: (f) => void hooks.push(f), fresh: (...more) => call(0, () => {}, [value, committed, locked, ...more]) };
}

/** A clock for a motion in explore (a reveal): `t` runs 0 → 1 over `dur` seconds once played; a sim underneath, so it seeks and replays. */
export function timer(fig: Figure, id: string, dur: number): { sim: Sim<number>; t: Derived<number>; play(): void } {
  const sim = fig.sim({ id, inputs: () => 0, start: () => [0], deriv: (_y, _t, _i, o) => { o[0] = 0; }, dt: 1 / 60, max_t: dur });
  const t = derive(() => Math.min(1, sim.clock.value / dur), `${id}.t`);
  return { sim, t, play: () => { sim.restart(); sim.play(); } };
}

/**
 * A distance drawn and said: a line between two points of a plot with a short stroke across each end, and its size
 * in words beside the middle. `shown` brings it in (0..1); it belongs with a guess (how far off) or a residual.
 */
export class Gap extends Mark {
  kind = 'gap';
  private words = '';
  constructor(public a: Val<XY | null>, public b: Val<XY | null>, public o: { id?: string; role?: string; says?: L10n; z?: number; style?: Style; shown: Val<number>; text: Val<string>; side?: 1 | -1 }) {
    super({ ...o, z: o.z ?? 3.2 });
  }
  override text(): string {
    return this.words;
  }
  draw(env: DrawEnv): void {
    const s = Math.max(0, Math.min(1, read(this.o.shown))), A = read(this.a), B = read(this.b);
    this.words = '';
    if (s < 0.01 || !A || !B) {
      this.box = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const g = env.g, [ax, ay] = this.plot.P(A), [bx, by] = this.plot.P(B);
    let nx = -(by - ay), ny = bx - ax;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    // (the words on the side away from the plot's inside by default: below a horizontal gap, right of a vertical one)
    const side = this.o.side ?? (Math.abs(ny) > Math.abs(nx) ? (ny > 0 ? 1 : -1) : nx > 0 ? 1 : -1);
    g.save();
    g.globalAlpha *= s;
    g.strokeStyle = this.color;
    g.lineWidth = this.style.width ?? 1.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    for (const [x, y] of [[ax, ay], [bx, by]]) {
      g.moveTo(x - nx * 6, y - ny * 6);
      g.lineTo(x + nx * 6, y + ny * 6);
    }
    g.stroke();
    const words = read(this.o.text);
    this.words = words;
    const f = font_of('caption', { weight: 600 }), w = text_width(words, f);
    // the words beside the middle: under (or over) a gap that runs across, starting just right (or left) of one that
    // runs up, on a little paper so the lines under them do not cross them
    const across = Math.abs(ny) >= Math.abs(nx), off = across ? f.size * 0.9 : 10;
    const ox = (ax + bx) / 2 + nx * side * off, oy = (ay + by) / 2 + ny * side * off;
    const left = across ? ox - w / 2 : nx * side > 0 ? ox : ox - w, top = oy - f.size * 0.6;
    g.globalAlpha = s * 0.88;
    g.fillStyle = env.look.palette.bg;
    g.fillRect(left - 4, top - 2, w + 8, f.size * 1.2 + 4);
    g.globalAlpha = s;
    g.font = font_css(f);
    g.fillStyle = this.text_color;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(words, left, oy);
    g.restore();
    const x0 = Math.min(ax, bx, left) - 6, x1 = Math.max(ax, bx, left + w) + 6, y0 = Math.min(ay, by, top) - 6, y1 = Math.max(ay, by, top + f.size * 1.2) + 6;
    this.box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
}
