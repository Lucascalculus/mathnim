// /api/auth/*: sign in with a code sent by email, no passwords.
//   POST start  {email, lang?}  -> 200 {ok} (and {dev_code} on the dev server without a mail key)
//   POST verify {email, code}   -> 200 {user} + the session cookie
//   GET  me                     -> 200 {user | null, mail, studio}  (codes can be sent; courses can be made from uploads)
//   POST logout                 -> 200 {ok}, cookie cleared
// Codes are six digits, live 10 minutes, allow 5 tries, and are stored hashed;
// sessions are a random token in an HttpOnly cookie, stored hashed. Mail goes
// through Resend (RESEND_API_KEY, MAIL_FROM).
import { with_schema, new_id, type DataEnv, type SqlDb } from './db';
import { client_ip, error, json, list, origin_ok, read_text, sha256_hex, too_many, type Note, type RateLimiter } from './http';

export interface AuthEnv extends DataEnv {
  RESEND_API_KEY?: string;
  /** e.g. "Mathnim <login@penghaolun.com>" (a domain verified in Resend). */
  MAIL_FROM?: string;
  /** Who may publish uploaded courses to everyone (comma-separated). */
  ADMIN_EMAILS?: string;
}
export interface AuthDeps {
  limiter: RateLimiter | null;
  /** The dev server: without a mail key, the code is logged and returned instead of sent. */
  dev?: boolean;
  /** Can courses be made from uploads here (a model is connected)? Told to the site, which offers the studio only then. */
  studio?: boolean;
  /** Sends mail (tests replace it); default: Resend. */
  send?: (env: AuthEnv, mail: Mail) => Promise<void>;
}
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}
export interface User {
  id: string;
  email: string;
  admin: boolean;
}

export const COOKIE = 'mn_sid';
const CODE_MS = 10 * 60_000;
const SESSION_S = 60 * 86_400;
const RESEND_AFTER_MS = 45_000;
const CODES_PER_DAY = 10;
const TRIES = 5;

