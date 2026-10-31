// Where the page sends the tutor's operations (ops_types.ts). In production: the site's server (/api/ai), which writes
// the prompts and calls the model. Offline: recorded answers for known questions (a demo without a model). In a
// development build a model called from the page can run them too (local_backend.ts, never in production pages).
import type { Backend, OpInputs, OpName, RunOptions } from './ops_types';
import { MockProvider, read_sse, read_usage } from './provider';

/** The site's server: an operation and its inputs go up, the model's reply (streamed for the text answer) comes back. */
export class ServerBackend implements Backend {
  name = 'deepseek';
  stream = true;
  constructor(private url = '/api/ai') {}
  async run<K extends OpName>(op: K, input: OpInputs[K], o: RunOptions = {}): Promise<string> {
    const stream = !!o.on_text;
    const res = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, input, stream }), signal: o.signal });
    if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    if (!stream) {
      const data = await res.json();
      if (data.usage) o.on_usage?.(read_usage(data.usage));
      return data.choices?.[0]?.message?.content ?? '';
    }
    let text = '';
    await read_sse(res, (data) => {
      if (data === '[DONE]') return;
      const chunk = JSON.parse(data);
      if (chunk.usage) o.on_usage?.(read_usage(chunk.usage));
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        o.on_text!(delta);
      }
    });
    return text;
  }
}

/** Recorded answers (no model): scenes for known questions, a generated lesson's plan by its id, words for a few lesson questions. */
export class RecordedBackend implements Backend {
  name = 'mock';
  stream = false;
  constructor(
    private scenes: Record<string, string>,
    private texts: Record<string, { text: string; followups: string[] }> = {},
    private lessons: Record<string, string> = {},
  ) {}
  text_answer(question: string): { text: string; followups: string[] } | undefined {
    return this.texts[MockProvider.key(question)];
  }
  async run<K extends OpName>(op: K, input: OpInputs[K]): Promise<string> {
    const hit = op === 'scene' ? this.scenes[MockProvider.key((input as OpInputs['scene']).question)] : op === 'lesson_plan' ? this.lessons[(input as OpInputs['lesson_plan']).entry.id] : undefined;
    if (hit) return hit;
    throw new Error('No recorded answer for this question. Add an API key in Settings to ask anything.');
  }
}
