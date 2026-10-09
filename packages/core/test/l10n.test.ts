// Bilingual lessons and text pages without a UI: L10n resolution, the runtime
// emitting texts in the learner's language, derivation blanks, free-text
// answers, cases, and the walkers the doctor and narration tool use.
import { describe, expect, it } from 'vitest';
import {
  LessonRuntime, caption_cues, case_position, describe_step, expected_answer, grade, grade_blank, is_bilingual, lesson_langs, lesson_strings,
  narration_lines, speakable_markup, spoken_lang, to_spoken, tr, type DeriveStep, type Lesson, type RuntimeEvent,
} from '../src';

const derive: DeriveStep = {
  id: 'count', kind: 'derive', skill: 'count', title: { en: 'Count', zh: '数一数' },
  lines: [{ tex: '\\#B = d r' }, { tex: '\\#A = r k' }, { tex: 'r (d + k)', why: { en: 'Add them.', zh: '相加。' } }],
  blank: { line: 2, answer: 'r*(d+k)', variables: ['r', 'd', 'k'] },
};
const lesson: Lesson = {
  id: 'demo', title: { en: 'LoRA', zh: '低秩适配' }, skills: [{ id: 'count', name: { en: 'Counting', zh: '计数' } }, { id: 'why', name: 'Why' }],
  misconceptions: [{ id: 'full', description: { en: 'Same as the matrix.', zh: '和矩阵一样多。' } }],
  steps: [
    { id: 'read', kind: 'read', chapter: { en: 'Idea', zh: '思路' }, narration: { en: 'Read this.', zh: '读一读。' }, blocks: [{ type: 'p', text: { en: 'Hello $x$', zh: '你好 $x$' } }, { type: 'code', lang: 'python', code: 'x = 1' }] },
    derive,
    {
      id: 'q1', kind: 'checkpoint', skill: 'count', prompt: { en: 'How many for r = {r}?', zh: 'r = {r} 时有多少？' }, params: () => ({ r: 8 }),
      group: { id: 'case', title: { en: 'A case', zh: '一个案例' }, brief: [{ type: 'p', text: { en: 'The case.', zh: '案例。' } }] },
      question: { type: 'choice', options: [{ id: 'a', label: { en: 'Many', zh: '很多' }, correct: true, feedback: { en: 'Yes.', zh: '对。' } }, { id: 'b', label: 'Few', misconception: 'full' }] },
      hints: [{ en: 'Use r = {r}.', zh: '用 r = {r}。' }],
    },
    {
      id: 'q2', kind: 'checkpoint', skill: 'why', prompt: { en: 'Why?', zh: '为什么？' }, group: { id: 'case', title: { en: 'A case', zh: '一个案例' } },
      question: { type: 'text', rubric: { key_points: [{ en: 'Point one', zh: '要点一' }, { en: 'Point two', zh: '要点二' }], model_answer: { en: 'Model.', zh: '参考。' }, min_points: 1 } },
    },
  ],
};
// a canvas stand-in: text steps and scene-less questions never draw
const canvas = { width: 16, height: 9, getContext: () => null } as unknown as HTMLCanvasElement;
const run = (lang: 'en' | 'zh') => {
  const rt = new LessonRuntime(lesson, { canvas, lang, seed: 1 });
  const events: RuntimeEvent[] = [];
  rt.on((e) => events.push(e));
  return { rt, events };
};

describe('tr', () => {
  it('resolves L10n and passes plain strings through', () => {
    expect(tr({ en: 'a', zh: '甲' }, 'zh')).toBe('甲');
    expect(tr({ en: 'a', zh: '甲' }, 'en')).toBe('a');
    expect(tr('same', 'zh')).toBe('same');
    expect(tr(undefined, 'en')).toBe('');
  });
  it('falls back to English when a translation is missing or empty', () => {
    expect(tr({ en: 'a', zh: '' }, 'zh')).toBe('a');
    expect(tr({ en: 'a' } as any, 'zh')).toBe('a');
  });
  it('tells bilingual values from plain strings', () => {
    expect(is_bilingual({ en: 'a', zh: 'b' })).toBe(true);
    expect(is_bilingual('a')).toBe(false);
    expect(is_bilingual({ en: 'a', other: 1 })).toBe(false);
  });
});

describe('the runtime in the learner language', () => {
  it('emits a page for text steps (no scene) and resolves prompts, hints and feedback', async () => {
    const { rt, events } = run('zh');
    await rt.start();
    expect(events.find((e) => e.type === 'page')).toMatchObject({ step: { id: 'read' } });
    expect(rt.can_continue()).toBe(true);
    await rt.goto('q1');
    expect(events.find((e) => e.type === 'checkpoint')).toMatchObject({ prompt: 'r = 8 时有多少？' });
    expect(rt.hint()).toBe('用 r = 8。');
    const g = rt.submit({ type: 'choice', option: 'a' });
    expect(g.feedback).toEqual(['对。']);
    expect(g.expected).toBe('很多');
  });
  it('keeps English-only lessons unchanged', async () => {
    const { rt, events } = run('en');
    await rt.goto('q1');
    expect(events.find((e) => e.type === 'checkpoint')).toMatchObject({ prompt: 'How many for r = 8?' });
    expect(rt.submit({ type: 'choice', option: 'b' }).feedback).toEqual([]);
  });
});

