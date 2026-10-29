// The learner's account: signed in with a code sent by email (server/auth.ts),
// and their records kept in step with the server (server/sync.ts) so progress,
// notes and reviews follow them to another device. Nothing changes for a
// learner who does not sign in: everything stays in this browser.
import { load_events, type LearningEvent } from '@mathnim/core';
import { all_skills, course_of } from './course';
import { learner, log } from './store';

export interface Me {
  id: string;
  email: string;
  admin: boolean;
}
let me: Me | null = null;
/** False when this server has no accounts (the sign-in entry is not shown). */
let available = false;
/** Whether files can be uploaded here, and whether a model is connected to make courses of them. */
let studio = false;
let generate = false;
const listeners = new Set<() => void>();
export const current_user = () => me;
export const accounts_available = () => available;
export const studio_available = () => available && studio;
export const generate_available = () => studio_available() && generate;
/** Called when the learner signs in or out. */
export function on_user(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
const changed = () => listeners.forEach((f) => f());

async function call<T>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const r = await fetch(`/api/${path}`, { ...init, headers: { 'content-type': 'application/json', ...init.headers }, credentials: 'same-origin' });
  let data = {} as T & { error?: string };
  try {
    data = await r.json();
  } catch {
    /* not JSON: a static host without the API */
  }
  return { ok: r.ok, status: r.status, data };
}

/** Ask the server who is signed in; false when it did not answer (slow or offline), so nothing is known yet. */
async function ask_me(timeout_ms: number): Promise<boolean> {
  try {
    const r = await call<{ user: Me | null; mail?: boolean; studio?: boolean; generate?: boolean }>('auth/me', { signal: AbortSignal.timeout(timeout_ms) });
    studio = r.ok && !!r.data.studio;
    generate = r.ok && !!r.data.generate;
    // sign-in is offered once the server can mail codes (a signed-in learner keeps their account regardless)
    available = r.ok && 'user' in r.data && (r.data.mail !== false || !!r.data.user);
    me = r.ok ? r.data.user ?? null : null;
    return true;
  } catch {
    available = false;
    me = null;
    return false;
  }
}
const late = new Set<() => void>();
/** Called when the server answered only after the page was up: the account entry is drawn then (the page stays). */
export function on_account_late(f: () => void): () => void {
  late.add(f);
  return () => late.delete(f);
}
/** Who is signed in (at start). A server that does not answer in time is asked again in the background, so a slow
 *  start never hides the account for the whole visit. */
export async function load_me(): Promise<Me | null> {
  if (await ask_me(4000)) {
    if (me) await sync().catch(() => undefined);
    return me;
  }
  void (async () => {
    for (const wait of [2000, 6000, 20000]) {
      await new Promise((r) => setTimeout(r, wait));
      if (!(await ask_me(15000))) continue;
      if (me) await sync().catch(() => undefined);
      late.forEach((f) => f());
      return;
    }
  })();
  return null;
}

/** Ask for a code by mail. On the dev server without mail, the code comes back (`dev_code`). */
export async function send_code(email: string, lang: 'en' | 'zh'): Promise<{ error?: string; dev_code?: string }> {
  try {
    const r = await call<{ dev_code?: string }>('auth/start', { method: 'POST', body: JSON.stringify({ email, lang }) });
    return r.ok ? { dev_code: r.data.dev_code } : { error: r.data.error ?? `HTTP ${r.status}` };
  } catch {
    return { error: 'offline' };
  }
}
export async function verify_code(email: string, code: string): Promise<{ error?: string }> {
  try {
    const r = await call<{ user: Me }>('auth/verify', { method: 'POST', body: JSON.stringify({ email, code }) });
    if (!r.ok) return { error: r.data.error ?? `HTTP ${r.status}` };
    me = r.data.user;
    // a new device takes the account's progress; this browser's own records go up for the others
    await sync().catch(() => undefined);
    changed();
    return {};
  } catch {
    return { error: 'offline' };
  }
}
export async function sign_out(): Promise<void> {
  await push().catch(() => undefined);
  await push_events().catch(() => undefined);
  // what could not be sent stays unsent: it must not go to whoever signs in next here
  write_outbox([]);
  try {
    localStorage.removeItem(BACKFILLED);
  } catch {
    /* no storage */
  }
  await call('auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined);
  me = null;
  changed();
}

// ---------------------------------------------------------------- keeping records in step
// mathnim.sync remembers, per record, a hash of the value last agreed with the
// server and its time: a record whose hash changed here goes up; a record the
// server has newer comes down.
const META = 'mathnim.sync';
const MAX_VALUE = 1024 * 1024;
type Meta = Record<string, { h: number; t: number }>;
// (the event log goes to its own table, below)
const syncable = (k: string) => k.startsWith('mathnim.') && k !== 'mathnim.settings' && k !== 'mathnim.events' && !k.startsWith('mathnim.sync') && !k.startsWith('mathnim.generated.');
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
function load_meta(): Meta {
  try {
    return JSON.parse(localStorage.getItem(META) ?? '{}');
  } catch {
    return {};
  }
}
const save_meta = (m: Meta) => {
  try {
    localStorage.setItem(META, JSON.stringify(m));
  } catch {
    /* full or blocked */
  }
};

async function pull(): Promise<void> {
  const r = await call<{ items: Record<string, { value: string; t: number }> }>('me/state');
  if (!r.ok) return;
  const meta = load_meta();
  let learner_changed = false;
  for (const [k, v] of Object.entries(r.data.items ?? {})) {
    if (!syncable(k) || v.t <= (meta[k]?.t ?? 0)) continue;
    try {
      localStorage.setItem(k, v.value);
    } catch {
      continue;
    }
    meta[k] = { h: hash(v.value), t: v.t };
    if (k === 'mathnim.learner') learner_changed = true;
  }
  save_meta(meta);
  // the learner model lives in memory: take the account's version in
  if (learner_changed) {
    try {
      learner.state = JSON.parse(localStorage.getItem('mathnim.learner')!);
      learner.add_skills(all_skills());
    } catch {
      /* keep the one in memory */
    }
  }
}

async function push(): Promise<void> {
  if (!me) return;
  const meta = load_meta();
  const items: { key: string; value: string; t: number }[] = [];
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !syncable(k)) continue;
    const v = localStorage.getItem(k) ?? '';
    if (v.length > MAX_VALUE || meta[k]?.h === hash(v)) continue;
    items.push({ key: k, value: v, t: now });
  }
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100);
    const r = await call('me/state', { method: 'PUT', body: JSON.stringify({ items: batch }), keepalive: batch.reduce((n, x) => n + x.value.length, 0) < 60_000 });
    if (!r.ok) return;
    for (const x of batch) meta[x.key] = { h: hash(x.value), t: x.t };
    save_meta(meta);
  }
}

