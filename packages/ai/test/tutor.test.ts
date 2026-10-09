import { describe, expect, it } from 'vitest';
import type { CompletionRequest, Provider } from '../src/provider';
import { explain, split_reply, tutor_prompt } from '../src/tutor';

describe('split_reply', () => {
  it('holds back until the diagnosis line is complete', () => {
    expect(split_reply('')).toEqual({ diagnosis: null, answer: '' });
    expect(split_reply('DIAG')).toEqual({ diagnosis: null, answer: '' });
    expect(split_reply('DIAGNOSIS: thinks area grows')).toEqual({ diagnosis: null, answer: '' });
  });
  it('splits the diagnosis from the answer', () => {
    expect(split_reply('DIAGNOSIS: thinks area grows linearly\n\nDoubling $r$')).toEqual({ diagnosis: 'thinks area grows linearly', answer: 'Doubling $r$' });
  });
  it('treats a reply without a diagnosis as all answer', () => {
    expect(split_reply('The area is $\\pi r^2$.')).toEqual({ diagnosis: '', answer: 'The area is $\\pi r^2$.' });
  });
});

describe('tutor_prompt', () => {
  it('includes what is known about the student', () => {
    const p = tutor_prompt('why?', { level: 'grades 7-9', step: 'Grow the circle (explore)', misconceptions: ['Doubling the radius doubles the area.'], recent: [{ q: 'what is pi', a: 'the ratio' }] });
    expect(p).toContain('Level: grades 7-9');
    expect(p).toContain('Step on screen: Grow the circle');
    expect(p).toContain('Mistakes shown: Doubling the radius');
    expect(p).toContain('Q: what is pi');
    expect(p.endsWith('QUESTION: why?')).toBe(true);
  });
});

describe('explain', () => {
  it('streams the answer and reports the diagnosis first', async () => {
    const pieces = ['DIAGNO', 'SIS: confuses crust and area\n', '\nThe crust is a **length**', ', the area is inside.'];
    const provider: Provider = {
      name: 'fake',
      complete: async () => pieces.join(''),
      stream: async (_req: CompletionRequest, on) => {
        for (const p of pieces) on(p);
        return pieces.join('');
      },
    };
    const seen: string[] = [];
    let diag = '';
    const r = await explain('why is the area not 2πr?', { provider, on_text: (a) => seen.push(a), on_diagnosis: (d) => (diag = d) });
    expect(diag).toBe('confuses crust and area');
    expect(seen[0]).toBe('The crust is a **length**');
    expect(r.text).toBe('The crust is a **length**, the area is inside.');
    expect(r.diagnosis).toBe('confuses crust and area');
  });
});
