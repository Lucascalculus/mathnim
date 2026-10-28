// Cloudflare Pages Function: /api/auth/* (sign in with an emailed code).
// Accounts live in the D1 database bound as DB; mail goes through Resend
// (secret RESEND_API_KEY, variable MAIL_FROM). Logic in server/auth.ts.
import { auth, type AuthEnv } from '../../../server/auth';
import { limiter, pages } from '../../../server/workers';

const path = (p: string | string[] | undefined) => (Array.isArray(p) ? p.join('/') : p ?? '');

export const onRequest = pages<AuthEnv>((c) => `auth/${path(c.params.path)}`, ['GET', 'POST'], ({ request, env, params }, note) =>
  auth(request, env, path(params.path), { limiter: limiter('auth', env), studio: false /* no model for /api/studio yet */ }, note));
