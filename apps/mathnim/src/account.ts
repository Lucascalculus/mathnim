// The learner's account: signed in with a code sent by email (server/auth.ts),
// and their records kept in step with the server (server/sync.ts) so progress,
// notes and reviews follow them to another device. Nothing changes for a
// learner who does not sign in: everything stays in this browser.
import { all_skills } from './course';
import { learner } from './store';

export interface Me {
  id: string;
  email: string;
  admin: boolean;
}
let me: Me | null = null;
/** False when this server has no accounts (the sign-in entry is not shown). */
let available = false;
const listeners = new Set<() => void>();
export const current_user = () => me;
export const accounts_available = () => available;
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

/** Who is signed in (once, at start). */
export async function load_me(): Promise<Me | null> {
  try {
    const r = await call<{ user: Me | null }>('auth/me', { signal: AbortSignal.timeout(4000) });
    available = r.ok && 'user' in r.data;
    me = r.ok ? r.data.user ?? null : null;
  } catch {
    available = false;
    me = null;
  }
  if (me) await sync().catch(() => undefined);
  return me;
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
const syncable = (k: string) => k.startsWith('mathnim.') && k !== 'mathnim.settings' && !k.startsWith('mathnim.sync') && !k.startsWith('mathnim.generated.');
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

let timer = 0;
async function sync(): Promise<void> {
  await pull();
  await push();
  if (!timer) {
    // while signed in: every half minute, and when the page is hidden (closing a tab, switching apps)
    timer = window.setInterval(() => void push().catch(() => undefined), 30_000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void push().catch(() => undefined));
  }
}
