// Cloudflare Pages Function: /api/me/events (a signed-in learner's learning
// events, appended to one D1 table). Logic in server/events.ts.
import type { AuthEnv } from '../../../server/auth';
import { events } from '../../../server/events';
import { pages } from '../../../server/workers';

export const onRequest = pages<AuthEnv>('me/events', ['POST'], ({ request, env }) => events(request, env));
