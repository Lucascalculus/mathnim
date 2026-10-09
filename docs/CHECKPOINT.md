# Checkpoint (2026-10-10)

Work follows `docs/PLAN.md` (the engineering plan; status per work package is
kept there). This file is the short "where are we right now".

## Done today

- DeepSeek provider (`deepseek-flash` default), key in `.env.local`, proxied by
  the Vite dev server and by Cloudflare Pages Functions in production.
- WP6 part 1: personal text answers stream first (diagnosis line + 2-4
  sentences, ~2 s), student context (`apps/mathnim/src/student.ts`).
- WP0: packages split into `@mathnim/core` (no UI), `@mathnim/present`,
  `@mathnim/visuals` (Visual contract, params, catalog, light/dark palettes).
- WP2: worlds (goals, detectors, stars, triggered + conditional lines, hints,
  actions, scrubbable prompt numbers, `solve` for the doctor), flow policies.
- WP1 (sub-agent): interaction toolkit in `packages/manim-web/src/ext/`
  (drag/drop, cut, stamp, scrub, tokens, marker, juice); demo `/interact.html`.
- WP8/WP9 (sub-agent): `/api/tts` live narration (Edge; Azure when keyed),
  `/api/feedback` (KV `mathnim-feedback`), logs, limits; `docs/DEPLOY.md`.
- WP3: game view (`mode: 'game'`, Marco the character, level map, stars,
  level-complete and game-over cards) + `lessons/pizza-game` (7 worlds + quick
  check + wrap), all lines pre-recorded; played through in the browser.
- WP4/WP5: 10 linear-algebra + PCA visuals (sub-agent) and the essay lesson
  "The directions a matrix can't turn" (`lessons/eigen-pca`); on 2026-10-10 switched to
  the shared light theme - every lesson uses it from now on.
- 2026-10-10: deployed everything to Cloudflare Pages `mathnim`
  (https://mathnim.pages.dev). Checked live: pages, lessons (pizza game played),
  `/api/providers`, live TTS from Cloudflare (Edge, measured word timings).
  No secrets are set yet, so AI questions use the offline recorded answers and
  `/api/feedback` reads are refused; no custom domain bound yet.

## Running / waiting

- WP6 part 2 done (2026-10-10): fast visual path (`packages/ai/src/visual_plan.ts`),
  picture in ~3-4 s, text first word ~1.5 s; no eval set (the user decided against it).
  Redeployed the same day (light theme for every lesson, AI fast path) - live at
  https://mathnim.pages.dev; AI still offline there until the DeepSeek secret is set.
- Current big task (2026-10-10): the LLM fine-tuning course. Everything lives in
  `docs/lessons/llm-finetuning/`: README.md (v2 plan written by me: 16 lessons in
  parts A-F, interaction rules, page types read/derive/code, bilingual zh+en, labs as
  tutorials, per-lesson template), research-technical.md, research-pedagogy.md,
  research-adoption.md (adoption research still running), outline-v1.md (superseded).
  Four sub-agents are writing part-a-map-rag.md + part-f-choosing.md + glossary.md,
  part-b-sft.md + part-c-efficiency.md, part-d-preference.md, part-e-reasoning.md +
  labs.md. research-adoption.md is in and its coverage decisions are in README 0.5.
- Build workflow the user asked for (2026-10-10): as soon as a part's plan is done,
  the same sub-agent builds that part's lessons (in parallel), then refines its own
  work from a product manager's view and sends a work report; I review at a high
  level. Content contract for text pages + bilingual strings: packages/core/src/content.ts
  (L10n, Block, read/derive/code). A separate platform agent integrates those step
  kinds into the runtime/presenter, adds language switching and Chinese narration.
  Each part builds in its own folders (apps/mathnim/src/lessons/ft/<part>/,
  packages/visuals/src/ft/<part>/); I wire course.ts and the visuals index.
- The user: set Pages secrets `DEEPSEEK_API_KEY` (and `ADMIN_TOKEN`), add the
  custom domain `mathnim.penghaolun.com`, check local DeepSeek connectivity
  (`curl -sI https://api.deepseek.com/models` - from this machine it was resetting),
  `kill 54979` (a leftover test server of a sub-agent on :5199).

## Next

1. The fine-tuning course outline (user's priority); later WP7 (AI lesson
   generation in the v2 format) and WP12 docs.
2. Redeploy (`npm run deploy`) after the AI work and the user's secrets/domain; test live AI on the real site.

## Known gaps

- The doctor's world check uses `solve()` and a stub UI, so it does not catch
  bugs in how a world wires real interactions (e.g. a drop callback's zone
  argument); play new worlds in the browser.
- The dev server reloads the page whenever a sub-agent edits a package.
