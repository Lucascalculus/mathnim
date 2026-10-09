// Language-model providers. The pipeline only needs `complete()`.
//
// DeepSeek (measured 2026-10-10, deepseek-flash and deepseek-v4-pro; both think
// by default and return reasoning_content):
//   thinking: {type: 'disabled'}     -> no reasoning at all (also drops the ~25-token thinking preamble
//                                       from the prompt); variants are adaptive | enabled | disabled
//   reasoning_effort: low|high|max   -> /models lists these levels (default high); 'low' shortens thinking
//   reasoning_effort: 'none'         -> accepted, same effect as thinking disabled (undocumented)
//   response_format: {type: 'json_object'} -> JSON mode, works with thinking on or off
//   enable_thinking, effort          -> silently ignored
// `reasoning` and `json` in a request map onto these; a server that rejects them
// (400/422) is asked again without them, once, and not sent them again.
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
/** How much a reasoning model may think before it answers ('off' = not at all). */
export type Reasoning = 'off' | 'low' | 'high' | 'max';
export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number;
  /** Prompt tokens served from the provider's prefix cache. */
  cached_tokens?: number;
}
export interface CompletionRequest {
  system: string;
  messages: Message[];
  max_tokens?: number;
  /** Parts of the system prompt that never change (cached by providers that support it). */
  cache_system?: boolean;
  /** Ask for exactly one JSON object (the prompt must say "JSON" and show the shape). */
  json?: boolean;
  /** Thinking budget for reasoning models; omitted = the model's default. */
  reasoning?: Reasoning;
  /** Called with the token usage when the provider reports it. */
  on_usage?: (u: Usage) => void;
}
export interface Provider {
  name: string;
  complete(req: CompletionRequest, signal?: AbortSignal): Promise<string>;
  /** Like `complete`, calling `on_text` with each new piece as it arrives (providers that can stream). */
  stream?(req: CompletionRequest, on_text: (delta: string) => void, signal?: AbortSignal): Promise<string>;
}

/** Read a server-sent-events body, calling `on_data` with each `data:` payload. */
async function read_sse(res: Response, on_data: (data: string) => void): Promise<void> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith('data:')) on_data(line.slice(5).trim());
    }
  }
}