/** A plausible address, lower-cased; null when it is not one. */
export function normal_email(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const e = s.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
const code_hash = (email: string, code: string) => sha256_hex(`login:${email}:${code}`);
function six_digits(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
}
function token(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const is_admin = (env: AuthEnv, email: string) => list(env.ADMIN_EMAILS).map((x) => x.toLowerCase()).includes(email);

function cookie(request: Request, value: string, max_age: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${max_age}${secure}`;
}
function read_cookie(request: Request): string | null {
  const all = request.headers.get('cookie') ?? '';
  for (const part of all.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=') || null;
  }
  return null;
}

/** The signed-in user of a request (null when there is no live session). */
export async function session_user(request: Request, env: AuthEnv): Promise<User | null> {
  const t = read_cookie(request);
  if (!t || !env.DB) return null;
  const db = await with_schema(env.DB);
  const row = await db
    .prepare('SELECT u.id AS id, u.email AS email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ? AND s.expires > ?')
    .bind(await sha256_hex(t), Date.now())
    .first<{ id: string; email: string }>();
  return row ? { id: row.id, email: row.email, admin: is_admin(env, row.email) } : null;
}

async function body_json(request: Request): Promise<Record<string, unknown> | null> {
  const text = await read_text(request, 4096);
  if (text === null) return null;
  try {
    const d = JSON.parse(text);
    return d && typeof d === 'object' && !Array.isArray(d) ? d : null;
  } catch {
    return null;
  }
}

export async function auth(request: Request, env: AuthEnv, path: string, deps: AuthDeps, note: Note): Promise<Response> {
  if (request.method !== 'GET' && !origin_ok(request, env.ALLOWED_ORIGINS)) return error(403, 'Requests must come from the Mathnim site.');
  if (!env.DB) return error(503, 'Accounts are not configured on this server.');
  const db = await with_schema(env.DB);
  // `mail`: whether codes can be sent (the dev server prints them instead), so the site offers sign-in only then
  if (path === 'me' && request.method === 'GET') return json(200, { user: await session_user(request, env), mail: !!(env.RESEND_API_KEY && env.MAIL_FROM) || !!deps.dev, studio: !!deps.studio && !!env.FILES });
  if (request.method !== 'POST') return error(405, 'Use POST.', { allow: 'POST' });
  if (path === 'logout') {
    const t = read_cookie(request);
    if (t) await db.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256_hex(t)).run();
    return json(200, { ok: true }, { 'set-cookie': cookie(request, '', 0) });
  }
  const d = await body_json(request);
  if (!d) return error(400, 'Expected a small JSON object.');
  const email = normal_email(d.email);
  if (!email) return error(400, 'email: a valid address is required.');
  if (path === 'start') return start(request, env, db, email, d.lang === 'en' ? 'en' : 'zh', deps, note);
  if (path === 'verify') return verify(request, env, db, email, typeof d.code === 'string' ? d.code.replace(/\s+/g, '') : '');
  return error(404, 'No such route.');
}

async function start(request: Request, env: AuthEnv, db: SqlDb, email: string, lang: 'en' | 'zh', deps: AuthDeps, note: Note): Promise<Response> {
  const v = deps.limiter?.hit(client_ip(request));
  if (v && !v.ok) return too_many(v, 'sign-in codes');
  const now = Date.now(), day = Math.floor(now / 86_400_000);
  const prev = await db.prepare('SELECT sent, sent_today, day FROM login_codes WHERE email = ?').bind(email).first<{ sent: number; sent_today: number; day: number }>();
  if (prev && now - prev.sent < RESEND_AFTER_MS) return error(429, 'A code was just sent - please wait a moment.', { 'retry-after': String(Math.ceil((prev.sent + RESEND_AFTER_MS - now) / 1000)) });
  const today = prev && prev.day === day ? prev.sent_today : 0;
  if (today >= CODES_PER_DAY) return error(429, 'Too many codes for this address today.');
  const mail_ready = !!(env.RESEND_API_KEY && env.MAIL_FROM);
  if (!mail_ready && !deps.dev) return error(503, 'Sign-in mail is not configured on this server.');
  const code = six_digits();
  await db
    .prepare('INSERT INTO login_codes (email, hash, expires, tries, sent, sent_today, day) VALUES (?, ?, ?, 0, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent, sent_today = excluded.sent_today, day = excluded.day')
    .bind(email, await code_hash(email, code), now + CODE_MS, now, today + 1, day)
    .run();
  if (!mail_ready) {
    console.log(`[mathnim dev] sign-in code for ${email}: ${code}`);
    return json(200, { ok: true, dev_code: code });
  }
  try {
    await (deps.send ?? resend)(env, code_mail(email, code, lang));
  } catch (e) {
    note.error = String((e as Error)?.message ?? e).slice(0, 200);
    return error(502, 'The sign-in mail could not be sent. Please try again.');
  }
  return json(200, { ok: true });
}

async function verify(request: Request, env: AuthEnv, db: SqlDb, email: string, code: string): Promise<Response> {
  if (!/^\d{6}$/.test(code)) return error(400, 'code: six digits.');
  const row = await db.prepare('SELECT hash, expires, tries FROM login_codes WHERE email = ?').bind(email).first<{ hash: string; expires: number; tries: number }>();
  const now = Date.now();
  if (!row || row.expires < now || row.tries >= TRIES) return error(400, 'This code has expired. Ask for a new one.');
  if (row.hash !== (await code_hash(email, code))) {
    await db.prepare('UPDATE login_codes SET tries = tries + 1 WHERE email = ?').bind(email).run();
    return error(400, 'Wrong code.');
  }
  await db.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
  let user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) {
    user = { id: new_id(12) };
    await db.prepare('INSERT INTO users (id, email, created) VALUES (?, ?, ?)').bind(user.id, email, now).run();
  }
  const t = token();
  await db.prepare('INSERT INTO sessions (hash, user_id, expires) VALUES (?, ?, ?)').bind(await sha256_hex(t), user.id, now + SESSION_S * 1000).run();
  // expired sessions are swept now and then rather than on a schedule
  if (Math.random() < 0.05) await db.prepare('DELETE FROM sessions WHERE expires < ?').bind(now).run();
  return json(200, { user: { id: user.id, email, admin: is_admin(env, email) } satisfies User }, { 'set-cookie': cookie(request, t, SESSION_S) });
}

export function code_mail(to: string, code: string, lang: 'en' | 'zh'): Mail {
  const zh = lang === 'zh';
  const subject = zh ? `Mathnim 登录验证码 ${code}` : `Your Mathnim sign-in code: ${code}`;
  const line = zh ? '你的登录验证码是' : 'Your sign-in code is';
  const after = zh ? '10 分钟内有效。如果不是你本人操作，忽略这封邮件即可。' : 'It works for 10 minutes. If you did not ask for it, you can ignore this mail.';
  return {
    to,
    subject,
    text: `${line} ${code}\n\n${after}`,
    html: `<div style="font:15px/1.6 -apple-system,'Segoe UI',sans-serif;color:#15171a"><p>${line}</p><p style="font:600 28px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.18em">${code}</p><p style="color:#6b7077">${after}</p></div>`,
  };
}

async function resend(env: AuthEnv, m: Mail): Promise<void> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}`);
}
