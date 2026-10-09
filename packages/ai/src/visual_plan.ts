// The fast picture for an answer (docs/PLAN.md WP6, "8 s"). Writing scene code
// from scratch takes 70-110 s; instead a fast model reads the catalog of
// ready-made visuals (@mathnim/visuals), picks one and fills in its parameters
// as a small JSON object. The parameters are checked locally (check_params),
// one repair round-trip fixes what cannot be used, and the scene is built from
// the registry. When no visual fits (or the plan fails) the caller falls back
// to the free-form pipeline (pipeline.ts) in the background.
//
//   question + context (+ diagnosis) + catalog
//     -> {"visual", "params", "caption", "followups", "check"}       one flash call, JSON mode, thinking off
//     -> parse_visual_plan -> check_visual_plan (check_params) -> [repair once] -> decide() -> load_visual()
//
// DeepSeek findings (measured 2026-10-10 against api.deepseek.com; see also provider.ts):
// - deepseek-flash (DeepSeek-V4.1-Flash) and deepseek-v4-pro both think by
//   default and return reasoning_content. /models lists `effort` levels
//   low | high | max (default high).
// - `thinking: {type: "disabled"}` turns thinking off completely: no
//   reasoning_content, reasoning_tokens 0, and the prompt is ~25 tokens shorter
//   (the thinking preamble). `thinking.type` accepts adaptive | enabled |
//   disabled (anything else is a 422). `reasoning_effort: "none"` is accepted
//   too and behaves the same; `reasoning_effort: "low"` roughly halves the
//   thinking on a small math prompt; `enable_thinking` and `effort` are ignored.
// - JSON mode (`response_format: {type: "json_object"}`) works on both models,
//   with thinking on or off. The prompt must contain the word "JSON".
// - Picking a visual is a selection task, so thinking is off by default here.
//   Three lesson questions (eigenvectors vs columns, the pizza rectangle, the
//   best-angle tangent circle), deepseek-flash, from node: plan call 1.1-1.7 s
//   with thinking off (prompt 2.7-3.2K tokens, ~2.2K of it from the prefix
//   cache after the first call; 90-250 output tokens) vs 2.8-3.6 s with the
//   default (230-550 reasoning tokens), same choices (eigen_hunt with the
//   student's matrix, circle_slices, null). Local build 0.8-1.7 s, so the
//   picture starts 2.5-3.0 s after the question. Starting the plan after the
//   diagnosis instead of in parallel cost ~1 s and chose the same visuals.
// - Without a stated language the model once wrote an English student's
//   caption in Italian, so plan_user() names the language (answer_language()).
import { check_params, describe_param, get_visual, list_visuals, palette, apply_palette, type ParamSpec, type Params, type Visual } from '@mathnim/visuals';
import { ScenePlayer, preload } from 'manim-web/ext/player';
import type { AskContext } from './prompt';
import type { Message, Provider, Reasoning, Usage } from './provider';
import { context_block } from './tutor';

/** What the model returns. */
export interface VisualPlan {
  /** A name from the catalog, or null when no visual shows the idea. */
  visual: string | null;
  params: Record<string, unknown>;
  /** 1-2 sentences for the student: what to watch, then what to drag or try. */
  caption: string;
  followups: string[];
  /** A quick question the picture lets the student answer. */
  check?: { question: string; answer?: string };
}

export const PLAN_RULES = `You choose the picture for a math tutor's answer. A student asked a question in an interactive lesson; a short text answer is written separately (not by you).
Pick ONE ready-made interactive visual from the CATALOG below that shows exactly the idea this student needs, and set its parameters for their case - or pick null.

Reply with one JSON object and nothing else:
{"visual": "<a name from the CATALOG>" or null,
 "params": {"<parameter>": <value>},
 "caption": "<1-2 sentences to the student: what to watch, then what to drag or change>",
 "followups": ["<a next question in the student's voice>", "<another>"],
 "check": {"question": "<a quick question the picture lets them answer>", "answer": "<its short answer>"}}

Rules:
- Choose a visual only if it directly shows what the question is about. If none does (another topic, or only loosely related), answer {"visual": null, "params": {}, "caption": "", "followups": [...]}: a custom picture is drawn instead. A wrong picture is worse than none.
- params: only parameters listed for that visual, inside their ranges. Use the student's own numbers (their matrix, radius, data) when the question or the screen gives them; leave out parameters whose default is fine. Matrices are rows first: [[a, b], [c, d]].
- caption: say only what that visual really shows and lets the student do (read its description). Inline TeX in $...$.
- followups: short. check: optional, leave it out if nothing fits.`;

