// Question -> explanation + validated, explorable scene.
// generate -> validate (sandbox + linter + numeric checks) -> repair (bounded) -> answer.
import { repair_prompt, system_prompt, user_prompt, type AskContext, type ScenePromptExtra } from './prompt';
import type { Message, Provider } from './provider';
import { run_checks } from './run';
import type { ValidationResult, Validator } from './sandbox';

export interface AnswerJSON {
  title: string;
  explanation: string;
  code: string;
  checks?: { label: string; value: number; expr: string }[];
  followups?: string[];
}
export interface AskResult extends AnswerJSON {
  attempts: number;
  validation: ValidationResult | null;
  check_results: ReturnType<typeof run_checks>;
  /** Passed every gate (false = best effort after the last repair). */
  verified: boolean;
  provider: string;
  ms: number;
}
export type AskStatus = { phase: 'thinking' | 'validating' | 'repairing' | 'done'; attempt: number; detail?: string };

/** Pull the JSON object out of a model reply (tolerates code fences and stray prose). */
export function parse_answer(text: string): AnswerJSON {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The reply contained no JSON object.');
  const obj = JSON.parse(raw.slice(start, end + 1));
  for (const k of ['title', 'explanation', 'code']) if (typeof obj[k] !== 'string') throw new Error(`The JSON has no "${k}" string.`);
  return obj;
}

function problems(v: ValidationResult | null, checks: ReturnType<typeof run_checks>, parse_error?: string): string | null {
  const out: string[] = [];
  if (parse_error) out.push(`- The reply could not be parsed: ${parse_error}`);
  if (v && !v.ok) out.push(`- Running the code failed: ${v.error}${v.stack ? `\n${v.stack}` : ''}`);
  for (const i of v?.issues ?? []) if (i.severity === 'error') out.push(`- Layout (${i.rule}${i.time !== undefined ? ` at ${i.time.toFixed(1)}s` : ''}): ${i.message}`);
  for (const c of checks) if (!c.ok) out.push(`- The number "${c.label}" is ${c.value} in your text but ${c.got} when computed.`);
  return out.length ? out.join('\n') : null;
}

export async function ask(
  question: string,
  o: { provider: Provider; validate: Validator; context?: AskContext; extra?: ScenePromptExtra; max_attempts?: number; on_status?: (s: AskStatus) => void; signal?: AbortSignal },
): Promise<AskResult> {
  const t0 = performance.now();
  const system = system_prompt();
  const messages: Message[] = [{ role: 'user', content: user_prompt(question, o.context, o.extra) }];
  const max = o.max_attempts ?? 3;
  let best: AskResult | null = null;
  for (let attempt = 1; attempt <= max; attempt++) {
    o.on_status?.({ phase: attempt === 1 ? 'thinking' : 'repairing', attempt });
    const reply = await o.provider.complete({ system, messages, cache_system: true }, o.signal);
    messages.push({ role: 'assistant', content: reply });
    let answer: AnswerJSON;
    try {
      answer = parse_answer(reply);
    } catch (e) {
      messages.push({ role: 'user', content: repair_prompt(problems(null, [], (e as Error).message)!) });
      continue;
    }
    o.on_status?.({ phase: 'validating', attempt });
    const validation = await o.validate(answer.code);
    const check_results = run_checks(answer.checks);
    const issue = problems(validation, check_results);
    const result: AskResult = { ...answer, attempts: attempt, validation, check_results, verified: !issue, provider: o.provider.name, ms: performance.now() - t0 };
    if (!issue) {
      o.on_status?.({ phase: 'done', attempt });
      return result;
    }
    if (validation.ok && (!best || !best.validation?.ok)) best = result;
    messages.push({ role: 'user', content: repair_prompt(issue) });
  }
  o.on_status?.({ phase: 'done', attempt: max, detail: 'unverified' });
  if (best) return best;
  throw new Error('Could not produce a working scene for this question. Try rephrasing it.');
}
