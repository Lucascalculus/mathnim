// Cloudflare Pages Function: /api/admin/* (the data centre's numbers, for admins). Logic in server/admin.ts.
import { admin, type AdminEnv } from '../../../server/admin';
import { pages } from '../../../server/workers';

const path = (p: string | string[] | undefined) => (Array.isArray(p) ? p.join('/') : p ?? '');

export const onRequest = pages<AdminEnv>('admin', ['GET'], ({ request, env, params }) => admin(request, env, path(params.path)));
