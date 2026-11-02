// Cloudflare Pages Function: /api/admin/* (the data centre's numbers; who sees what in server/admin.ts).
import { admin, type AdminEnv } from '../../../server/admin';
import { pages } from '../../../server/workers';

const path = (p: string | string[] | undefined) => (Array.isArray(p) ? p.join('/') : p ?? '');

export const onRequest = pages<AdminEnv>('admin', ['GET', 'POST'], ({ request, env, params }) => admin(request, env, path(params.path)));
