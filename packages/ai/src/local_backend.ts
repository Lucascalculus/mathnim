// Development and tools: the tutor's operations run with a model called from here (a learner's own key in a
// development build, a fake in tests), the prompts written here (ops.ts). Production pages never load this module.
import { build_op } from './ops';
import type { Backend, OpInputs, OpName, RunOptions } from './ops_types';
import type { Provider } from './provider';

export class LocalBackend implements Backend {
  name: string;
  stream: boolean;
  constructor(private provider: Provider) {
    this.name = provider.name;
    this.stream = !!provider.stream;
  }
  run<K extends OpName>(op: K, input: OpInputs[K], o: RunOptions = {}): Promise<string> {
    const req = { ...build_op(op, input), on_usage: o.on_usage };
    if (o.on_text && this.provider.stream) return this.provider.stream(req, o.on_text, o.signal);
    return this.provider.complete(req, o.signal);
  }
  text_answer(question: string): { text: string; followups: string[] } | undefined {
    return this.provider.text_answer?.(question);
  }
}
