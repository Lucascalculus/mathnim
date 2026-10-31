// /api/ai: the tutor's fixed operations (packages/ai/src/ops.ts). The page sends an operation and its inputs; the
// prompt is written here and sent to DeepSeek with the key (deepseek.ts), so neither the prompts nor an open model
// reach the browser: the model behind this route can only be asked what the tutor asks. Guarded like the rest of
// /api: this site's pages only (Origin), body capped, every input cut to size (parse_op), per-visitor limits
// ('deepseek' in RATE_LIMITS). Only the text answer streams; the starter questions, the same for everyone, are
// answered from the edge cache when they can be.
import { build_op, parse_op } from '../../../packages/ai/src/ops';
import type { OpInputs, OpName } from '../../../packages/ai/src/ops_types';
import { OpenAICompatibleProvider } from '../../../packages/ai/src/provider';
import { allowed_models, forward_chat, MAX_BODY, type DeepseekDeps, type DeepseekEnv } from './deepseek';
import { error, origin_ok, read_text, type Note } from './http';

export async function ai(request: Request, env: DeepseekEnv, deps: DeepseekDeps, note: Note): Promise<Response> {
  if (!env.DEEPSEEK_API_KEY) return error(503, 'This deployment has no model key.');
  if (!origin_ok(request, env.ALLOWED_ORIGINS)) return error(403, 'Requests must come from the Mathnim site.');
  const text = await read_text(request, MAX_BODY);
  if (text === null) return error(413, 'Request too large.');
  let op: OpName, input: OpInputs[OpName], stream: boolean;
  try {
    const raw = JSON.parse(text);
    ({ op, input } = parse_op(raw));
    stream = raw?.stream === true && op === 'tutor';
  } catch (e) {
    return error(400, e instanceof SyntaxError ? 'Invalid JSON.' : (e as Error).message);
  }
  note.op = op;
  const req = build_op(op, input);
  const model = allowed_models(env.ALLOWED_MODELS).find((m) => m !== '*') ?? 'deepseek-flash';
  const body = new OpenAICompatibleProvider({ base_url: '', model }).body(req, stream);
  if (stream) body.stream_options = { include_usage: true };
  return forward_chat(request, body, env, deps, note, { cache: !!req.shared });
}
