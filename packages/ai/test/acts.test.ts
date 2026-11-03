// The tutor acting in the figure, on the model's side: the manifest in the prompt, ACT lines parsed out of the reply
// (and hidden while it streams), checked against the manifest; the server keeps the manifest, cut to size.
import { describe, expect, it } from 'vitest';
import { act_words, hide_acts, parse_acts, validate_acts, acts_prompt, type FigureManifest } from '../src/acts';
import { parse_op, build_op } from '../src/ops';
import { split_reply } from '../src/tutor';

const M: FigureManifest = {
  things: [{ id: 'best', kind: 'marker', says: 'the best plan within the limits' }, { id: 'wall_line', kind: 'path' }],
  params: [{ name: 'p0', value: 7.1, range: [4, 9.9], doc: "the cart's position now (m)" }, { name: 'v0', value: 1.9, range: [0, 2] }],
};

describe('parse_acts', () => {
  it('takes the ACT lines out of a reply, in order', () => {
    const r = parse_acts('The wall line binds.\n\nACT: point best\nACT: set p0 9.3\nACT: note best the best plan\nACT: reset');
    expect(r.text).toBe('The wall line binds.');
    expect(r.acts).toEqual([{ op: 'point', id: 'best' }, { op: 'set', param: 'p0', to: 9.3 }, { op: 'note', id: 'best', text: 'the best plan' }, { op: 'reset' }]);
  });
  it('reads full-width colons, a minus sign, and reports lines it cannot use', () => {
    const r = parse_acts('x\nACT： set v0 −0.5\nACT: set p0 far\nACT: dance best');
    expect(r.acts).toEqual([{ op: 'set', param: 'v0', to: -0.5 }]);
    expect(r.bad.length).toBe(2);
  });
});

describe('validate_acts', () => {
  it('keeps what the manifest lists, clamps numbers to their range, and says why the rest is left out', () => {
    const { ok, rejected } = validate_acts([{ op: 'point', id: 'best' }, { op: 'point', id: 'Dot12' }, { op: 'set', param: 'p0', to: 12 }, { op: 'set', param: 'grow', to: 1 }], M);
    expect(ok).toEqual([{ op: 'point', id: 'best' }, { op: 'set', param: 'p0', to: 9.9 }]);
    expect(rejected.map((r) => r.why)).toEqual(["no thing 'Dot12' on screen", "'grow' is not something the student can move"]);
  });
  it('does at most three, no repeats, short notes only', () => {
    const many = validate_acts([{ op: 'point', id: 'best' }, { op: 'point', id: 'best' }, { op: 'note', id: 'best', text: 'x'.repeat(61) }, { op: 'point', id: 'wall_line' }, { op: 'set', param: 'v0', to: 1 }, { op: 'reset' }], M);
    expect(many.ok.length).toBe(3);
    expect(many.rejected.map((r) => r.why)).toContain('a repeat');
    expect(many.rejected.some((r) => r.why.includes('1 to 60'))).toBe(true);
  });
});

describe('while the reply streams', () => {
  it('hides ACT lines and a last line that may become one', () => {
    expect(hide_acts('The answer.\nACT: point best')).toBe('The answer.');
    expect(hide_acts('The answer.\nAC')).toBe('The answer.');
    expect(hide_acts('The answer.\nA plan is')).toBe('The answer.\nA plan is');
    expect(split_reply('DIAGNOSIS: x\nThe answer.\nACT: set p0 9').answer).toBe('The answer.');
  });
});

describe('the prompt and the server', () => {
  it('lists the figure and the rules for the tutor, but not on a question the student has not answered', () => {
    expect(acts_prompt({ figure: M })).toContain('ACT: point <id>');
    expect(acts_prompt({ figure: M })).toContain("- p0 = 7.1 (from 4 to 9.9): the cart's position now (m)");
    expect(acts_prompt({ figure: M, unanswered: true })).toBe('');
    const req = build_op('tutor', { question: 'why?', context: { figure: M } });
    expect(JSON.stringify(req.messages)).toContain('FIGURE ON SCREEN');
  });
  it('keeps a manifest from the browser, cut to size', () => {
    const { input } = parse_op({ op: 'tutor', input: { question: 'why?', context: { figure: { things: [{ id: 'x'.repeat(200), kind: 'marker' }, { kind: 'no id' }], params: [{ name: 'p0', value: 'nope', range: [0, 'a'] }] } } } });
    const f = (input as { context: { figure: FigureManifest } }).context.figure;
    expect(f.things.length).toBe(1);
    expect(f.things[0].id.length).toBe(60);
    expect(f.params[0]).toEqual({ name: 'p0', value: 0, range: undefined, step: undefined, doc: undefined });
  });
  it('says what an act did, in the learner’s language', () => {
    expect(act_words({ op: 'set', param: 'p0', to: 9.3 }, M, 'en')).toBe("set the cart's position now (m) to 9.3");
    expect(act_words({ op: 'point', id: 'best' }, M, 'zh')).toBe('指出：the best plan within the limits');
  });
});
