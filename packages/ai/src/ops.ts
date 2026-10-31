// The fixed operations behind /api/ai: what each one asks the model. The server runs them (apps/mathnim/server/ai.ts);
// in development a model called from the page can run them too (local_backend.ts). Production pages never load this
// module: the prompts and the engine's API digest stay on the server. Inputs come from the browser, so parse_op checks
// them and cuts every text to size before a prompt is written.
import type { AskContext, ScenePromptExtra } from './prompt';
import type { CompletionRequest, Message } from './provider';
import type { OpInputs, OpName, Round } from './ops_types';
import { CATALOG } from './prompts/catalog.generated';
import { GRADE_TEXT_RULES, grade_text_prompt } from './prompts/grade';
import { LESSON_PLAN_RULES, plan_prompt } from './prompts/lesson';
import { FIT_RULES, PROPOSE_RULES, WRITE_RULES, page_context } from './prompts/page';
import { plan_repair_message, plan_system, plan_user } from './prompts/plan';
import { repair_prompt, system_prompt, user_prompt } from './prompts/scene';
import { starters_prompt, starters_rules } from './prompts/starters';
import { TUTOR_RULES, tutor_prompt } from './prompts/tutor';

export const OPS: readonly OpName[] = ['tutor', 'plan', 'scene', 'starters', 'grade_text', 'propose_page', 'fit_text', 'write_page', 'lesson_plan'];

/** The first message, then each repair round: the model's reply and the problems sent back. */
function with_rounds(first: string, rounds: Round[] | undefined, repair: (problems: string[]) => string): Message[] {
  const m: Message[] = [{ role: 'user', content: first }];
  for (const r of rounds ?? []) m.push({ role: 'assistant', content: r.reply }, { role: 'user', content: repair(r.problems) });
  return m;
}

/** What an operation sends the model. `shared` replies are the same for everyone (the server may cache them). */
export function build_op<K extends OpName>(op: K, input: OpInputs[K]): CompletionRequest {
  switch (op) {
    case 'tutor': {
      // (thinking 'low': with deepseek-flash the first word came after 2.2-4.8 s at the model's default, 1.5-1.8 s with
      // 'low', 0.8-1.3 s with 'off'; picking a visual needs none: 1.1-1.7 s off, 2.8-3.6 s high, the same choices)
      const a = input as OpInputs['tutor'];
      return { system: TUTOR_RULES, messages: [{ role: 'user', content: tutor_prompt(a.question, a.context) }], max_tokens: 2000, cache_system: true, reasoning: 'low' };
    }
    case 'plan': {
      const a = input as OpInputs['plan'];
      const offered = a.offered.filter((n) => CATALOG[n]);
      return {
        system: plan_system(offered.map((n) => CATALOG[n])),
        messages: with_rounds(plan_user(a.question, a.context, a.diagnosis), a.rounds, (p) => plan_repair_message(p, offered)),
        cache_system: true, json: true, reasoning: 'off', max_tokens: 1500,
      };
    }
    case 'scene': {
      const a = input as OpInputs['scene'];
      return { system: system_prompt(), messages: with_rounds(user_prompt(a.question, a.context, a.extra), a.rounds, (p) => repair_prompt(p.join('\n'))), cache_system: true, max_tokens: 32000 };
    }
    case 'starters': {
      const a = input as OpInputs['starters'];
      return { system: starters_rules(a.lang), messages: [{ role: 'user', content: starters_prompt(a) }], json: true, reasoning: 'off', max_tokens: 240, shared: true };
    }
    case 'grade_text': {
      const a = input as OpInputs['grade_text'];
      return { system: GRADE_TEXT_RULES, messages: [{ role: 'user', content: grade_text_prompt(a) }], json: true, reasoning: 'off', max_tokens: 600, cache_system: true };
    }
    case 'propose_page': {
      const a = input as OpInputs['propose_page'];
      return { system: PROPOSE_RULES, messages: [{ role: 'user', content: `${page_context(a)}\n\nWrite the title and why in ${a.language}.` }], json: true, reasoning: 'off', max_tokens: 200 };
    }
    case 'fit_text': {
      const a = input as OpInputs['fit_text'];
      return { system: FIT_RULES, messages: [{ role: 'user', content: `${page_context(a)}\n\nTHE PASSAGE ASKED ABOUT: ${a.passage}\n\nWrite in ${a.language}.` }], json: true, reasoning: 'low', max_tokens: 600 };
    }
    case 'write_page': {
      const a = input as OpInputs['write_page'];
      const first = `${page_context(a)}\n\nWrite the page "${a.title}" in ${a.language}.`;
      return { system: WRITE_RULES, messages: with_rounds(first, a.rounds, (p) => `That page could not be used: ${p.join('; ')}. Reply with the corrected JSON object only.`), json: true, reasoning: 'low', max_tokens: 6000 };
    }
    case 'lesson_plan': {
      const a = input as OpInputs['lesson_plan'];
      return { system: LESSON_PLAN_RULES, messages: [{ role: 'user', content: plan_prompt(a.entry) }], max_tokens: 6000 };
    }
  }
  throw new Error(`unknown operation ${String(op)}`);
}

