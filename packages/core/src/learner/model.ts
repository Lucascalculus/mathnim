// What the learner knows: mastery per skill (BKT) and a spaced review queue.
import type { Skill } from '../schema';
import { bkt_update, DEFAULT_BKT, MASTERY, type BKTParams } from './bkt';
import { quality, schedule, type ReviewItem } from './review';

export interface SkillState {
  p: number;
  attempts: number;
  correct: number;
  last: number;
}
export interface LearnerState {
  skills: Record<string, SkillState>;
  reviews: Record<string, ReviewItem>;
}
/** Where learner state is kept (localStorage in browsers, memory elsewhere). */
export interface Store {
  load(): LearnerState | null;
  save(s: LearnerState): void;
}
export const memory_store = (): Store => {
  let s: LearnerState | null = null;
  return { load: () => s, save: (x) => void (s = JSON.parse(JSON.stringify(x))) };
};
export const local_store = (key = 'mathnim.learner'): Store => ({
  load() {
    try {
      const v = globalThis.localStorage?.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  save(s) {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(s));
    } catch {
      /* storage unavailable: keep in memory only */
    }
  },
});

export interface Observation {
  skill: string;
  /** Question id (for spaced review). */
  item: string;
  correct: boolean;
  hints?: number;
  confidence?: 1 | 2 | 3;
  /** Predictions update review scheduling but not mastery. */
  graded?: boolean;
}

export class LearnerModel {
  state: LearnerState;
  params = new Map<string, BKTParams>();
  constructor(private store: Store = memory_store(), skills: Skill[] = []) {
    this.state = store.load() ?? { skills: {}, reviews: {} };
    this.add_skills(skills);
  }
  add_skills(skills: Skill[]): void {
    for (const s of skills) {
      this.params.set(s.id, { ...DEFAULT_BKT, ...s.bkt });
      this.state.skills[s.id] ??= { p: this.params.get(s.id)!.p_init, attempts: 0, correct: 0, last: 0 };
    }
  }
  mastery(skill: string): number {
    return this.state.skills[skill]?.p ?? DEFAULT_BKT.p_init;
  }
  mastered(skill: string): boolean {
    return this.mastery(skill) >= MASTERY;
  }
  /** Record an attempt. Using hints counts as not-yet-correct for mastery. */
  observe(o: Observation, now = Date.now()): void {
    const params = this.params.get(o.skill) ?? DEFAULT_BKT;
    const s = (this.state.skills[o.skill] ??= { p: params.p_init, attempts: 0, correct: 0, last: 0 });
    if (o.graded !== false) {
      s.p = bkt_update(s.p, o.correct && !(o.hints ?? 0), params);
      s.attempts++;
      if (o.correct) s.correct++;
    }
    s.last = now;
    // predictions are not practice: they are not scheduled for review
    if (o.graded !== false) this.state.reviews[o.item] = schedule(this.state.reviews[o.item], o.item, o.skill, quality(o.correct, o.hints ?? 0, o.confidence), now);
    this.store.save(this.state);
  }
  /** Review items due now, most overdue first. */
  due(now = Date.now()): ReviewItem[] {
    return Object.values(this.state.reviews).filter((r) => r.due <= now).sort((a, b) => a.due - b.due);
  }
  /** Skills whose prerequisites are mastered but which are not yet mastered. */
  ready(skills: Skill[]): Skill[] {
    return skills.filter((s) => !this.mastered(s.id) && (s.prerequisites ?? []).every((p) => this.mastered(p)));
  }
  reset(): void {
    this.state = { skills: {}, reviews: {} };
    for (const [id, p] of this.params) this.state.skills[id] = { p: p.p_init, attempts: 0, correct: 0, last: 0 };
    this.store.save(this.state);
  }
}