/** One catalog block per visual (the same format as `catalog()` in @mathnim/visuals). */
export function catalog_text(vs: Visual<any>[]): string {
  return vs.map((v) => [`${v.name} - ${v.summary}`, ...(Object.entries(v.params) as [string, ParamSpec][]).map(([k, s]) => `  ${describe_param(k, s)}`)].join('\n')).join('\n');
}

const STOP = new Set('the and for are but not you your this that with what why how does did can when where which who into from than then them they its was were has have had any all one two use used using show shows about there here just only also more less very much many some most our out get got let lets see why'.split(' '));
const words = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));

/** How well a visual matches some text (topics and name count most). */
export function relevance(v: Visual<any>, text: string, topics: string[] = []): number {
  const want = new Set(words(text));
  const tags = new Set(words(v.topics.join(' ')));
  const name = new Set(words(v.name.replace(/_/g, ' ')));
  const summary = new Set(words(v.summary));
  let s = 0;
  for (const w of want) s += (tags.has(w) ? 3 : 0) + (name.has(w) ? 3 : 0) + (summary.has(w) ? 1 : 0);
  const lt = topics.map((t) => t.toLowerCase());
  if (v.topics.some((t) => lt.includes(t.toLowerCase()))) s += 6;
  return s;
}

/**
 * The visuals offered to the model. The whole registry while its catalog fits
 * `max_chars` (an identical system prompt for every question, so the provider's
 * prefix cache hits); beyond that the most relevant ones, in registry order.
 */
export function offer(question: string, ctx: AskContext = {}, o: { max_chars?: number; diagnosis?: string; all?: Visual<any>[] } = {}): Visual<any>[] {
  const all = o.all ?? list_visuals();
  const max = o.max_chars ?? 7000;
  if (catalog_text(all).length <= max) return all;
  const text = [question, o.diagnosis, ctx.lesson, ctx.step, ctx.on_screen?.slice(0, 600)].filter(Boolean).join(' ');
  const ranked = all.map((v, i) => ({ v, i, s: relevance(v, text, ctx.topics), len: catalog_text([v]).length + 1 })).sort((a, b) => b.s - a.s || a.i - b.i);
  const pick: typeof ranked = [];
  let len = 0;
  for (const r of ranked) {
    if (len + r.len > max) continue;
    pick.push(r);
    len += r.len;
  }
  return pick.sort((a, b) => a.i - b.i).map((r) => r.v);
}

export function plan_system(offered: Visual<any>[]): string {
  return `${PLAN_RULES}\n\nCATALOG (name - what it shows and what the student does; then each parameter: name: type range =default - meaning)\n${catalog_text(offered)}`;
}

/** The language to write in: the context's, else a guess from the question's script. */
export function answer_language(question: string, ctx: AskContext = {}): string {
  if (ctx.language) return ctx.language;
  if (/[\u4e00-\u9fff]/.test(question)) return 'Chinese';
  if (/[\u3040-\u30ff]/.test(question)) return 'Japanese';
  if (/[\uac00-\ud7af]/.test(question)) return 'Korean';
  if (/[\u0400-\u04ff]/.test(question)) return 'Russian';
  const letters = question.match(/\p{L}/gu) ?? [];
  // English needs a real word: a formula like 'r(d+k)?' does not tell the language
  if (letters.length && /[a-z]{2,}/i.test(question) && letters.filter((ch) => /[a-z]/i.test(ch)).length / letters.length > 0.95 && !/\b(el|la|les|der|die|das|und|est|il|che|por|para)\b/i.test(question)) return 'English';
  // the script does not decide (e.g. a formula, or Latin letters that are not clearly English): the app's language
  return ctx.learner_language ?? 'the language of the QUESTION';
}

export function plan_user(question: string, ctx: AskContext = {}, diagnosis?: string): string {
  const parts = [context_block({ ...ctx, language: undefined }, { max_screen: 1800 })];
  if (diagnosis) parts.push(`What the student most likely needs: ${diagnosis}`);
  parts.push(`QUESTION: ${question}`);
  return `${parts.join('\n\n')}\n\nWrite caption, followups and check in ${answer_language(question, ctx)}. Reply with the JSON object.`;
}

