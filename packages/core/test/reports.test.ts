import { describe, expect, it } from 'vitest';
import { EventLog } from '../src/events';
import { LearnerModel } from '../src/learner/model';
import { ReportHub } from '../src/reports';

function hub(step: { id: string; skill?: string } | undefined = { id: 'touch' }) {
  const log = new EventLog();
  const learner = new LearnerModel(undefined, [{ id: 'sk', name: { en: 'skill', zh: '技能' } }]);
  let at = step;
  const h = new ReportHub({ lesson: 'l1', log, learner, skills: ['sk'], step: () => at });
  return { h, log, learner, go: (s: typeof step) => (at = s) };
}

describe('ReportHub', () => {
  it('parses what a frame posts, and refuses what is not a report', () => {
    expect(ReportHub.parse({ mn: 'answer', item: 'm1', correct: true, response: '  top   right ' })).toEqual({ kind: 'answer', item: 'm1', correct: true, response: 'top right' });
    expect(ReportHub.parse({ kind: 'done', score: 3 })).toEqual({ kind: 'done', score: 1 });
    expect(ReportHub.parse({ mn: 'state', text: 'x'.repeat(2000) })).toEqual({ kind: 'state', text: 'x'.repeat(600) });
    for (const bad of [null, 'answer', { mn: 'height', value: 300 }, { mn: 'answer', item: 'm1' }, { mn: 'answer', correct: true }, { mn: 'state', text: '  ' }]) {
      expect(ReportHub.parse(bad)).toBeNull();
    }
  });

  it('counts only the first try at an item for the learner, and logs every try', () => {
    const { h, log, learner } = hub();
    const src = { id: 'frame:place#0', label: 'perceptual map' };
    h.report(src, { kind: 'answer', item: 'm1', correct: false });
    h.report(src, { kind: 'answer', item: 'm1', correct: false });
    h.report(src, { kind: 'answer', item: 'm1', correct: true });
    h.report(src, { kind: 'answer', item: 'm2', correct: true });
    expect(log.events.map((e) => e.verb)).toEqual(['answered', 'interacted', 'interacted', 'answered']);
    expect(log.events[0]).toMatchObject({ lesson: 'l1', step: 'touch', object: 'sk', result: { correct: false }, data: { source: 'frame:place#0', item: 'm1' } });
    expect(learner.state.skills.sk.attempts).toBe(2);
    expect(learner.state.skills.sk.correct).toBe(1);
  });

  it('uses the step’s own skill when it has one', () => {
    const { h, learner } = hub({ id: 'check', skill: 'other' });
    h.report({ id: 'quiz:0' }, { kind: 'answer', item: 'q', correct: true });
    expect(learner.state.skills.other?.attempts).toBe(1);
    expect(learner.state.skills.sk?.attempts ?? 0).toBe(0);
  });

  it('keeps the latest state of each source on the step in view, for the tutor', () => {
    const { h, go } = hub();
    h.report({ id: 'frame:a#0', label: 'A' }, { kind: 'state', text: 'first' });
    h.report({ id: 'frame:a#0', label: 'A' }, { kind: 'state', text: 'second' });
    h.report({ id: 'frame:b#1' }, { kind: 'state', text: 'other' });
    expect(h.states()).toEqual([{ label: 'A', text: 'second' }, { label: undefined, text: 'other' }]);
    go({ id: 'next' });
    expect(h.states()).toEqual([]);
  });

  it('logs a finished task with its score, and tells its listeners', () => {
    const { h, log } = hub();
    const seen: string[] = [];
    const stop = h.on((s, r) => seen.push(`${s.id}:${r.kind}`));
    h.report({ id: 'figure:mgmt_tree#0' }, { kind: 'done', score: 0.5 });
    stop();
    h.report({ id: 'figure:mgmt_tree#0' }, { kind: 'done' });
    expect(log.events[0]).toMatchObject({ verb: 'interacted', result: { score: 0.5 }, data: { source: 'figure:mgmt_tree#0', done: true } });
    expect(seen).toEqual(['figure:mgmt_tree#0:done']);
  });
});
