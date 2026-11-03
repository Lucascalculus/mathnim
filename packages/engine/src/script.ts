// Time. A figure's script says what happens in what order, by intent (reveal, converge, travel …); how each intent
// moves comes from the look's motion table. A scripted change follows the exact step response of a damped spring, so
// it is both natural and a pure function of time: seeking to any moment gives exactly the state at that moment.
// Beats (§ in the narration) split the script into sections that wait for the voice.
import { look } from '@mathnim/look';
import type { Param } from './state';
import type { Thing } from './thing';

/** Step response of a spring (response T s, damping ζ) at time t: 0 → 1. */
export function spring_step(t: number, T: number, zeta: number): number {
  if (t <= 0) return 0;
  const w0 = (2 * Math.PI) / T;
  if (zeta >= 1) return 1 - (1 + w0 * t) * Math.exp(-w0 * t);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
}
/** How long a spring takes to settle within 0.5 % (and stay there). */
export function settle_time(T: number, zeta: number): number {
  let last = 0;
  for (let t = 0; t < 10 * T; t += T / 200) if (Math.abs(1 - spring_step(t, T, zeta)) > 0.005) last = t;
  return last + T / 200;
}
const settle_cache = new Map<string, number>();
function intent_of(name: string): { T: number; zeta: number; dur: number; reduced: 'instant' | 'fade'; curve: 'spring' | 'ease' } {
  const m = look().motion[name] ?? look().motion.reveal, key = `${m.response}|${m.damping}`;
  let dur = settle_cache.get(key);
  if (dur === undefined) settle_cache.set(key, (dur = settle_time(m.response, m.damping)));
  return { T: m.response, zeta: m.damping, dur, reduced: m.reduced, curve: m.curve ?? 'spring' };
}
/** Slow in, slow out, over the whole time (a logistic curve, normalised to run 0 → 1). */
export function ease_in_out(u: number, k = 10): number {
  const s = (x: number) => 1 / (1 + Math.exp(-x));
  return (s(k * (u - 0.5)) - s(-k / 2)) / (s(k / 2) - s(-k / 2));
}

export type Step =
  | { kind: 'reveal'; things: Thing[]; intent: string; dur?: number }
  | { kind: 'hide'; things: Thing[]; intent: string; dur?: number }
  | { kind: 'set'; param: Param<number>; to: number; intent: string; dur?: number }
  | { kind: 'wait'; s: number }
  | { kind: 'beat' }
  | { kind: 'together'; steps: Step[] }
  | { kind: 'call'; f: (u: number) => void; dur: number };

/** Show things (opacity 0 → 1). */
export const reveal = (...things: (Thing | { things(): Thing[] })[]): Step => ({ kind: 'reveal', things: flat(things), intent: 'reveal' });
export const hide = (...things: (Thing | { things(): Thing[] })[]): Step => ({ kind: 'hide', things: flat(things), intent: 'reveal' });
/** Move a param to a value with an intent's motion (travel by default). */
export const set = (param: Param<number>, to: number, intent = 'travel', dur?: number): Step => ({ kind: 'set', param, to, intent, dur });
export const wait = (s: number): Step => ({ kind: 'wait', s });
/** The same step taking `dur` seconds (each part of a together(), too): its motion is stretched to fill the time. */
export function over(dur: number, s: Step): Step {
  if (s.kind === 'together') return { ...s, steps: s.steps.map((x) => over(dur, x)) };
  if (s.kind === 'reveal' || s.kind === 'hide' || s.kind === 'set') return { ...s, dur };
  return s;
}
/** A beat of the narration: the next section starts here (and may wait for the voice). */
export const beat = (): Step => ({ kind: 'beat' });
/** Steps that run at the same time. */
export const together = (...steps: Step[]): Step => ({ kind: 'together', steps });
const flat = (xs: (Thing | { things(): Thing[] })[]): Thing[] => xs.flatMap((x) => ('things' in x && typeof (x as { things?: unknown }).things === 'function' && !('kind' in x && 'draw' in x) ? (x as { things(): Thing[] }).things() : [x as Thing]));

interface Action {
  t0: number;
  dur: number;
  apply(u: number): void;
}

