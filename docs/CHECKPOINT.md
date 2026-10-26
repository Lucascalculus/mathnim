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
  custom domain `lab.penghaolun.com`, check local DeepSeek connectivity
  (`curl -sI https://api.deepseek.com/models` - from this machine it was resetting),
  `kill 54979` (a leftover test server of a sub-agent on :5199).

## Paused (2026-10-10, on the user's request)

- All build agents were stopped mid-build so the project could go to GitHub:
  https://github.com/Lucascalculus/mathnim (private, branch `main`).
- State of the fine-tuning course build when paused:
  - Plans for parts A-F and labs are done (docs/lessons/llm-finetuning/part-*.md, labs.md).
  - Partly built: visuals in packages/visuals/src/ft/{a,b,c,d,e,f}, lessons in
    apps/mathnim/src/lessons/ft/, figures in apps/mathnim/public/ft/. None of it is
    wired into course.ts or visuals/src/index.ts yet; some files may be half written.
  - Platform work (read/derive/code steps, L10n, `text` questions, case groups,
    language switch) was nearly done; it was updating DEVELOPMENT.md and
    ARCHITECTURE.md when stopped.
  - research-sft.md (verified citations and API names) is done and lists
    corrections the B/C lessons must apply (RL's Razor KL direction, the 70/30
    numbers, assistant-token masks, etc.).
- To resume: each part agent continues per BUILD.md plus INTERACTION-BAR.md
  (high bar; toolkit features only where they truly add meaning).
- packages/manim-web used to be its own git repo (one commit, no remote); it is
  now plain files in this monorepo. Its old .git is kept locally in .local/manim-web.git
  (ignored).

## Stopped at the usage limit (2026-10-10 ~06:00)

- Wired: FT_COURSE in apps/mathnim/src/course.ts (A, F0, D, F1), course switcher,
  visuals ft_a/ft_d/ft_f in packages/visuals/src/index.ts. Doctor 120/122:
  ft-d2a/baseline-scene and ft-d2a/baseline-world FAIL (lint) - give to part D agent.
- Platform done (empty stage hidden, start/continue, ask button). Open platform asks
  from part D: `log` = natural log in the expression grader; figure `src` as L10n;
  `lang` in LessonContext.
- A+F: was applying my review fixes (node ids, pass@k, cost world reveal, zh handle
  labels, figure text size, TeX English) - resume a07cae1a8f7ed55d5.
- B+C (a5cabd17705fa4f7a), E (a6d9f9c81897c6637, was writing E1): still building.
- D (ae50614570d3973a9): built; not yet reviewed with lesson_text.mjs / browser.
- Then: wire B, C, E; record narration (scenes only); browser review; push.

## Live (2026-10-10, evening)

- Deployed to https://lab.penghaolun.com (and mathnim.pages.dev). The live site has:
  - the full LLM fine-tuning course (parts A-F) and the labs;
  - the new site structure (docs/SITE-STRUCTURE.md): path URLs, the home page, course pages, the lesson outline, the "这里没懂" side chat, and prerequisites.
- Still open:
  - set the DeepSeek secret on Pages; until then, live AI answers are offline/recorded;
  - user product ideas not yet done: login and progress sync (the next big item), review linked to lessons, a first-time intro to each mode, sharing a single interaction, asking before narration autoplays;
  - the math course split was declined for now;
  - mathviz-demo/ in the repo root is a stale copy (git-ignored), safe to delete.

## MPC course: LIVE at https://lab.penghaolun.com/mpc (2026-10-26). All 8 lessons were published together. Notes below are kept for history

### (was) MPC course in progress (2026-10-26 ~15:35, paused because the laptop lid closed)

- **Plan:** docs/lessons/mpc/README.md (with the update at its end) and docs/lessons/mpc/AGENT-BRIEF.md, which every lesson agent follows.
- **User decisions:**
  - Model Predictive Control, for university students and engineers;
  - 8 lessons, no labs;
  - published in two batches: M1–M4 first (deploy as soon as all four pass the doctor), then M5–M8;
  - one agent per lesson, at effort medium, without lowering the standard;
  - "做完直接部署".
- **State:**
  - The kit and many visuals are in packages/visuals/src/mpc/. No lesson file yet.
  - Each agent wrote its notes to docs/lessons/mpc/checkpoints/m<N>.md (done, files, design, what is left).
- **To resume:**
  - Start one agent per lesson with effort "medium". Its prompt: follow AGENT-BRIEF.md and continue from checkpoints/m<N>.md.
  - Registration: each agent fills its own slot in apps/mathnim/src/lessons/mpc/unit.ts and its section in packages/visuals/src/mpc/index.ts, then runs `npm run manifest -w mathnim`.
- **Publish batch 1** once M1–M4 are registered and pass:
  1. `npm run thumbs -w mathnim mpc features`
  2. `npm run narration` (scene steps only)
  3. `npm run doctor`
  4. a review against 讲明白
  5. remove `hidden: true` from MPC_COURSE in apps/mathnim/src/course.ts
  6. commit, push, `npm run deploy`
- **Also pending deploy:** the home intro line was removed (the user asked).
- **Notes from the checkpoints:**
  - **M1:** the shortest docking look-ahead with a_max = 1 is N = 19 (1.9 s), not 20.
  - **M5:**
    - the timing benchmark ran on this Mac; it is docs/lessons/mpc/m5/bench.json;
    - OSQP's 1e-3 tolerance lets the cart pass the wall by 2–5 mm, so keep a 1 mm back-off or explain it;
    - solvers2d.ts is not yet typechecked.
  - **M8:**
    - car_track_wip.ts is not yet typechecked or registered;
    - the CasADi code page is untested; the old lab venv in docs/lessons/mpc/labs/code/.venv may already have CasADi.

## Next

1. The fine-tuning course outline (user's priority); later WP7 (AI lesson
   generation in the v2 format) and WP12 docs.
2. Redeploy (`npm run deploy`) after the AI work and the user's secrets/domain; test live AI on the real site.

## Known gaps

- The doctor's world check uses `solve()` and a stub UI, so it does not catch
  bugs in how a world wires real interactions (e.g. a drop callback's zone
  argument); play new worlds in the browser.
- The dev server reloads the page whenever a sub-agent edits a package.
