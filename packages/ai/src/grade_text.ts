// Free-text answers checked against a rubric's key points by the active model
// (JSON mode, thinking off): which key points the answer makes, and one
// sentence of feedback in the learner's language. The lesson view falls back to
// self-assessment when there is no model or the call fails.
import type { Provider, Reasoning, Usage } from './provider';

export interface TextGradeRequest {
  question: string;
  answer: string;
  key_points: string[];
  model_answer: string;
  /** The learner's language, e.g. 'English' or 'Chinese'. */
  language: string;
}
export interface TextGradeResult {
  /** One per key point: does the answer make it? */
  hits: boolean[];
  /** One sentence for the learner. */
  feedback: string;
}

export const GRADE_TEXT_RULES = `You grade a student's short written answer against KEY POINTS written by the teacher.
For each key point decide whether the answer MAKES it: the idea is stated or clearly implied in the student's own words.
- Judge meaning, not wording. A keyword without the idea does not count; a point the answer contradicts does not count.
- Do not give credit for points that are only in the model answer.
Then write ONE sentence of feedback (at most 30 words) to the student, in the language given: say what was right, and
name the most important missing idea as a question or nudge, without pasting the model answer.
Return ONLY a JSON object: {"made": [true|false, ...one per key point, in order], "feedback": string}`;

export function grade_text_prompt(r: TextGradeRequest): string {
  return [
    `QUESTION: ${r.question}`,
    `KEY POINTS:\n${r.key_points.map((k, i) => `${i + 1}. ${k}`).join('\n')}`,
    `MODEL ANSWER (for reference): ${r.model_answer}`,
    `STUDENT ANSWER: ${r.answer}`,
    `Write the feedback in ${r.language}. Reply with the JSON object.`,
  ].join('\n\n');
}

/** Read the grader's reply (tolerates code fences and stray prose); throws when it is unusable. */
export function parse_text_grade(reply: string, n: number): TextGradeResult {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(reply);
  const raw = (fenced ? fenced[1] : reply).trim();
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON object in the reply');
  const j = JSON.parse(raw.slice(a, b + 1));
  const made = Array.isArray(j.made) ? j.made : Array.isArray(j.points) ? j.points : null;
  if (!made) throw new Error('the reply has no "made" list');
  const hits = Array.from({ length: n }, (_, i) => made[i] === true || made[i] === 'true' || (typeof made[i] === 'object' && !!made[i]?.made));
  return { hits, feedback: typeof j.feedback === 'string' ? j.feedback.trim() : '' };
}

/** Grade one answer with the model. */
export async function grade_text(r: TextGradeRequest, o: { provider: Provider; signal?: AbortSignal; reasoning?: Reasoning; on_usage?: (u: Usage) => void }): Promise<TextGradeResult> {
  const reply = await o.provider.complete(
    { system: GRADE_TEXT_RULES, messages: [{ role: 'user', content: grade_text_prompt(r) }], json: true, reasoning: o.reasoning ?? 'off', max_tokens: 600, cache_system: true, on_usage: o.on_usage },
    o.signal,
  );
  return parse_text_grade(reply, r.key_points.length);
}