/** A compiled script: actions on a clock, sections, and every param it touches with its starting value. */
export class Timeline {
  actions: Action[] = [];
  /** Start times of sections 2, 3, … (beats). */
  sections: number[] = [];
  duration = 0;
  /** What happens when, in words (tools/beats shows it per section). */
  log: { t0: number; dur: number; what: string }[] = [];
  private initial: { p: Param<number>; v: number }[] = [];
  private opacity0 = new Map<Thing, number>();

  constructor(steps: Step[], all_things: Thing[]) {
    const touched = new Set<Param<number>>();
    const revealed = new Set<Thing>();
    const walk = (st: Step[]) => st.forEach(function w(s: Step): void {
      if (s.kind === 'set') touched.add(s.param);
      if (s.kind === 'reveal') for (const t of s.things) revealed.add(t);
      if (s.kind === 'together') s.steps.forEach(w);
    });
    walk(steps);
    this.initial = [...touched].map((p) => ({ p, v: p.peek() }));
    // things revealed by the script start hidden; the rest start shown
    for (const t of all_things) if (revealed.has(t)) t.opacity.set(0);
    this.opacity0 = new Map(all_things.map((t) => [t, t.opacity.peek()]));
    // lay the steps out in time, recording each change's starting value
    let t = 0;
    const names = (ts: Thing[]) => ts.slice(0, 4).map((x) => x.id).join(', ') + (ts.length > 4 ? ` +${ts.length - 4}` : '');
    const plan = (s: Step, at: number): number => {
      const reduced = look().reduced_motion;
      if (s.kind === 'wait') {
        this.log.push({ t0: at, dur: s.s, what: `wait ${s.s.toFixed(1)} s` });
        return s.s;
      }
      if (s.kind === 'beat') {
        this.sections.push(at);
        return 0;
      }
      if (s.kind === 'together') return Math.max(0, ...s.steps.map((x) => plan(x, at)));
      if (s.kind === 'call') {
        this.actions.push({ t0: at, dur: s.dur, apply: s.f });
        return s.dur;
      }
      const m = intent_of(s.intent);
      const dur = reduced && m.reduced === 'instant' ? 0.001 : s.dur ?? m.dur;
      this.log.push({ t0: at, dur, what: s.kind === 'set' ? `${s.intent} ${s.param.name || 'param'} → ${+s.to.toFixed(3)}` : `${s.kind}(${names(s.things)})` });
      // a motion given its own time fills it: the spring is slowed or sped up to settle at the end (an 'ease'
      // intent runs slow-in slow-out over the whole time)
      const T = m.T * (dur / m.dur), end = Math.max(1e-6, spring_step(dur, T, m.zeta));
      const ease = (u: number) => (dur <= 0.001 || u >= 1 ? 1 : m.curve === 'ease' ? ease_in_out(u) : spring_step(u * dur, T, m.zeta) / end);
      if (s.kind === 'set') {
        const from = s.param.peek(), to = s.to, p = s.param;
        this.actions.push({ t0: at, dur, apply: (u) => p.set(from + (to - from) * ease(u), true) });
        p.set(to, true); // later steps start from here
      } else {
        const show = s.kind === 'reveal';
        for (const th of s.things) {
          const from = th.opacity.peek(), to = show ? 1 : 0;
          this.actions.push({ t0: at, dur, apply: (u) => th.opacity.set(from + (to - from) * Math.min(1, ease(u))) });
          th.opacity.set(to);
        }
      }
      return dur;
    };
    for (const s of steps) t += plan(s, t);
    this.duration = t;
    // back to the start
    for (const { p, v } of this.initial) p.set(v, true);
    for (const [th, v] of this.opacity0) th.opacity.set(v);
    // (stable: actions that start together keep the order they were written in)
    this.actions = this.actions.map((a, i) => [a, i] as const).sort((x, y) => x[0].t0 - y[0].t0 || x[1] - y[1]).map(([a]) => a);
  }
  /** Put every param and opacity in its state at time t (a pure function of t). */
  at(t: number): void {
    for (const { p, v } of this.initial) p.set(v, true);
    for (const [th, v] of this.opacity0) th.opacity.set(v);
    for (const a of this.actions) {
      if (a.t0 > t) break;
      a.apply(a.dur <= 0 ? 1 : Math.min(1, (t - a.t0) / a.dur));
    }
  }
}
