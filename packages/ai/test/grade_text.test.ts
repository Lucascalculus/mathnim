// Free-text grading by the model, and the learner's language in the tutor's context.
import { describe, expect, it } from 'vitest';
import { grade_text, parse_text_grade } from '../src/grade_text';
import type { CompletionRequest, Provider } from '../src/provider';
import { LocalBackend } from '../src/local_backend';
import { answer_language } from '../src/prompts/plan';
import { context_block } from '../src/prompts/tutor';

describe('grade_text', () => {
  it('asks in JSON mode without thinking and reads which key points were made', async () => {
    let req: CompletionRequest | null = null;
    const provider: Provider = {
      name: 'fake',
      complete: async (r) => {
        req = r;
        return '```json\n{"made": [true, false, "true"], "feedback": "对了一半：再想想遗忘。"}\n```';
      },
    };
    const r = await grade_text({ question: 'Why LoRA?', answer: 'cheap', key_points: ['cheap', 'forgets less', 'eval'], model_answer: 'm', language: 'Chinese' }, { backend: new LocalBackend(provider) });
    expect(r).toEqual({ hits: [true, false, true], feedback: '对了一半：再想想遗忘。' });
    expect(req!.json).toBe(true);
    expect(req!.reasoning).toBe('off');
    expect(req!.messages[0].content).toContain('1. cheap\n2. forgets less\n3. eval');
    expect(req!.messages[0].content).toContain('Write the feedback in Chinese');
  });
  it('pads missing points with false and rejects replies without a list', () => {
    expect(parse_text_grade('{"made": [true], "feedback": "ok"}', 3).hits).toEqual([true, false, false]);
    expect(() => parse_text_grade('no idea', 2)).toThrow();
    expect(() => parse_text_grade('{"feedback": "x"}', 2)).toThrow();
  });
});

describe("the learner's language", () => {
  it('is a hint in the context; the question still decides', () => {
    expect(context_block({ learner_language: 'Chinese' })).toContain("The learner's app language: Chinese (answer in the language of the QUESTION)");
    expect(answer_language('What is the rank of BA?', { learner_language: 'Chinese' })).toBe('English');
    expect(answer_language('秩是多少？', { learner_language: 'English' })).toBe('Chinese');
    expect(answer_language('r(d+k)?', { learner_language: 'Chinese' })).toBe('Chinese');
  });
});
