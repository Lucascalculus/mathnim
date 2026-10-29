// Learning events (xAPI-like statements): who did what, with which result.
// Every interaction is logged so mastery, analytics and research can be
// computed later; sinks decide where events go.

export type Verb =
  | 'started' | 'completed' | 'viewed' | 'answered' | 'hinted' | 'revealed' | 'explored' | 'interacted' | 'seeked' | 'paused' | 'resumed' | 'replayed' | 'detected'
  // left a step (result.duration_ms: how long it was on screen); asked the tutor (data: the question and its answer, words only);
  // set a preference (object: what, data.value)
  | 'left' | 'asked' | 'set';

export interface LearningEvent {
  t: number; // epoch ms
  verb: Verb;
  lesson: string;
  step?: string;
  object?: string;
  result?: {
    correct?: boolean;
    score?: number;
    response?: unknown;
    misconception?: string;
    confidence?: number;
    hints?: number;
    duration_ms?: number;
    /** Stars for a finished world (game flow). */
    stars?: number;
    attempt?: number;
  };
  vars?: Record<string, number>;
  data?: Record<string, unknown>;
}
export type Sink = (e: LearningEvent) => void;

export class EventLog {
  events: LearningEvent[] = [];
  private sinks: Sink[] = [];
  add_sink(s: Sink): () => void {
    this.sinks.push(s);
    return () => (this.sinks = this.sinks.filter((x) => x !== s));
  }
  emit(e: Omit<LearningEvent, 't'> & { t?: number }): LearningEvent {
    const ev = { t: Date.now(), ...e } as LearningEvent;
    this.events.push(ev);
    for (const s of this.sinks) s(ev);
    return ev;
  }
  /** Summary for dashboards: per step attempts, correctness, time, misconceptions. */
  summary(): { answered: number; correct: number; hints: number; misconceptions: Record<string, number>; time_ms: number } {
    const ans = this.events.filter((e) => e.verb === 'answered');
    const mis: Record<string, number> = {};
    // misconceptions shown by answers and by what the learner did in worlds
    for (const e of this.events) if ((e.verb === 'answered' || e.verb === 'detected') && e.result?.misconception) mis[e.result.misconception] = (mis[e.result.misconception] ?? 0) + 1;
    const t0 = this.events[0]?.t ?? 0, t1 = this.events[this.events.length - 1]?.t ?? 0;
    return {
      answered: ans.length,
      correct: ans.filter((e) => e.result?.correct).length,
      hints: this.events.filter((e) => e.verb === 'hinted').length,
      misconceptions: mis,
      time_ms: t1 - t0,
    };
  }
}

/** Persist events in localStorage (the dashboard reads them back with load_events). */
export function local_event_sink(key = 'mathnim.events', max = 5000): Sink {
  return (e) => {
    try {
      const all: LearningEvent[] = JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]');
      all.push(e);
      globalThis.localStorage?.setItem(key, JSON.stringify(all.slice(-max)));
    } catch {
      /* storage full or unavailable */
    }
  };
}
export function load_events(key = 'mathnim.events'): LearningEvent[] {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}