export interface AnthropicOptions {
  /** API key. In a browser this is the learner's own key (prototype); prefer `base_url` pointing at a proxy. */
  api_key?: string;
  model?: string;
  /** e.g. '/api/anthropic' when a server proxy adds the key. */
  base_url?: string;
}
/** Claude via the Messages API (direct from the browser with the user's key, or through a proxy). */
export class AnthropicProvider implements Provider {
  name = 'anthropic';
  constructor(private o: AnthropicOptions) {}
  async complete(req: CompletionRequest, signal?: AbortSignal): Promise<string> {
    const headers: Record<string, string> = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
    if (this.o.api_key) {
      headers['x-api-key'] = this.o.api_key;
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    const body = {
      model: this.o.model ?? 'claude-opus-5-5',
      max_tokens: req.max_tokens ?? 8000,
      system: req.cache_system ? [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }] : req.system,
      messages: req.messages,
    };
    const res = await fetch(`${this.o.base_url ?? 'https://api.anthropic.com'}/v1/messages`, { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    if (data.usage) req.on_usage?.({ prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens, cached_tokens: data.usage.cache_read_input_tokens });
    return (data.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  }
}

export interface OpenAICompatibleOptions {
  /** Shown in the UI and logs, e.g. 'deepseek'. */
  name?: string;
  /** e.g. '/api/deepseek' (a proxy that adds the key) or 'https://api.deepseek.com'. */
  base_url: string;
  model: string;
  /** Only for direct calls; prefer a proxy so the key never reaches the browser. */
  api_key?: string;
  /** Output limit when a request sets none (reasoning models spend part of it thinking). */
  default_max_tokens?: number;
}
/** Token usage in an OpenAI-style response (DeepSeek's cache and reasoning counts included). */
export function read_usage(u: any): Usage {
  return {
    prompt_tokens: u?.prompt_tokens,
    completion_tokens: u?.completion_tokens,
    reasoning_tokens: u?.completion_tokens_details?.reasoning_tokens ?? 0,
    cached_tokens: u?.prompt_cache_hit_tokens ?? u?.prompt_tokens_details?.cached_tokens,
  };
}

/** Any OpenAI-style chat-completions API (DeepSeek, and others that follow it). */
export class OpenAICompatibleProvider implements Provider {
  name: string;
  /** Set when the server rejected `thinking` / `reasoning_effort` / `response_format`: they are not sent again. */
  private plain = false;
  constructor(private o: OpenAICompatibleOptions) {
    this.name = o.name ?? 'openai-compatible';
  }
  /** The request body (exported for tests and tools). */
  body(req: CompletionRequest, stream: boolean, extras = !this.plain): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.o.model,
      max_tokens: req.max_tokens ?? this.o.default_max_tokens ?? 8000,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      stream,
    };
    if (stream && req.on_usage) body.stream_options = { include_usage: true };
    if (extras && req.json) body.response_format = { type: 'json_object' };
    if (extras && req.reasoning) {
      if (req.reasoning === 'off') body.thinking = { type: 'disabled' };
      else body.reasoning_effort = req.reasoning;
    }
    return body;
  }
  private async request(req: CompletionRequest, stream: boolean, signal?: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.o.api_key) headers.authorization = `Bearer ${this.o.api_key}`;
    const url = `${this.o.base_url.replace(/\/$/, '')}/chat/completions`;
    const send = (extras: boolean) => fetch(url, { method: 'POST', headers, body: JSON.stringify(this.body(req, stream, extras)), signal });
    const extras = !this.plain && !!(req.json || req.reasoning);
    const res = await send(!this.plain);
    if (extras && (res.status === 400 || res.status === 422)) {
      // an OpenAI-style server that does not know these fields: ask again without them
      const again = await send(false);
      if (again.ok) this.plain = true;
      return again;
    }
    return res;
  }
  private async fail(res: Response): Promise<never> {
    throw new Error(`${this.name} API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  async complete(req: CompletionRequest, signal?: AbortSignal): Promise<string> {
    const res = await this.request(req, false, signal);
    if (!res.ok) return this.fail(res);
    const data = await res.json();
    if (data.usage) req.on_usage?.(read_usage(data.usage));
    return data.choices?.[0]?.message?.content ?? '';
  }
  async stream(req: CompletionRequest, on_text: (delta: string) => void, signal?: AbortSignal): Promise<string> {
    const res = await this.request(req, true, signal);
    if (!res.ok) return this.fail(res);
    let text = '';
    await read_sse(res, (data) => {
      if (data === '[DONE]') return;
      const chunk = JSON.parse(data);
      if (chunk.usage) req.on_usage?.(read_usage(chunk.usage));
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        on_text(delta);
      }
    });
    return text;
  }
}

/** Offline provider: answers recorded for known questions (demo without a key, tests). */
export class MockProvider implements Provider {
  name = 'mock';
  constructor(private answers: Record<string, string>, private fallback?: string) {}
  static key(q: string): string {
    // (Chinese characters are kept, so Chinese questions have keys of their own)
    return q.toLowerCase().replace(/[^a-z0-9θ√\u3400-\u9fff]+/g, ' ').trim();
  }
  async complete(req: CompletionRequest): Promise<string> {
    const last = req.messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    const q = /QUESTION:\s*([\s\S]*?)(?:\n\n|$)/.exec(last)?.[1] ?? last;
    const hit = this.answers[MockProvider.key(q)];
    if (hit) return hit;
    if (this.fallback) return this.fallback;
    throw new Error('No recorded answer for this question. Add an API key in Settings to ask anything.');
  }
}