/** Pull the plan out of a reply (tolerates code fences and stray prose). Throws when it is unusable. */
export function parse_visual_plan(text: string): VisualPlan {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(raw ? 'the reply contained no JSON object' : 'the reply was empty');
  let obj: any;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    throw new Error(`the JSON could not be parsed (${(e as Error).message})`);
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('expected a JSON object');
  let visual = obj.visual;
  if (visual === undefined || (typeof visual === 'string' && /^\s*(null|none|)\s*$/i.test(visual))) visual = null;
  if (visual !== null && typeof visual !== 'string') throw new Error('"visual" must be a name from the catalog, or null');
  if (obj.params != null && (typeof obj.params !== 'object' || Array.isArray(obj.params))) throw new Error('"params" must be an object of parameter values');
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  let check: VisualPlan['check'];
  if (typeof obj.check === 'string' && obj.check.trim()) check = { question: obj.check.trim() };
  else if (obj.check && typeof obj.check === 'object' && str(obj.check.question ?? obj.check.q)) {
    check = { question: str(obj.check.question ?? obj.check.q), answer: str(obj.check.answer ?? obj.check.a) || undefined };
  }
  return {
    visual: visual === null ? null : visual.trim(),
    params: obj.params ?? {},
    caption: str(obj.caption),
    followups: Array.isArray(obj.followups) ? obj.followups.map(str).filter(Boolean).slice(0, 3) : [],
    check,
  };
}

export interface PlanCheck {
  visual: Visual<Params> | null;
  params: Params;
  /** Adjustments made by check_params (clamped, rounded). */
  notes: string[];
  /** What could not be used (unknown visual or parameter, wrong type). */
  errors: string[];
}

/** Resolve the visual and check its parameters against the registry. */
export function check_visual_plan(plan: VisualPlan, lookup: (name: string) => Visual<Params> | undefined = get_visual): PlanCheck {
  if (plan.visual === null) return { visual: null, params: {}, notes: [], errors: [] };
  const v = lookup(plan.visual);
  if (!v) return { visual: null, params: {}, notes: [], errors: [`there is no visual "${plan.visual}" in the CATALOG`] };
  const pc = check_params(v, plan.params);
  return { visual: v, params: pc.params, notes: pc.notes, errors: pc.errors };
}

/** The message that sends problems back to the model (one round-trip). */
export function plan_repair_message(problems: string[], offered: string[]): string {
  return `That JSON cannot be used:\n${problems.map((p) => `- ${p}`).join('\n')}\n\nVisual names: ${offered.join(', ')} (or null). Use only the parameters listed for the visual. Return the corrected JSON object only.`;
}

export interface PlanResult {
  /** The plan as the model wrote it (the repaired one when a repair was used); null when no reply could be parsed. */
  plan: VisualPlan | null;
  visual: Visual<Params> | null;
  /** Checked parameters (defaults filled, numbers clamped). */
  params: Params;
  notes: string[];
  errors: string[];
  repaired: boolean;
  calls: { ms: number; reply: string; usage?: Usage }[];
  /** Names that were offered in the catalog. */
  offered: string[];
  ms: number;
}

export interface PlanOptions {
  provider: Provider;
  context?: AskContext;
  /** The tutor's one-line reading of the question, when it is known in time. */
  diagnosis?: string;
  signal?: AbortSignal;
  /** Default 'off': picking from a catalog does not need thinking (see the header). */
  reasoning?: Reasoning;
  /** JSON mode (default true). */
  json?: boolean;
  /** Per call (default 15 s); a call that takes longer is aborted. */
  timeout_ms?: number;
  /** Skip the repair when the first call already took this long and its visual is usable with defaults (default 6 s). */
  repair_budget_ms?: number;
  max_catalog_chars?: number;
  /** The registry to read (default: all registered visuals, read now). */
  visuals?: Visual<any>[];
  on_usage?: (u: Usage) => void;
}

