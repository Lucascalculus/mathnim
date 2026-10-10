// The fast, personal text answer. It streams within a second or two, long
// before the animated scene is ready: a one-line diagnosis of what this
// student is confused about, then a short answer written for them.
import type { AskContext } from './prompt';
import type { Provider, Reasoning, Usage } from './provider';

/** Everything known about the student when they ask (all optional). */
export type StudentContext = AskContext;

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
export function context_block(ctx: StudentContext = {}, o: { max_screen?: number } = {}): string {
  const lines = ['CONTEXT'];
  if (ctx.level) lines.push(`Level: ${ctx.level}`);
  if (ctx.lesson) lines.push(`Lesson: ${ctx.lesson}`);
  if (ctx.step) lines.push(`Step on screen: ${ctx.step}`);
  if (ctx.learner) lines.push(`Mastery: ${ctx.learner}`);
  if (ctx.misconceptions?.length) lines.push(`Mistakes shown: ${ctx.misconceptions.join(' | ')}`);
  if (ctx.recent?.length) lines.push(`Earlier questions:\n${ctx.recent.map((r) => `- Q: ${r.q}\n  A: ${r.a}`).join('\n')}`);
  if (ctx.on_screen) lines.push(`On screen now:\n${o.max_screen ? ctx.on_screen.slice(0, o.max_screen) : ctx.on_screen}`);
  if (ctx.selected) lines.push(`The student selected this passage and asks about it: "${ctx.selected.slice(0, 1200)}"`);
  if (ctx.language) lines.push(`Answer in: ${ctx.language}`);
  else if (ctx.learner_language) lines.push(`The learner's app language: ${ctx.learner_language} (answer in the language of the QUESTION)`);
  return lines.join('\n');
}

/** The user message: the student's context, then their question. */
export function tutor_prompt(question: string, ctx: StudentContext = {}): string {
  return `${context_block(ctx)}\n\nQUESTION: ${question}`;
}

export interface Explanation {
  diagnosis: string;
  text: string;
  /** ms from the request to the first visible word, and to the end. */
  ms_first: number;
  ms_done: number;
}

/**
 * Splits the streamed reply into the diagnosis line and the answer. Feed it
 * the text so far; it returns what is known.
 */
export function split_reply(sofar: string): { diagnosis: string | null; answer: string } {
  if (!sofar.trim()) return { diagnosis: null, answer: '' };
  const m = /^\s*DIAGNOSIS:\s*([^\n]*)(\n|$)/i.exec(sofar);
  if (!m) {
    // not (yet) a diagnosis line: hold back a possible prefix, else it is all answer
    return /^\s*D(I(A(G(N(O(S(I(S:?)?)?)?)?)?)?)?)?\s*$/i.test(sofar) ? { diagnosis: null, answer: '' } : { diagnosis: '', answer: sofar.trimStart() };
  }
  if (!m[2]) return { diagnosis: null, answer: '' }; // the line is still arriving
  return { diagnosis: m[1].trim(), answer: sofar.slice(m[0].length).trimStart() };
}

/** Stream the personal answer. `on_diagnosis` fires once, as soon as the first line is complete. */
export async function explain(
  question: string,
  o: {
    provider: Provider;
    context?: StudentContext;
    on_text?: (answer_so_far: string) => void;
    on_diagnosis?: (d: string) => void;
    signal?: AbortSignal;
    /** Thinking budget (default: the model's own); 'off' gives the first word sooner. */
    reasoning?: Reasoning;
    on_usage?: (u: Usage) => void;
  },
): Promise<Explanation> {
  const t0 = performance.now();
  let ms_first = 0, sofar = '', told = false;
  const req = { system: TUTOR_RULES, messages: [{ role: 'user' as const, content: tutor_prompt(question, o.context) }], max_tokens: 2000, cache_system: true, reasoning: o.reasoning, on_usage: o.on_usage };
  const update = () => {
    const s = split_reply(sofar);
    if (s.diagnosis !== null && !told) {
      told = true;
      o.on_diagnosis?.(s.diagnosis);
    }
    if (s.answer) {
      ms_first ||= performance.now() - t0;
      o.on_text?.(s.answer);
    }
  };
  if (o.provider.stream) {
    await o.provider.stream(req, (d) => {
      sofar += d;
      update();
    }, o.signal);
  } else {
    sofar = await o.provider.complete(req, o.signal);
    update();
  }
  const s = split_reply(sofar);
  return { diagnosis: s.diagnosis ?? '', text: s.answer.trim(), ms_first, ms_done: performance.now() - t0 };
}
