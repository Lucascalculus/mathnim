import { describe, expect, it } from 'vitest';
import { bkt_update, DEFAULT_BKT } from '../src/learner/bkt';
import { LearnerModel } from '../src/learner/model';
import { quality, schedule } from '../src/learner/review';
import { EventLog } from '../src/events';

describe('learner model', () => {
  it('BKT rises with correct answers and falls with wrong ones', () => {
    let p = DEFAULT_BKT.p_init;
    for (let i = 0; i < 5; i++) p = bkt_update(p, true);
    expect(p).toBeGreaterThan(0.95);
    expect(bkt_update(0.6, false)).toBeLessThan(0.6);
  });
  it('hints count as not yet mastered; predictions do not count', () => {
    const m = new LearnerModel(undefined, [{ id: 's', name: 'S' }]);
    m.observe({ skill: 's', item: 'q1', correct: true, hints: 1 });
    expect(m.mastery('s')).toBeLessThan(DEFAULT_BKT.p_init + 0.2);
    const before = m.mastery('s');
    m.observe({ skill: 's', item: 'q2', correct: false, graded: false });
    expect(m.mastery('s')).toBe(before);
  });
  it('spaced review intervals grow and reset on lapses', () => {
    const now = 0;
    let it = schedule(undefined, 'q', 's', 4, now);
    expect(it.interval).toBe(1);
    it = schedule(it, 'q', 's', 5, now);
    expect(it.interval).toBe(3);
    it = schedule(it, 'q', 's', 4, now);
    expect(it.interval).toBeGreaterThan(6);
    it = schedule(it, 'q', 's', quality(false, 0), now);
    expect(it.interval).toBeLessThan(0.01);
    const m = new LearnerModel(undefined, [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', prerequisites: ['a'] }]);
    expect(m.ready([{ id: 'a', name: 'A' }, { id: 'b', name: 'B', prerequisites: ['a'] }]).map((s) => s.id)).toEqual(['a']);
  });
  it('event log summary', () => {
    const log = new EventLog();
    log.emit({ verb: 'answered', lesson: 'l', result: { correct: false, misconception: 'm' } });
    log.emit({ verb: 'hinted', lesson: 'l' });
    log.emit({ verb: 'answered', lesson: 'l', result: { correct: true } });
    expect(log.summary()).toMatchObject({ answered: 2, correct: 1, hints: 1, misconceptions: { m: 1 } });
  });
});
