// The lesson doctor's lint for text pages and bilingual lessons.
import { describe, expect, it } from 'vitest';
import type { Lesson } from '@mathnim/core';
import { lint_lesson_text, tex_english, type LintDeps } from '../tools/text_lint';

const deps: LintDeps = {
  figure_exists: (src) => src === 'ft/ok.svg',
  check_visual: (name, params) => (name === 'linear_map' ? { errors: params && 'nope' in params ? ['nope: linear_map has no such parameter'] : [], notes: [], explorable: true } : null),
  tex_error: (tex) => (tex.includes('\\frac{') && !/\\frac\{[^}]*\}\{/.test(tex) ? 'Missing argument for \\frac' : null),
};
const base = (steps: Lesson['steps'], extra: Partial<Lesson> = {}): Lesson => ({ id: 'l', title: { en: 'A lesson', zh: '一课' }, skills: [], steps, ...extra });
const msgs = (l: Lesson) => lint_lesson_text(l, deps).map((i) => `${i.severity}: ${i.where}: ${i.message}`);

describe('text lint', () => {
  it('passes a clean bilingual page', () => {
    const l = base([{ id: 'r', kind: 'read', blocks: [
      { type: 'p', text: { en: 'A claim with a source[^a].', zh: '一个有出处的说法[^a]。' } },
      { type: 'figure', src: 'ft/ok.svg', alt: { en: 'A diagram', zh: '一张图' }, credit: 'original' },
      { type: 'visual', name: 'linear_map', params: { A: [[1, 0], [0, 1]] }, explore: true },
      { type: 'code', lang: 'python', code: 'x = 1' },
      { type: 'cite', key: 'a', text: 'Someone (2020)', url: 'https://example.org' },
    ] }]);
    expect(msgs(l)).toEqual([]);
  });
  it('finds a missing language, untranslated prose and bad TeX', () => {
    const l = base([{ id: 'r', kind: 'read', blocks: [
      { type: 'p', text: { en: 'Only English here.', zh: '' } },
      { type: 'p', text: 'This sentence was never translated.' },
      { type: 'math', tex: '\\frac{1}' },
      { type: 'p', text: { en: 'Unclosed $x', zh: '没有闭合 $x' } },
    ] }]);
    const m = msgs(l).join('\n');
    expect(m).toContain('error: steps.r.blocks[0].text: the Chinese text is missing');
    expect(m).toContain('warning: steps.r.blocks[1].text: plain English text in a bilingual lesson');
    expect(m).toContain('error: steps.r.blocks[2]: TeX does not render: Missing argument for \\frac');
    expect(m).toContain('unclosed $');
  });
  it('checks figures, visuals, code and footnotes', () => {
    const l = base([{ id: 'r', kind: 'read', blocks: [
      { type: 'figure', src: 'ft/missing.svg', alt: 'x' },
      { type: 'visual', name: 'no_such_visual' },
      { type: 'visual', name: 'linear_map', params: { nope: 1 } },
      { type: 'code', lang: 'python', code: '  ', tabs: [{ label: 'TRL', lang: 'python', code: '' }] },
      { type: 'table', head: ['a', 'b'], rows: [['1']] },
      { type: 'p', text: 'see[^ghost]' },
    ] }]);
    const m = msgs(l).join('\n');
    expect(m).toContain('figure not found: public/ft/missing.svg');
    expect(m).toContain("no visual named 'no_such_visual' is registered");
    expect(m).toContain('linear_map: nope: linear_map has no such parameter');
    expect(m).toContain('error: steps.r.blocks[3]: empty code block');
    expect(m).toContain('error: steps.r.blocks[3].tabs[0]: empty code tab');
    expect(m).toContain('row has 1 cells, the header 2');
    expect(m).toContain('footnote [^ghost] has no cite block');
  });
  it('checks both files of a per-language figure', () => {
    const l = base([{ id: 'r', kind: 'read', blocks: [{ type: 'figure', src: { en: 'ft/ok.svg', zh: 'ft/missing.zh.svg' }, alt: { en: 'A', zh: '图' }, credit: 'original' }] }]);
    expect(msgs(l)).toEqual(['error: steps.r.blocks[0]: figure not found: public/ft/missing.zh.svg']);
  });
  it('checks derivation blanks and code notes', () => {
    const l = base([
      { id: 'd1', kind: 'derive', lines: [{ tex: 'a' }, { tex: 'b' }], blank: { line: 2, answer: 'x+1' } },
      { id: 'd2', kind: 'derive', lines: [{ tex: 'a' }], blank: { line: 0, answer: 'x+(' } },
      { id: 'd3', kind: 'derive', lines: [{ tex: 'a' }], blank: { line: 0, answer: 'x^2', variables: ['x'] } },
      { id: 'c', kind: 'code', lang: 'python', code: 'a\nb\nc\n', notes: [{ lines: [2, 3], text: 'ok' }, { lines: [3, 4], text: 'too far' }, { lines: [0, 1], text: 'zero' }] },
    ], { title: 'English only' });
    const m = msgs(l).join('\n');
    expect(m).toContain('blank.line 2 is not a line (0-based: 0..1)');
    expect(m).toContain("the answer 'x+(' does not parse");
    expect(m).not.toContain('steps.d3');
    expect(m).toContain('lines [3, 4] are not within the code\'s lines 1..3');
    expect(m).toContain('lines [0, 1] are not within');
    expect(m).not.toContain('notes[0]');
  });
  it('checks text questions and cases', () => {
    const q = (id: string, group?: any, extra: any = {}) => ({ id, kind: 'checkpoint', skill: 's', prompt: 'Q', group, question: { type: 'text', rubric: { key_points: ['a'], model_answer: 'm', ...extra } } }) as any;
    const l = base([q('a', { id: 'g', title: 'Case' }), { id: 's', kind: 'read', blocks: [{ type: 'p', text: 'x' }] }, q('b', { id: 'g', title: 'Case' }, { min_points: 3 })], { title: 'English only' });
    const m = msgs(l).join('\n');
    expect(m).toContain('min_points 3 is not within 1..1');
    expect(m).toContain('questions of the case are not consecutive (s in between)');
    expect(m).toContain("case 'Case' has no brief");
  });
  it('warns when a text page or a question carries narration (only scenes and worlds are voiced)', () => {
    const l = base([{ id: 'r', kind: 'read', narration: 'Read this aloud.', blocks: [{ type: 'p', text: 'x' }] }], { title: 'Old lesson' });
    expect(msgs(l)).toEqual(['warning: steps.r.narration: a read step is not voiced (narration is for scenes): its narration is never spoken']);
    const q = { id: 'q', kind: 'checkpoint', skill: 's', narration: 'Which one?', prompt: 'Q', question: { type: 'choice', options: [{ id: 'a', label: 'A', correct: true }] } } as any;
    expect(msgs(base([q], { title: 'Old lesson' }))[0]).toContain('questions are only voiced in game lessons');
    expect(msgs(base([q], { title: 'Old lesson', mode: 'game' }))).toEqual([]); // the game character speaks it
  });
  it('warns about English words in shared TeX of a bilingual lesson', () => {
    expect(tex_english('\\text{loss}_{\\text{SFT}} = \\mathrm{bf16} + \\operatorname*{arg\\,max} + \\pi_{\\text{ref}} + \\text{pass@}k + \\text{chosen}')).toEqual(['loss', 'chosen']);
    const l = base([
      { id: 'r', kind: 'read', blocks: [
        { type: 'math', tex: 'L = -\\log \\sigma(\\text{margin})' },
        { type: 'p', text: { en: 'Here $\\text{gap}$ is fine', zh: '这里 $\\text{差距}$ 按语言分开' } },
        { type: 'p', text: 'shared: $\\text{reward} = 1$ (not translated here)' },
      ] },
      { id: 'd', kind: 'derive', lines: [{ tex: '\\text{win rate} = 0.5', why: { en: 'w', zh: '为什么' } }] },
    ]);
    const m = msgs(l).filter((x) => x.includes('English words in the formula'));
    expect(m).toEqual([
      expect.stringContaining('steps.r.blocks[2].text: Chinese learners see these English words in the formula: move them into the `why` text or the prose (or use a symbol): reward'),
      expect.stringContaining('steps.r.blocks[0]: Chinese learners see these English words in the formula: move them into the `why` text or the prose (or use a symbol): margin'),
      expect.stringContaining('steps.d.lines[0]: Chinese learners see these English words in the formula: move them into the `why` text or the prose (or use a symbol): win, rate'),
    ]);
  });
  it('leaves English-only lessons alone', () => {
    expect(msgs(base([{ id: 'r', kind: 'read', blocks: [{ type: 'p', text: 'Plain English is fine here.' }] }], { title: 'Old lesson' }))).toEqual([]);
  });
});
