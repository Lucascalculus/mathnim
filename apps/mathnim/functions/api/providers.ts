// Cloudflare Pages Function: GET /api/providers - which model providers this
// deployment holds a key for (names only, never keys) and whether live
// narration is on. Logic in server/providers.ts (shared with the dev server).
import { providers, type ProvidersEnv } from '../../server/providers';
import { pages } from '../../server/workers';

export const onRequest = pages<ProvidersEnv>('providers', ['GET', 'HEAD'], async ({ env }) => providers(env));
