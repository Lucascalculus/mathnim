// The instructions given to the model. Stable parts (rules, API digest,
// examples) form a cacheable system prompt; the question and context go in
// the user message.
import { API_DIGEST } from './api_digest.generated';
import { RECORDED } from './recorded';

export const RULES = `You are Mathnim, a math tutor who explains with short animated, interactive diagrams.
You write scenes with manim-web: Manim Community 0.21 (same classes, methods, defaults) in JavaScript.

# Output
Return ONLY one JSON object, no prose around it:
{"title": string,
 "explanation": string,      // 2-6 short sentences for the student, markdown, inline TeX as $...$
 "code": string,             // JavaScript, rules below
 "checks": [{"label": string, "value": number, "expr": string}],   // every number you state, recomputed as a plain JS Math expression
 "followups": [string, string]}  // two natural next questions

# Code rules
- Define \`class Answer extends Scene { construct() { ... } }\`. Optionally define \`function setup(scene, ui)\` to make the
  finished scene explorable: ui.add_handle({ tracker, from_value: v => point, to_value: point => v, label, step }).
  Keep trackers on the scene (this.k = ValueTracker(1)) so setup can reach them.
- JS syntax for Manim: keyword arguments are a trailing object - Circle({ radius: 2, color: C.accent }),
  this.play(Create(c), { run_time: 2 }), mob.next_to(other, DOWN, { buff: 0.3 }). Call classes without \`new\`.
- Vectors are arrays [x, y, 0]. There is no numpy: \`UP * 2\` is WRONG; use mul(2, UP), add(a, b), sub(a, b).
  Index groups with g.get(i) (not g[i]). TeX goes in strings with doubled backslashes: MathTex('\\\\frac{a}{b}').
- The background is WHITE. Always pass colours from the palette C = { ink, muted, faint, accent, gold, coral, good, purple }.
- The frame is 14.2 x 8 units centred at the origin. Keep everything inside x in [-6.6, 6.6], y in [-3.7, 3.7].
  Font sizes >= 24. Labels must not overlap each other or cross lines. At most about 8 pieces of text at once.
- 8-30 seconds in total. Build up step by step (Create, Write, FadeIn, Transform, value trackers moving);
  pause with this.wait() where the student should think. Show, don't tell: a moving point, a changing number.
- Deterministic and self-contained: no Math.random, no network, no DOM, no imports.
- The student's level and what is on their screen are given as CONTEXT; reuse its notation.`;

export function system_prompt(): string {
  const examples = RECORDED.slice(0, 2)
    .map((r) => `QUESTION: ${r.question}\n${JSON.stringify({ title: r.title, explanation: r.explanation, code: r.code, checks: r.checks, followups: r.followups })}`)
    .join('\n\n');
  return `${RULES}\n\n# API\n${API_DIGEST}\n\n# Examples\n${examples}`;
}

/** What is known about the student when they ask (all optional). */
export interface AskContext {
  lesson?: string;
  /** The step on screen, e.g. 'Slice and rearrange (explore)'. */
  step?: string;
  /** describe_text() of the scene on screen. */
  on_screen?: string;
  /** e.g. "inscribed angles 40%, geometric mean 90%". */
  learner?: string;
  /** Misconceptions this student has shown (descriptions). */
  misconceptions?: string[];
  /** Earlier questions in this session, oldest first, with the start of each answer. */
  recent?: { q: string; a: string }[];
  level?: string;
  /** Write the answer in this language (overrides the question's own language). */
  language?: string;
  /** The language the learner chose for the app, e.g. 'Chinese': a hint; the question's own language still decides. */
  learner_language?: string;
  /** Subject tags of the lesson, e.g. ['linear algebra', 'pca'] (rank the visual catalog when it is large). */
  topics?: string[];
  /** A passage the student selected on the page and asks about. */
  selected?: string;
}
export interface ScenePromptExtra {
  /** The tutor's one-line reading of the question (from the fast text answer). */
  diagnosis?: string;
  /** A short text answer is already on screen: the scene's own explanation should only guide the picture. */
  text_shown?: boolean;
}
export function user_prompt(question: string, ctx: AskContext = {}, extra: ScenePromptExtra = {}): string {
  const parts = ['CONTEXT:'];
  if (ctx.lesson) parts.push(`Lesson: ${ctx.lesson}`);
  if (ctx.step) parts.push(`Step on screen: ${ctx.step}`);
  if (ctx.level) parts.push(`Level: ${ctx.level}`);
  if (ctx.learner) parts.push(`Learner mastery: ${ctx.learner}`);
  if (ctx.misconceptions?.length) parts.push(`Mistakes shown: ${ctx.misconceptions.join(' | ')}`);
  if (ctx.on_screen) parts.push(`On screen now:\n${ctx.on_screen}`);
  if (ctx.selected) parts.push(`The student selected this passage and asks about it: "${ctx.selected}"`);
  if (ctx.language) parts.push(`Answer in: ${ctx.language}`);
  else if (ctx.learner_language) parts.push(`The learner's app language: ${ctx.learner_language} (answer in the language of the QUESTION)`);
  if (extra.diagnosis) parts.push(`What the student most likely needs: ${extra.diagnosis}`);
  const note = extra.text_shown
    ? '\n\nA short text answer is already shown to the student. Make the scene show exactly that idea; keep "explanation" to 1-2 sentences saying what to watch and what to try in the scene.'
    : '';
  return `${parts.join('\n')}\n\nQUESTION: ${question}${note}\n\n`;
}
export function repair_prompt(problems: string): string {
  return `Your scene did not pass validation:\n${problems}\n\nFix it and return the complete corrected JSON object.`;
}
