// Spaced review (SM-2 with learning steps): each practised item gets a due
// date; correct, confident recalls push it further out.

export interface ReviewItem {
  id: string;
  skill: string;
  /** Days until the next review after the last one. */
  interval: number;
  ease: number;
  reps: number;
  due: number; // epoch ms
  last: number; // epoch ms
  lapses: number;
}
const DAY = 86400000;

/**
 * Quality 0..5 from an attempt: wrong -> 1; right with hints or low confidence -> 3;
 * right -> 4; right, confident, no hints -> 5.
 */
export function quality(correct: boolean, hints: number, confidence?: 1 | 2 | 3): number {
  if (!correct) return confidence === 3 ? 0 : 1;
  if (hints > 0 || confidence === 1) return 3;
  return confidence === 3 ? 5 : 4;
}

export function schedule(item: ReviewItem | undefined, id: string, skill: string, q: number, now = Date.now()): ReviewItem {
  const it: ReviewItem = item ? { ...item } : { id, skill, interval: 0, ease: 2.5, reps: 0, due: now, last: now, lapses: 0 };
  if (q < 3) {
    it.reps = 0;
    it.lapses++;
    it.interval = 10 / 1440; // again in 10 minutes
  } else {
    it.reps++;
    it.interval = it.reps === 1 ? 1 : it.reps === 2 ? 3 : Math.round(it.interval * it.ease);
    it.ease = Math.max(1.3, it.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }
  it.last = now;
  it.due = now + it.interval * DAY;
  return it;
}
