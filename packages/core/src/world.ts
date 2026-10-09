// A world: an interactive step with goals, detectors, stars and narration that
// reacts to what the learner does. WorldSession holds the logic without any
// player or DOM, so presenters and tests drive it the same way: interactions
// and semantic events go in, findings / reached goals / lines come out.
import type { Scene } from 'manim-web';
import type { L10n } from './content';
import type { LessonContext } from './schema';

/** Something that happened in a world, in the lesson's own terms (e.g. 'slices_changed' {n: 24}). */
export interface SemanticEvent {
  type: string;
  data?: Record<string, unknown>;
  t: number;
}
/** What a detector concluded from an event. */
export interface Finding {
  kind: 'goal' | 'misconception' | 'progress';
  /** Goal id, misconception id (from the lesson's list), or a progress label. */
  id: string;
  message?: L10n;
}
/** Given to a world's setup: report events and share state with goals and detectors. */
export interface WorldApi {
  emit(type: string, data?: Record<string, unknown>): void;
  state: Record<string, unknown>;
}
export interface Goal {
  id: string;
  check: (scene: Scene, ctx: LessonContext, world: WorldApi) => boolean;
  message?: L10n;
}
export interface Detector {
  id: string;
  on: (e: SemanticEvent, world: WorldApi, ctx: LessonContext) => Finding | null;
}
/** A line of narration and when it is said. */
export interface Line {
  /** Fixed text (each language is recorded once). */
  text: L10n;
  when: 'enter' | 'idle' | 'goal' | { event: string } | { finding: string };
  /** Say it at most once per visit (default true). */
  once?: boolean;
  /** Only when this holds (e.g. pick the ending that matches the learner's bet). */
  if?: (world: WorldApi, ctx: LessonContext) => boolean;
  style?: 'playful' | 'calm';
}
export interface WorldStats {
  ms: number;
  interactions: number;
  hints: number;
  misconceptions: number;
}
/** Stars for a finished world (1-3). */
export type StarRule = (stats: WorldStats, world: WorldApi, ctx: LessonContext) => 1 | 2 | 3;

export type WorldOutput =
  | { type: 'semantic'; event: SemanticEvent }
  | { type: 'finding'; finding: Finding }
  | { type: 'goal'; goal: Goal; message: L10n; final: boolean; stars?: 1 | 2 | 3 }
  | { type: 'line'; line: Line };

export interface WorldSpec {
  goals?: Goal[];
  detectors?: Detector[];
  lines?: Line[];
  stars?: StarRule;
  /** Seconds without interaction before 'idle' lines (default 15). */
  idle_s?: number;
}

/** The message of a goal that has none. */
export const FOUND_IT: L10n = { en: 'You found it.', zh: '找到了！' };

export class WorldSession {
  readonly api: WorldApi;
  readonly reached = new Set<string>();
  readonly found = new Set<string>();
  interactions = 0;
  hints = 0;
  done = false;
  private said = new Set<Line>();
  private last_input: number;
  private t0: number;
  private idle_timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private spec: WorldSpec,
    private scene: Scene,
    private ctx: LessonContext,
    private out: (o: WorldOutput) => void,
    private now: () => number = () => performance.now(),
  ) {
    this.t0 = this.last_input = now();
    this.api = { state: {}, emit: (type, data) => this.event({ type, data, t: this.now() }) };
  }

  /** Say the 'enter' lines and start watching for idleness. */
  start(): void {
    this.say((l) => l.when === 'enter');
    if (this.spec.lines?.some((l) => l.when === 'idle')) {
      const idle = (this.spec.idle_s ?? 15) * 1000;
      this.idle_timer = setInterval(() => this.tick(idle), 1000);
    }
  }
  stop(): void {
    if (this.idle_timer) clearInterval(this.idle_timer);
    this.idle_timer = null;
  }
  /** Check for idleness (called every second by start(); tests call it directly). */
  tick(idle_ms = (this.spec.idle_s ?? 15) * 1000): void {
    if (!this.done && this.now() - this.last_input >= idle_ms) {
      this.last_input = this.now(); // one idle line per quiet period
      this.say((l) => l.when === 'idle');
    }
  }
  /** The learner changed something in the world (a drag, a slider). */
  input(): void {
    this.interactions++;
    this.last_input = this.now();
    this.check_goals();
  }
  /** A semantic event from the world's own code. */
  event(e: SemanticEvent): void {
    this.last_input = this.now();
    this.out({ type: 'semantic', event: e });
    this.say((l) => typeof l.when === 'object' && 'event' in l.when && l.when.event === e.type);
    for (const d of this.spec.detectors ?? []) {
      const f = d.on(e, this.api, this.ctx);
      if (f) this.finding(f);
    }
    this.check_goals();
  }
  private finding(f: Finding): void {
    const key = `${f.kind}:${f.id}`;
    if (this.found.has(key)) return;
    this.found.add(key);
    this.out({ type: 'finding', finding: f });
    this.say((l) => typeof l.when === 'object' && 'finding' in l.when && l.when.finding === f.id);
  }
  check_goals(): void {
    const goals = this.spec.goals ?? [];
    for (const g of goals) {
      if (this.reached.has(g.id) || !g.check(this.scene, this.ctx, this.api)) continue;
      this.reached.add(g.id);
      const final = goals.every((x) => this.reached.has(x.id));
      let stars: 1 | 2 | 3 | undefined;
      if (final) {
        this.done = true;
        stars = this.spec.stars?.(this.stats(), this.api, this.ctx);
        this.stop();
      }
      this.out({ type: 'goal', goal: g, message: g.message ?? FOUND_IT, final, stars });
      if (final) this.say((l) => l.when === 'goal');
    }
  }
  stats(): WorldStats {
    return { ms: this.now() - this.t0, interactions: this.interactions, hints: this.hints, misconceptions: [...this.found].filter((k) => k.startsWith('misconception:')).length };
  }
  private say(match: (l: Line) => boolean): void {
    for (const l of this.spec.lines ?? []) {
      if (!match(l) || ((l.once ?? true) && this.said.has(l)) || (l.if && !l.if(this.api, this.ctx))) continue;
      this.said.add(l);
      this.out({ type: 'line', line: l });
    }
  }
}

/** Stars from the time taken: under `fast` seconds 3, under `ok` seconds 2, else 1. */
export function stars_by_time(fast: number, ok: number): StarRule {
  return (s) => (s.ms <= fast * 1000 ? 3 : s.ms <= ok * 1000 ? 2 : 1);
}