describe('derivation blanks', () => {
  it('grades with the expression grader (any equivalent form)', () => {
    expect(grade_blank(derive, 'r*(d+k)').correct).toBe(true);
    expect(grade_blank(derive, 'dr + rk').correct).toBe(true);
    expect(grade_blank(derive, 'r*d*k').correct).toBe(false);
  });
  it('explains unreadable input in the learner language, parse errors included', () => {
    const g = grade_blank(derive, 'r*(d+', 'zh');
    expect(g.correct).toBe(false);
    expect(g.feedback).toEqual(['这个输入我看不懂：式子还没写完。']);
    expect(grade_blank(derive, 'r*(d+k', 'zh').feedback).toEqual(['这个输入我看不懂：这里缺少 )。']);
    expect(grade_blank(derive, 'r # d', 'zh').feedback).toEqual(['这个输入我看不懂：无法识别的字符"#"。']);
    expect(grade_blank(derive, 'r*(d+k', 'en').feedback).toEqual(['I could not read that: expected ).']); // English unchanged
  });
  it('is logged and credits the skill on the first attempt', async () => {
    const { rt, events } = run('en');
    await rt.goto('count');
    expect(rt.submit_blank('r*d').correct).toBe(false);
    expect(rt.submit_blank('r*(d+k)').correct).toBe(true);
    expect(events.filter((e) => e.type === 'blank')).toHaveLength(2);
    expect(rt.log.events.filter((e) => e.verb === 'answered' && e.step === 'count')).toHaveLength(2);
    expect(rt.learner.state.skills.count.attempts).toBe(1);
  });
});

describe('free-text answers', () => {
  const q = lesson.steps[3].kind === 'checkpoint' ? lesson.steps[3].question : null!;
  it('are correct with enough key points and expect the model answer', () => {
    const g = grade(q, { type: 'text', text: 'my answer', hits: [true, false], feedback: 'Good start.' }, {}, 'zh');
    expect(g).toMatchObject({ correct: true, score: 0.5, points: [true, false], feedback: ['Good start.'], expected: '参考。' });
    expect(grade(q, { type: 'text', text: 'x', hits: [false, false] }).correct).toBe(false);
    expect(expected_answer(q, {}, 'en')).toBe('Model.');
  });
  it('end at once when self-assessed', async () => {
    const { rt } = run('en');
    await rt.goto('q2');
    const events: RuntimeEvent[] = [];
    rt.on((e) => events.push(e));
    rt.submit({ type: 'text', text: 'because', hits: [false, false], self: true });
    expect(events.find((e) => e.type === 'graded')).toMatchObject({ final: true });
  });
});

describe('cases', () => {
  it('number consecutive questions and share the brief', () => {
    expect(case_position(lesson, 2)).toMatchObject({ k: 1, n: 2, group: { brief: [{ type: 'p' }] } });
    expect(case_position(lesson, 3)).toMatchObject({ k: 2, n: 2, group: { brief: [{ type: 'p' }] } });
    expect(case_position(lesson, 1)).toBeNull();
  });
});

describe('walking a lesson', () => {
  it('finds every learner-facing string and the languages', () => {
    const where = lesson_strings(lesson).map((x) => x.where);
    expect(where).toEqual(expect.arrayContaining(['title', 'skills[0].name', 'misconceptions[0].description', 'steps.read.blocks[0].text', 'steps.count.lines[2].why', 'steps.q1.options[0].label', 'steps.q1.group.brief[0].text', 'steps.q2.rubric.key_points[1]']));
    expect(lesson_langs(lesson)).toEqual(['en', 'zh']);
    expect(lesson_langs({ ...lesson, title: 'x', skills: [], misconceptions: [], steps: [] })).toEqual(['en']);
    expect(narration_lines(lesson, 'zh')).toEqual([]); // a read page is not voiced, even with narration
    // in a game the character speaks the questions; in the essay view they are silent
    const asked: Lesson = { ...lesson, steps: [{ ...(lesson.steps[2] as any), narration: { en: 'Pick one!', zh: '选一个！' } }] };
    expect(narration_lines(asked, 'zh')).toEqual([]);
    expect(narration_lines({ ...asked, mode: 'game' }, 'zh')).toEqual(['选一个！']);
  });
  it('describes a text page for the tutor', () => {
    expect(describe_step(lesson.steps[0], 'zh')).toContain('你好 $x$');
    expect(describe_step(derive, 'en')).toContain('(3) $$r (d + k)$$ - Add them.');
  });
});

describe('narration in two languages', () => {
  it('splits Chinese captions at Chinese punctuation, without spaces', () => {
    const text = '全量微调要改动每一个权重。LoRA 把它们冻结，只学一个小小的低秩修正。'.repeat(2);
    const words = [...text].map((c, i) => [i * 0.2, i * 0.2 + 0.2, c] as [number, number, string]);
    const cues = caption_cues(text, { text, duration: text.length * 0.2, words });
    expect(cues.length).toBeGreaterThan(1);
    expect(cues.map((c) => c.text).join('')).toBe(text);
  });
  it('speaks Chinese lines in Chinese', () => {
    expect(spoken_lang('LoRA 的秩')).toBe('zh');
    expect(spoken_lang('The rank of LoRA')).toBe('en');
    expect(to_spoken('面积是 πr²，约 ≈ 3')).toBe('面积是 πr的平方，约 约等于 3');
    expect(to_spoken('KL 散度')).toBe('KL 散度'); // abbreviations are not spelled out in Chinese
    expect(speakable_markup('$\\frac{1}{2}$ 和 $\\beta^2$', 'zh')).toMatch(/2 分之 1 .*β 的平方/);
    expect(to_spoken('The KL term')).toBe('The K-L term'); // English is unchanged
  });
});