// ---------------------------------------------------------------- inputs from the browser
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const opt = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v ? v.slice(0, max) : undefined);
const strs = (v: unknown, n: number, max: number): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x) => (x as string).slice(0, max)) : []);
function need(v: unknown, max: number, what: string): string {
  const s = str(v, max).trim();
  if (!s) throw new Error(`${what} is required`);
  return s;
}
function context(v: unknown): AskContext | undefined {
  if (v === undefined) return undefined;
  const c = obj(v);
  const recent = Array.isArray(c.recent) ? c.recent.slice(-3).map((r) => ({ q: str(obj(r).q, 500), a: str(obj(r).a, 600) })) : undefined;
  return {
    lesson: opt(c.lesson, 400), step: opt(c.step, 300), on_screen: opt(c.on_screen, 6000), learner: opt(c.learner, 600),
    misconceptions: strs(c.misconceptions, 8, 300), recent, level: opt(c.level, 200), language: opt(c.language, 40),
    learner_language: opt(c.learner_language, 40), topics: strs(c.topics, 12, 60), selected: opt(c.selected, 1200), unanswered: c.unanswered === true || undefined,
  };
}
function extra(v: unknown): ScenePromptExtra | undefined {
  if (v === undefined) return undefined;
  const e = obj(v);
  return { diagnosis: opt(e.diagnosis, 400), text_shown: e.text_shown === true || undefined };
}
const rounds = (v: unknown): Round[] => (Array.isArray(v) ? v.slice(0, 3).map((r) => ({ reply: str(obj(r).reply, 40_000), problems: strs(obj(r).problems, 20, 1000) })) : []);
function page_ask(v: Record<string, unknown>) {
  return { lesson: str(v.lesson, 400), page: str(v.page, 300), on_screen: opt(v.on_screen, 6000), question: need(v.question, 2000, 'question'), answer: str(v.answer, 4000), language: str(v.language, 40) || 'English' };
}

/** An operation and its inputs as the browser sent them: checked, with every text cut to size. Throws on what cannot be used. */
export function parse_op(body: unknown): { op: OpName; input: OpInputs[OpName] } {
  const b = obj(body);
  const op = b.op as OpName;
  if (!OPS.includes(op)) throw new Error(`unknown operation (one of ${OPS.join(', ')})`);
  const i = obj(b.input);
  switch (op) {
    case 'tutor':
      return { op, input: { question: need(i.question, 2000, 'question'), context: context(i.context) } };
    case 'plan':
      return { op, input: { question: need(i.question, 2000, 'question'), context: context(i.context), diagnosis: opt(i.diagnosis, 400), offered: strs(i.offered, 200, 80), rounds: rounds(i.rounds) } };
    case 'scene':
      return { op, input: { question: need(i.question, 2000, 'question'), context: context(i.context), extra: extra(i.extra), rounds: rounds(i.rounds) } };
    case 'starters':
      return { op, input: { lesson: str(i.lesson, 400), page: str(i.page, 300), text: str(i.text, 2600), lang: i.lang === 'zh' ? 'zh' : 'en' } };
    case 'grade_text':
      return { op, input: { question: str(i.question, 2000), answer: need(i.answer, 4000, 'answer'), key_points: strs(i.key_points, 8, 500), model_answer: str(i.model_answer, 2000), language: str(i.language, 40) || 'English' } };
    case 'propose_page':
      return { op, input: page_ask(i) };
    case 'fit_text':
      return { op, input: { ...page_ask(i), passage: str(i.passage, 1500) } };
    case 'write_page':
      return { op, input: { ...page_ask(i), title: need(i.title, 200, 'title'), rounds: rounds(i.rounds) } };
    case 'lesson_plan': {
      const e = obj(i.entry);
      return { op, input: { entry: { id: str(e.id, 80), title: need(e.title, 300, 'title'), unit: opt(e.unit, 200), objectives: strs(e.objectives, 10, 300), level: opt(e.level, 200), prerequisites: strs(e.prerequisites, 10, 120) } } };
    }
  }
  throw new Error('unknown operation');
}
