// The two questions at the top of a page's margin (server only: ops.ts).
import type { OpInputs } from '../ops_types';

export function starters_rules(lang: 'en' | 'zh'): string {
  return `You write the two questions a curious, sharp learner would most want to ask right after reading one page of a lesson. Each question: in ${lang === 'zh' ? 'Simplified Chinese, at most 18 characters' : 'English, at most 10 words'}; about something specific on this page; asks why, what for, or what would happen, not for a definition; not a quiz question. Reply with JSON only: {"questions": ["...", "..."]}`;
}
export const starters_prompt = (a: OpInputs['starters']) => `LESSON: ${a.lesson}\nPAGE: ${a.page}\n\n${a.text.slice(0, 2600)}`;
