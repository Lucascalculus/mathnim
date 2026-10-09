# Deployment

Mathnim is a static web app plus a few server routes. In production it runs on
**Cloudflare Pages** (project `mathnim`, https://mathnim.pages.dev, custom
domain mathnim.penghaolun.com); the server routes are **Pages Functions**. In
development the **Vite dev server** serves the same routes with the same code.

```
apps/mathnim/
  dist/            the built app (npm run build)
  functions/api/   Pages Functions: thin wrappers, one file per route
  server/          the route logic, shared by the functions and the dev server
    http.ts          JSON errors, Origin check, rate limits, structured logs
    deepseek.ts      /api/deepseek/* proxy (+ optional answer cache)
    tts/             /api/tts: text rules, SSML, speech protocol, providers
    feedback.ts      /api/feedback
    providers.ts     /api/providers
    workers.ts       Cloudflare adapters (websocket, Cache API, limiter per isolate)
    dev.ts           the same routes as Vite middleware (Node adapters)
  test/            unit tests for server/ (npm test -w mathnim)
  wrangler.toml    Pages config: KV binding, variables
```

## Deploying

```bash
npm run deploy          # at the repo root: build, then wrangler pages deploy dist
```

`npm run deploy` runs `npm run build` and then, in `apps/mathnim`,
`wrangler pages deploy dist --project-name mathnim --branch main`. Wrangler
reads `apps/mathnim/wrangler.toml` (`pages_build_output_dir = "dist"`), bundles
`functions/` (which import `server/`) and uploads both. Wrangler must be logged
in to the Cloudflare account (`npx wrangler login`, once).

Because `wrangler.toml` exists, the KV binding and the `[vars]` in it are the
source of truth for the project: the dashboard shows them read-only, and a
variable added in the dashboard is replaced on the next deploy. Change them in
the file. Secrets are separate and are never in the file.

## Secrets and variables

| Name | Kind | Needed | Purpose |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | secret | yes, for AI answers | the DeepSeek key; only the proxy sees it |
| `ADMIN_TOKEN` | secret | for the teacher view | bearer token for `GET /api/feedback`; the route refuses while it is unset |
| `AZURE_SPEECH_KEY` | secret | recommended before real use | Azure AI Speech key; switches live narration to the official service |
| `AZURE_SPEECH_REGION` | variable | with the key | e.g. `eastus` (uncomment in `wrangler.toml`) |
| `ALLOWED_MODELS` | variable | | models the proxy forwards (`deepseek-flash`; `*` = any) |
| `ALLOWED_ORIGINS` | variable | | extra origins allowed to call `/api` (the site's own origin always is) |
| `RATE_LIMITS` | variable | | per visitor: `deepseek=40/300,tts=80/600,feedback=20/100` (per 10 min / per UTC day) |
| `ANSWER_CACHE_TTL` | variable | | seconds an opted-in answer is cached (`86400`; `0` = off) |
| `TTS` | variable | | live narration: empty = Azure if configured else Edge; `edge`, `azure`, or `off` |

Set secrets from the repo root (each command prompts for the value):

```bash
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name mathnim
npx wrangler pages secret put ADMIN_TOKEN --project-name mathnim      # e.g. the output of: openssl rand -hex 24
npx wrangler pages secret put AZURE_SPEECH_KEY --project-name mathnim # optional
npx wrangler pages secret list --project-name mathnim
```

A new secret takes effect with the next deployment (`npm run deploy`).

## Custom domain

1. Cloudflare dashboard → Workers & Pages → `mathnim` → Custom domains → Set
   up a custom domain → `mathnim.penghaolun.com`.
2. If `penghaolun.com` uses Cloudflare DNS, the CNAME record is created for
   you; otherwise add `CNAME mathnim → mathnim.pages.dev` at the DNS provider.
   The certificate is issued automatically (minutes).
3. Nothing else changes: the API accepts requests from the origin it is served
   on, and `ALLOWED_ORIGINS` already lists both hostnames.

## Routes

All routes answer JSON (`{error}` with a 4xx/5xx status on failure), check the
`Origin` of POSTs (the site itself and `ALLOWED_ORIGINS` only), and write one
structured log line per call.

| Route | Contract |
|---|---|
| `GET /api/providers` | `{anthropic, deepseek, tts}`: which providers this deployment holds keys for (names only), and whether live narration is on |
| `POST /api/deepseek/chat/completions`, `GET /api/deepseek/models` | DeepSeek's API with the key added. Allowed models only, `max_tokens` ≤ 32000, body ≤ 256 KB, streams passed through. Responses carry `x-mathnim-answer-id`. With the request header `x-mathnim-cache: 1`, an identical request is answered from the edge cache (`x-mathnim-cache: hit`) |
| `POST /api/tts` `{text}` | `{key, text, voice, provider, duration, words: [[start, end, word], ...], audio, audio_duration, timing}`: the pre-generated narration's JSON shape plus the MP3 as base64 (`TtsReply` in `packages/core/src/narration.ts`). `text` ≤ 600 characters. Cached per text (SHA-256) for 30 days |
| `POST /api/feedback` `{question, answer_id, helpful, note?}` | `201 {ok, id}`. Kept in KV for 180 days. `helpful: false` also drops the cached answer with that id |
| `GET /api/feedback?limit=50&cursor=…` | `{items: [{id, t, client, question, answer_id, helpful, note?}], cursor?}`, newest first; needs `Authorization: Bearer <ADMIN_TOKEN>` |

The teacher view, from a terminal:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://mathnim.pages.dev/api/feedback?limit=50"
```

### Live narration

Lessons written by people have pre-generated narration
(`public/narration/<key>.mp3|json`, `npm run narration`). For any other line
(AI-written lessons and answers) the Narrator asks `/api/providers`; when
`tts` is true it posts the line to `/api/tts` (longer lines in parts of up to
280 characters, in parallel) and plays the audio with the same word-timed
captions. If that is unavailable it falls back to captions only, or to the
browser's voice if the learner chose it in Settings.

Providers, chosen by the environment:

* **Azure AI Speech** (when `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are
  set): the official service, same voice (en-US-AndrewMultilingualNeural).
  Word boundaries come from its websocket API; if that fails, the REST API
  gives the audio and word times are estimated (`timing: "estimated"`).
  The Azure path has unit tests but has not been run against a real key yet:
  after setting the key, request one line and check `provider: "azure"` and
  `timing: "measured"` in the reply.
