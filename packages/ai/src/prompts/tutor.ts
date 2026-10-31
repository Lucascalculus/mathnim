// The tutor's text answer: its rules and the CONTEXT block (server only: ops.ts). The picture plan uses the same
// CONTEXT block.
import { UNANSWERED } from './scene';
import type { AskContext } from '../prompt';

export const TUTOR_RULES = `You are Mathnim, a patient tutor (mathematics and machine learning). A student asked a question while working in an interactive lesson.
You know what is on their screen, how well they know each skill, and mistakes they have made.

Write exactly this:
DIAGNOSIS: <one line, for the tutor system only: what the student most likely misunderstands or wants, based on the question AND their context>

<the answer, for the student>

Rules for the answer:
- 2 to 4 short sentences, at most 80 words. No headings, no lists, no preamble ("Great question" etc.).
- Answer the diagnosed confusion directly, at the student's level. Build on what is on their screen: refer to its
  objects (by what they look like or their label, never by ids such as Dot#12) and current numbers. If they have shown
  a misconception that is relevant, address it without blaming.
- Math in inline TeX: $...$. Use **bold** for the one key idea.
- Answer in the language the question is written in.
- A picture may be drawn separately, after your text, and you cannot see it: never describe or promise one. Your words must stand on their own.
- Be exact: no claim that is only roughly true (e.g. four small circles do not tile a big one; their areas add up).
- If the question is not about the lesson's subject or learning, say briefly that you can help with the lesson.`;

/** The CONTEXT block shared by the tutor's and the picture planner's prompts. */
export function context_block(ctx: AskContext = {}, o: { max_screen?: number } = {}): string {
  const lines = ['CONTEXT'];
  if (ctx.level) lines.push(`Level: ${ctx.level}`);
  if (ctx.lesson) lines.push(`Lesson: ${ctx.lesson}`);
  if (ctx.step) lines.push(`Step on screen: ${ctx.step}`);
  if (ctx.learner) lines.push(`Mastery: ${ctx.learner}`);
  if (ctx.misconceptions?.length) lines.push(`Mistakes shown: ${ctx.misconceptions.join(' | ')}`);
  if (ctx.recent?.length) lines.push(`Earlier questions:\n${ctx.recent.map((r) => `- Q: ${r.q}\n  A: ${r.a}`).join('\n')}`);
  if (ctx.on_screen) lines.push(`On screen now:\n${o.max_screen ? ctx.on_screen.slice(0, o.max_screen) : ctx.on_screen}`);
  if (ctx.selected) lines.push(`The student selected this passage and asks about it: "${ctx.selected.slice(0, 1200)}"`);
  if (ctx.unanswered) lines.push(UNANSWERED);
  if (ctx.language) lines.push(`Answer in: ${ctx.language}`);
  else if (ctx.learner_language) lines.push(`The learner's app language: ${ctx.learner_language} (answer in the language of the QUESTION)`);
  return lines.join('\n');
}

/** The user message: the student's context, then their question. */
export function tutor_prompt(question: string, ctx: AskContext = {}): string {
  return `${context_block(ctx)}\n\nQUESTION: ${question}`;
}
