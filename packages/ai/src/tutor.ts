// The fast, personal text answer. It streams within a second or two, long
// before the animated scene is ready: a one-line diagnosis of what this
// student is confused about, then a short answer written for them.
import type { Backend } from './ops_types';
import type { AskContext } from './prompt';
import type { Usage } from './provider';

/** Everything known about the student when they ask (all optional). */
export type StudentContext = AskContext;

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
  const m = /^\s*DIAGNOSIS\s*[:：]\s*([^\n]*)(\n|$)/i.exec(sofar); // (models writing Chinese may use a full-width colon)
  if (!m) {
    // not (yet) a diagnosis line: hold back a possible prefix, else it is all answer
    return /^\s*D(I(A(G(N(O(S(I(S\s*[:：]?)?)?)?)?)?)?)?)?\s*$/i.test(sofar) ? { diagnosis: null, answer: '' } : { diagnosis: '', answer: sofar.trimStart() };
  }
  if (!m[2]) return { diagnosis: null, answer: '' }; // the line is still arriving
  return { diagnosis: m[1].trim(), answer: sofar.slice(m[0].length).trimStart() };
}

/** Stream the personal answer. `on_diagnosis` fires once, as soon as the first line is complete. */
export async function explain(
  question: string,
  o: {
    backend: Backend;
    context?: StudentContext;
    on_text?: (answer_so_far: string) => void;
    on_diagnosis?: (d: string) => void;
    signal?: AbortSignal;
    on_usage?: (u: Usage) => void;
  },
): Promise<Explanation> {
  const t0 = performance.now();
  let ms_first = 0, sofar = '', told = false;
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
  const on_text = (d: string) => {
    sofar += d;
    update();
  };
  const all = await o.backend.run('tutor', { question, context: o.context }, { on_text: o.backend.stream ? on_text : undefined, signal: o.signal, on_usage: o.on_usage });
  if (!o.backend.stream) on_text(all);
  const s = split_reply(sofar);
  return { diagnosis: s.diagnosis ?? '', text: s.answer.trim(), ms_first, ms_done: performance.now() - t0 };
}