async function call_with_timeout(provider: Provider, system: string, messages: Message[], o: PlanOptions): Promise<{ reply: string; ms: number; usage?: Usage }> {
  const ctrl = new AbortController();
  const ms_limit = o.timeout_ms ?? 15000;
  const abort = () => ctrl.abort();
  o.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, ms_limit);
  const t0 = performance.now();
  let usage: Usage | undefined;
  try {
    const reasoning = o.reasoning ?? 'off';
    const reply = await provider.complete(
      { system, messages, cache_system: true, json: o.json ?? true, reasoning, max_tokens: reasoning === 'off' ? 1500 : 8000, on_usage: (u) => ((usage = u), o.on_usage?.(u)) },
      ctrl.signal,
    );
    return { reply, ms: performance.now() - t0, usage };
  } catch (e) {
    if (ctrl.signal.aborted && !o.signal?.aborted) throw new Error(`the picture plan took longer than ${ms_limit / 1000} s`);
    throw e;
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener('abort', abort);
  }
}

/**
 * Ask the model for a picture plan and check it. Model mistakes (bad JSON,
 * unknown visual, wrong parameter types) get one repair round-trip; network
 * and API errors are thrown.
 */
export async function plan_visual(question: string, o: PlanOptions): Promise<PlanResult> {
  const t0 = performance.now();
  const all = o.visuals ?? list_visuals();
  const offered = offer(question, o.context, { max_chars: o.max_catalog_chars, diagnosis: o.diagnosis, all });
  const names = offered.map((v) => v.name);
  const lookup = (n: string) => all.find((v) => v.name === n) as Visual<Params> | undefined;
  const system = plan_system(offered);
  const messages: Message[] = [{ role: 'user', content: plan_user(question, o.context, o.diagnosis) }];
  const calls: PlanResult['calls'] = [];
  type Try = { plan: VisualPlan | null; check: PlanCheck; problems: string[] };
  const attempt = async (): Promise<Try> => {
    const c = await call_with_timeout(o.provider, system, messages, o);
    calls.push(c);
    messages.push({ role: 'assistant', content: c.reply });
    try {
      const plan = parse_visual_plan(c.reply);
      const check = check_visual_plan(plan, lookup);
      return { plan, check, problems: check.errors };
    } catch (e) {
      const msg = `the reply could not be used: ${(e as Error).message}`;
      return { plan: null, check: { visual: null, params: {}, notes: [], errors: [msg] }, problems: [msg] };
    }
  };
  const first = await attempt();
  let best = first;
  let repaired = false;
  const usable_anyway = first.check.visual !== null; // a known visual still builds with defaults for bad parameters
  if (first.problems.length && !(usable_anyway && performance.now() - t0 > (o.repair_budget_ms ?? 6000))) {
    messages.push({ role: 'user', content: plan_repair_message(first.problems, names) });
    repaired = true;
    try {
      const second = await attempt();
      // keep the repair unless it lost the visual that the first reply had
      if (second.check.visual || second.plan?.visual === null || !first.check.visual) best = second;
    } catch (e) {
      if (o.signal?.aborted) throw e;
      first.check.errors.push(`the repair failed: ${(e as Error).message}`);
    }
  }
  return { plan: best.plan, visual: best.check.visual, params: best.check.params, notes: best.check.notes, errors: best.check.errors, repaired, calls, offered: names, ms: performance.now() - t0 };
}

/** Where the picture comes from. */
export type PictureRoute =
  | { kind: 'visual'; visual: Visual<Params>; params: Params }
  /** no_visual: the model chose none; invalid: nothing usable after the repair; failed: the call failed or timed out. */
  | { kind: 'freeform'; reason: 'no_visual' | 'invalid' | 'failed'; detail?: string };

/** The fallback ladder: a checked visual, else the free-form scene in the background. */
export function decide(r: PlanResult | null | undefined, error?: unknown): PictureRoute {
  if (!r) return { kind: 'freeform', reason: 'failed', detail: error ? String((error as Error)?.message ?? error) : undefined };
  if (r.visual) return { kind: 'visual', visual: r.visual, params: r.params };
  if (r.plan && r.plan.visual === null) return { kind: 'freeform', reason: 'no_visual' };
  return { kind: 'freeform', reason: 'invalid', detail: r.errors.join('; ') };
}

/** Build a visual's scene on a canvas in the current theme (records the timeline). */
export async function load_visual(v: Visual<Params>, params: Params, canvas: HTMLCanvasElement | OffscreenCanvas, o: { tex?: boolean } = {}): Promise<ScenePlayer> {
  await preload({ tex: o.tex });
  const player = new ScenePlayer(v.scene(params), canvas, { audio: false });
  apply_palette(player);
  await player.load();
  return player;
}

/** The accent colour of the current theme (for handles drawn over a visual). */
export const visual_accent = (): string => palette().accent;