* **Edge read-aloud** (otherwise): the endpoint the `edge-tts` Python package
  uses. **Development / demo grade only**: unofficial, undocumented, no SLA,
  may change its handshake (see the constants in `server/tts/providers.ts`,
  taken from edge-tts 7.2.8) or refuse traffic from Cloudflare's addresses at
  any time, and its terms do not cover production use. Use Azure before real
  students depend on narration, or set `TTS=off`.

Text is normalised as in `tools/gen_narration.py` ("9 m" → "9 meters",
"AB" → "A-B", symbols named), so live and recorded lines sound alike; caption
markup is read as words first (`$\frac{1}{2} b h$` → "1 over 2 b h", `**bold**`
→ "bold"). See `to_spoken` in `packages/core/src/narration.ts`.

## Limits

* **Per visitor (IP)**: a sliding 10-minute window and a daily cap per route
  (`RATE_LIMITS`). They are kept in memory per Cloudflare isolate, so they are
  best effort: many isolates serve the site. Classrooms behind one NAT share an
  address; raise the limits if a class hits them. TTS counts only uncached lines.
* **Hard limit**: once the custom domain is on a Cloudflare zone, add a
  rate-limiting rule (Security → WAF → Rate limiting rules) for
  `/api/deepseek/*` and `/api/tts`, e.g. 60 requests per minute per IP.
* **Spend**: DeepSeek is prepaid; the balance is the ceiling. Keep it small.
* **Body sizes**: chat 256 KB, TTS 8 KB (600 characters of text), feedback 16 KB.

## Costs (check the providers' pricing pages; figures as of 2026)

| Item | Free allowance | Beyond |
|---|---|---|
| Pages static assets | unlimited | - |
| Pages Functions (= Workers requests) | 100,000 requests/day | Workers Paid, $5/month for 10 M |
| KV (feedback) | 100,000 reads, 1,000 writes/day, 1 GB | Workers Paid |
| Cache API (answers, TTS) | free | - |
| DeepSeek | - | per token, from the prepaid balance |
| Azure AI Speech, neural voices | F0 tier: 0.5 M characters/month | about $15 per 1 M characters |
| Edge read-aloud | free, unofficial | - |

A lesson line is 100-200 characters and is synthesised once per Cloudflare
data centre per 30 days (cache), so live narration costs little even on Azure.

## Logs

Every API call writes one JSON line to the console, for example:

```json
{"t":"2026-09-30T00:31:33.487Z","level":"info","route":"tts","method":"POST","status":200,"ms":779,"client":"a504e85d","provider":"edge","chars":24}
{"t":"…","level":"info","route":"deepseek/chat/completions","method":"POST","status":200,"ms":412,"total_ms":9120,"client":"…","model":"deepseek-flash","usage":{"prompt":5210,"completion":880,"total":6090,"cache_hit":4096}}
```

`ms` is the time to the response headers, `total_ms` until a streamed answer
finished; `usage` is DeepSeek's token count (streams are asked to include
it). `client` is a hash of the address and the day, not the address. Keys,
prompts and answers are never logged. Watch them live with:

```bash
npx wrangler pages deployment tail --project-name mathnim
```

## Local development

```bash
npm run dev             # Vite dev server with the same /api routes
```

The dev server (`apps/mathnim/vite.config.ts`) mounts `server/dev.ts`, which
runs the same handlers as the Pages Functions. Keys and settings come from the
repo's `.env.local` (never committed, never sent to the browser):

```
DEEPSEEK_API_KEY=...
ANTHROPIC_API_KEY=...      # dev only: /api/anthropic proxy
ADMIN_TOKEN=...            # to try GET /api/feedback locally
AZURE_SPEECH_KEY=...       # optional, with AZURE_SPEECH_REGION
TTS=off                    # optional: no live narration
DEV_RATE_LIMITS=1          # optional: apply the production rate limits
ANSWER_CACHE_TTL=3600      # optional: turn the answer cache on (off in dev)
```

Differences from production, on purpose: rate limits are off, any model is
allowed unless `ALLOWED_MODELS` is set, the answer cache is off unless
`ANSWER_CACHE_TTL` is set, and state lives in
`apps/mathnim/node_modules/.cache/mathnim/` (`feedback.json`, `tts/`). Live
narration in dev needs Node 22+ (global `WebSocket` with headers).

To run the production runtime (workerd) locally against the built app:

```bash
npm run build
cd apps/mathnim
npx wrangler pages dev dist --port 8788
```

It reads `wrangler.toml` (a local, simulated KV) and secrets from
`apps/mathnim/.dev.vars` (`DEEPSEEK_API_KEY=...`, `ADMIN_TOKEN=...`; keep that
file out of version control).

Tests and type checks for the server code:

```bash
npm test -w mathnim
npm run typecheck -w mathnim
```
