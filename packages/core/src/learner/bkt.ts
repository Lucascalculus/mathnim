// Bayesian knowledge tracing: the probability that a skill is mastered,
// updated after each graded attempt (Corbett & Anderson, 1995).

export interface BKTParams {
  /** Prior probability the skill is already known. */
  p_init: number;
  /** Probability of learning at each opportunity. */
  p_learn: number;
  /** Probability of a wrong answer despite knowing. */
  p_slip: number;
  /** Probability of a right answer without knowing. */
  p_guess: number;
}
export const DEFAULT_BKT: BKTParams = { p_init: 0.2, p_learn: 0.15, p_slip: 0.1, p_guess: 0.2 };
export const MASTERY = 0.95;

/** Posterior after observing one attempt, then the learning transition. */
export function bkt_update(p: number, correct: boolean, o: BKTParams = DEFAULT_BKT): number {
  const post = correct
    ? (p * (1 - o.p_slip)) / (p * (1 - o.p_slip) + (1 - p) * o.p_guess)
    : (p * o.p_slip) / (p * o.p_slip + (1 - p) * (1 - o.p_guess));
  return post + (1 - post) * o.p_learn;
}
/** Probability the next attempt is correct. */
export const bkt_predict = (p: number, o: BKTParams = DEFAULT_BKT): number => p * (1 - o.p_slip) + (1 - p) * o.p_guess;
