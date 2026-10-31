// Free-text answers checked against a rubric's key points by the active model
// (JSON mode, thinking off): which key points the answer makes, and one
// sentence of feedback in the learner's language. The lesson view falls back to
// self-assessment when there is no model or the call fails.
import type { Backend } from './ops_types';
import type { Usage } from './provider';

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
export async function grade_text(r: TextGradeRequest, o: { backend: Backend; signal?: AbortSignal; on_usage?: (u: Usage) => void }): Promise<TextGradeResult> {
  const reply = await o.backend.run('grade_text', r, { signal: o.signal, on_usage: o.on_usage });
  return parse_text_grade(reply, r.key_points.length);
}
