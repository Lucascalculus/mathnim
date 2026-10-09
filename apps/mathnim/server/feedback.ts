// /api/feedback: "did this answer help?" from learners, and the review queue
// for teachers.
//   POST {question, answer_id, helpful, note?} -> 201 {ok, id}
//        stored in KV (binding FEEDBACK) for FEEDBACK_TTL; "not helpful" also
//        drops the cached answer with that id (see deepseek.ts).
//   GET  ?limit=50&cursor=... with "Authorization: Bearer <ADMIN_TOKEN>"
//        -> {items: FeedbackItem[] (newest first), cursor?}
//        Refused while ADMIN_TOKEN is unset.
import { answer_cache_key } from './deepseek';
import { client_ip, client_tag, error, json, origin_ok, read_text, same_secret, too_many, type KVLike, type Note, type Parsed, type RateLimiter, type TextCache } from './http';

export interface FeedbackEnv {
  FEEDBACK?: KVLike;
  ADMIN_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}
export interface FeedbackDeps {
  limiter: RateLimiter | null;
  answers: TextCache | null;
}
export interface FeedbackInput {
  question: string;
  answer_id: string;
  helpful: boolean;
  note?: string;
}
export interface FeedbackItem extends FeedbackInput {
  id: string;
  /** ISO time. */
  t: string;
  /** Tells feedback from the same visitor apart within a day (not the address). */
  client: string;
}
export const FEEDBACK_TTL = 180 * 86_400;
export const MAX_QUESTION = 2000;
export const MAX_NOTE = 2000;
export const MAX_ANSWER_ID = 200;

export function parse_feedback(text: string): Parsed<FeedbackInput> {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON.' };
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, status: 400, error: 'Expected a JSON object.' };
  const { question, answer_id, helpful, note } = d;
  if (typeof question !== 'string' || !question.trim()) return { ok: false, status: 400, error: 'question: a non-empty string is required.' };
  if (question.length > MAX_QUESTION) return { ok: false, status: 413, error: `question: at most ${MAX_QUESTION} characters.` };
  if (typeof answer_id !== 'string' || !answer_id.trim()) return { ok: false, status: 400, error: 'answer_id: a non-empty string is required.' };
  if (answer_id.length > MAX_ANSWER_ID) return { ok: false, status: 400, error: `answer_id: at most ${MAX_ANSWER_ID} characters.` };
  if (typeof helpful !== 'boolean') return { ok: false, status: 400, error: 'helpful: true or false.' };
  if (note !== undefined && note !== null && typeof note !== 'string') return { ok: false, status: 400, error: 'note: a string.' };
  if (typeof note === 'string' && note.length > MAX_NOTE) return { ok: false, status: 413, error: `note: at most ${MAX_NOTE} characters.` };
  const out: FeedbackInput = { question: question.trim(), answer_id: answer_id.trim(), helpful };
  if (typeof note === 'string' && note.trim()) out.note = note.trim();
  return { ok: true, value: out };
}

/** KV lists keys in ascending order, so the key counts down: newest first. */
export const feedback_key = (now: number, rand: string) => `fb:${String(1e13 - now).padStart(13, '0')}:${rand}`;
export function parse_limit(q: string | null): number {
  const n = Math.floor(Number(q ?? 50));
  return Number.isFinite(n) ? Math.min(200, Math.max(1, n)) : 50;
}

export async function feedback(request: Request, env: FeedbackEnv, deps: FeedbackDeps, note: Note): Promise<Response> {
  if (request.method === 'POST') return submit(request, env, deps, note);
  if (request.method === 'GET') return review(request, env);
  return error(405, 'Use POST (or GET with the admin token).', { allow: 'GET, POST' });
}

async function submit(request: Request, env: FeedbackEnv, deps: FeedbackDeps, note: Note): Promise<Response> {
  if (!env.FEEDBACK) return error(503, 'Feedback storage is not configured.');
  if (!origin_ok(request, env.ALLOWED_ORIGINS)) return error(403, 'Requests must come from the Mathnim site.');
  const text = await read_text(request, 16 * 1024);
  if (text === null) return error(413, 'Request too large.');
  const p = parse_feedback(text);
  if (!p.ok) return error(p.status, p.error);
  const v = deps.limiter?.hit(client_ip(request));
  if (v && !v.ok) return too_many(v, 'feedback messages');
  const now = Date.now();
  const id = feedback_key(now, crypto.randomUUID().slice(0, 8));
  const item: FeedbackItem = { id, t: new Date(now).toISOString(), client: client_tag(client_ip(request), now), ...p.value };
  await env.FEEDBACK.put(id, JSON.stringify(item), { expirationTtl: FEEDBACK_TTL });
  note.chars = p.value.question.length + (p.value.note?.length ?? 0);
  // a cached answer that did not help should not be served again
  if (!p.value.helpful && deps.answers) note.after = deps.answers.delete(answer_cache_key(p.value.answer_id)).catch(() => undefined);
  return json(201, { ok: true, id });
}

async function review(request: Request, env: FeedbackEnv): Promise<Response> {
  if (!env.ADMIN_TOKEN) return error(503, 'Feedback review is off: the ADMIN_TOKEN secret is not set.');
  const auth = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() ?? '';
  if (!token || !same_secret(token, env.ADMIN_TOKEN)) return error(401, 'Admin token required.', { 'www-authenticate': 'Bearer' });
  if (!env.FEEDBACK) return error(503, 'Feedback storage is not configured.');
  const url = new URL(request.url);
  const page = await env.FEEDBACK.list({ prefix: 'fb:', limit: parse_limit(url.searchParams.get('limit')), cursor: url.searchParams.get('cursor') ?? undefined });
  const values = await Promise.all(page.keys.map((k) => env.FEEDBACK!.get(k.name)));
  const items: FeedbackItem[] = [];
  for (const v of values) {
    try {
      if (v) items.push(JSON.parse(v));
    } catch {
      /* skip a damaged record */
    }
  }
  return json(200, { items, ...(page.list_complete ? {} : { cursor: page.cursor }) });
}