// ---------------------------------------------------------------- learning events
// Every learning event of a signed-in learner also goes to the account (/api/me/events, server/events.ts),
// where one table keeps them all: what personalisation reads and analytics query. They wait in
// mathnim.sync.events until sent; at the first sign-in in a browser, its earlier log goes up too. Each
// event's id is made from its content, so one sent twice is stored once. The tutor's own log of its
// pictures stays here: a question and its answer go as one 'asked' event, words only.
const OUTBOX = 'mathnim.sync.events';
const OUTBOX_MAX = 3000;
/** The user whose earlier events this browser has queued already. */
const BACKFILLED = 'mathnim.sync.backfilled';
type WireEvent = LearningEvent & { id: string; course?: string };

function wire(e: LearningEvent): WireEvent | null {
  if (e.verb === 'interacted' && (e.object === 'ask' || e.object === 'answer')) return null;
  return { id: `${e.t.toString(36)}-${hash(JSON.stringify(e)).toString(36)}`, course: e.lesson ? course_of(e.lesson)?.id : undefined, ...e };
}
function read_outbox(): WireEvent[] {
  try {
    const v = JSON.parse(localStorage.getItem(OUTBOX) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write_outbox(list: WireEvent[]): void {
  try {
    if (list.length) localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-OUTBOX_MAX)));
    else localStorage.removeItem(OUTBOX);
  } catch {
    /* full or blocked: these are lost, the next ones may fit */
  }
}
function queue(list: WireEvent[]): void {
  if (!list.length) return;
  const all = read_outbox();
  const ids = new Set(all.map((x) => x.id));
  write_outbox([...all, ...list.filter((x) => !ids.has(x.id))]);
}
log.add_sink((e) => {
  const w = me && wire(e);
  if (w) queue([w]);
});
/** At the first sign-in in this browser: its log so far, learnt before signing in. */
function backfill(): void {
  if (!me) return;
  try {
    if (localStorage.getItem(BACKFILLED) === me.id) return;
    queue(load_events('mathnim.events').map(wire).filter((x): x is WireEvent => !!x));
    localStorage.setItem(BACKFILLED, me.id);
  } catch {
    /* no storage */
  }
}
/** Send the queued events, a batch at a time (small enough to go as the page closes when it is hidden). */
async function push_events(closing = false): Promise<void> {
  for (let round = 0; round < 20 && me; round++) {
    const all = read_outbox();
    if (!all.length) return;
    const batch: WireEvent[] = [];
    let size = 0;
    for (const x of all) {
      const n = JSON.stringify(x).length;
      if (batch.length >= 200 || (batch.length && size + n > (closing ? 60_000 : 400_000))) break;
      batch.push(x);
      size += n;
    }
    const r = await call('me/events', { method: 'POST', body: JSON.stringify({ events: batch }), keepalive: closing });
    if (!r.ok) return;
    const sent = new Set(batch.map((x) => x.id));
    write_outbox(read_outbox().filter((x) => !sent.has(x.id)));
    if (closing) return;
  }
}

let timer = 0;
async function sync(): Promise<void> {
  await pull();
  await push();
  backfill();
  await push_events();
  if (!timer) {
    // while signed in: every half minute, and when the page is hidden (closing a tab, switching apps)
    // (as the page closes both start at once: it may be gone before the first one answers)
    const both = (closing: boolean) => void (closing ? Promise.all([push(), push_events(true)]) : push().then(() => push_events())).catch(() => undefined);
    timer = window.setInterval(() => both(false), 30_000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && both(true));
  }
}
