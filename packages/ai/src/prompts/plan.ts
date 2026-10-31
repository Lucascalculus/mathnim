// The picture plan's instructions (server only: ops.ts): pick a ready-made visual from the catalog and set its
// parameters, or say that words are enough. The catalog blocks come from prompts/catalog.generated.ts (written by
// `npm run catalog` from the visuals' registry).
import type { AskContext } from '../prompt';
import { context_block } from './tutor';

export const PLAN_RULES = `You choose the picture for a math tutor's answer. A student asked a question in an interactive lesson; a short text answer is written separately (not by you).
First decide whether a picture would help at all. Many questions are answered well in words: a definition, a yes or no, a reason, a fact, a comparison, the meaning of a sentence. For those pick "none": the student reads the text answer and nothing else. Only when seeing something (a shape, a motion, a plot, numbers changing) makes the idea clearer, pick ONE ready-made interactive visual from the CATALOG below that shows exactly that idea, and set its parameters for their case - or pick null.

Reply with one JSON object and nothing else:
{"visual": "none" or "<a name from the CATALOG>" or null,
 "params": {"<parameter>": <value>},
 "caption": "<1-2 sentences to the student: what to watch, then what to drag or change>",
 "followups": ["<a next question in the student's voice>", "<another>"],
 "check": {"question": "<a quick question the picture lets them answer>", "answer": "<its short answer>"}}

Rules:
- "none" when words suffice (the usual case for "what does this mean", "why", "is it true that"): answer {"visual": "none", "params": {}, "caption": "", "followups": [...]}. A picture the student does not need only costs them time.
- Choose a visual only if it directly shows what the question is about. If a picture is needed but no visual shows it (another topic, or only loosely related), answer {"visual": null, "params": {}, "caption": "", "followups": [...]}: a custom picture is drawn instead (it takes about a minute). A wrong picture is worse than none.
- params: only parameters listed for that visual, inside their ranges. Use the student's own numbers (their matrix, radius, data) when the question or the screen gives them; leave out parameters whose default is fine. Matrices are rows first: [[a, b], [c, d]].
- caption: say only what that visual really shows and lets the student do (read its description). Inline TeX in $...$.
- followups: short. check: optional, leave it out if nothing fits.`;

/** One catalog block per visual (the same format as `catalog()` in @mathnim/visuals). */
/** The rules and the catalog of the visuals offered (each visual's block as catalog_text() in visual_plan.ts writes it). */
export function plan_system(blocks: string[]): string {
  return `${PLAN_RULES}\n\nCATALOG (name - what it shows and what the student does; then each parameter: name: type range =default - meaning)\n${blocks.join('\n')}`;
}

/** The language to write in: the context's, else a guess from the question's script. */
export function answer_language(question: string, ctx: AskContext = {}): string {
  if (ctx.language) return ctx.language;
  if (/[\u4e00-\u9fff]/.test(question)) return 'Chinese';
  if (/[\u3040-\u30ff]/.test(question)) return 'Japanese';
  if (/[\uac00-\ud7af]/.test(question)) return 'Korean';
  if (/[\u0400-\u04ff]/.test(question)) return 'Russian';
  const letters = question.match(/\p{L}/gu) ?? [];
  // English needs a real word: a formula like 'r(d+k)?' does not tell the language
  if (letters.length && /[a-z]{2,}/i.test(question) && letters.filter((ch) => /[a-z]/i.test(ch)).length / letters.length > 0.95 && !/\b(el|la|les|der|die|das|und|est|il|che|por|para)\b/i.test(question)) return 'English';
  // the script does not decide (e.g. a formula, or Latin letters that are not clearly English): the app's language
  return ctx.learner_language ?? 'the language of the QUESTION';
}

export function plan_user(question: string, ctx: AskContext = {}, diagnosis?: string): string {
  const parts = [context_block({ ...ctx, language: undefined }, { max_screen: 1800 })];
  if (diagnosis) parts.push(`What the student most likely needs: ${diagnosis}`);
  parts.push(`QUESTION: ${question}`);
  return `${parts.join('\n\n')}\n\nWrite caption, followups and check in ${answer_language(question, ctx)}. Reply with the JSON object.`;
}

/** The message that sends problems back to the model (one round-trip). */
export function plan_repair_message(problems: string[], offered: string[]): string {
  return `That JSON cannot be used:\n${problems.map((p) => `- ${p}`).join('\n')}\n\nVisual names: ${offered.join(', ')} (or "none" for no picture, or null). Use only the parameters listed for the visual. Return the corrected JSON object only.`;
}
