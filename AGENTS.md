# AGENTS.md

You are working on **Mathnim** (https://lab.penghaolun.com): interactive
courses in maths and technology, built on our own TypeScript port of Manim,
with an AI tutor in the margin of every lesson. The owner is Lucas; he writes
mostly in Chinese and judges everything by one question: does it make the
learner genuinely understand (讲明白)?

## Read first

| You are about to… | Read |
|---|---|
| do anything | this file, then `docs/TASTE.md` (how Mathnim should feel) |
| make or change a course or lesson | `docs/COURSE-PLAYBOOK.md`, then `docs/CAPABILITIES.md` (everything the libraries offer) |
| build an interactive world | `docs/lessons/llm-finetuning/INTERACTION-BAR.md`, `packages/manim-web/docs/EXTENSIONS.md` |
| write a visual | `packages/visuals/README.md` and a kit such as `docs/lessons/mpc/KIT.md` |
| change the site (pages, margin, settings) | `docs/SITE-STRUCTURE.md`, `docs/ARCHITECTURE.md` |
| set up, add a lesson, conventions | `docs/DEVELOPMENT.md` |
| deploy | `docs/DEPLOY.md` |
| pick up where work stopped | `docs/CHECKPOINT.md` and the course's `docs/lessons/<course>/` notes |

Two skills package the usual work: `/new-course` (plan and build a course with
the playbook) and `/course-review` (review a lesson or course and list fixes).

## The repo

```
apps/mathnim/          the site: pages, course registry (src/course.ts), lessons (src/lessons/<course>/),
                       the margin tutor (src/side_chat.ts), tools (tools/: doctor, catalog, thumbs, narration, page_shots)
packages/manim-web/    Manim in TypeScript (canvas rendering) + ext/: the interaction toolkit
packages/core/         lesson format (schema.ts, content.ts), runtime, worlds, grading, learner model
packages/present/      the lesson view (essay and game), text pages, narration, cues
packages/visuals/      parametric visuals, one pack per course (mpc/, ft/<part>/, linalg/), loaded on demand
packages/ai/           the tutor (streamed answers, ready-made visuals), providers
docs/                  plans, taste, playbook, catalog; docs/lessons/<course>/ holds research and plans
```

## Commands

```bash
npm run dev                       # the site at http://localhost:5173
npm run typecheck && npm test     # always before you say you are done
npm run doctor                    # builds and lints every lesson and both languages
npm run check -w @mathnim/visuals -- --only <names>   # a visual: checks + contact sheets (look at them)
node apps/mathnim/tools/lesson_text.mjs <lesson-id> zh # a lesson as the student reads it
node apps/mathnim/tools/page_shots.mjs <url> <out> <w> <h> <steps.json>   # click through the site headlessly
npm run catalog                   # regenerate docs/CAPABILITIES.md after adding a visual, field or module
```

## Ground rules

- **讲明白 first**: purpose and intuition before math, math before details
  (`docs/TASTE.md` §1).
- **Bilingual**: every learner-facing string is `{ en, zh }`; write the
  Chinese natively.
- **One light theme. Narration only on scene steps. No instructional copy in
  the UI.**
- **No heavy libraries** in the browser (no CasADi, no Python runtime).
- **Match the code around you**: snake_case names, comments that say why,
  the existing helpers and kits rather than new ones.
- **Verify what you change** in the real page (dev server or `page_shots`),
  at desktop and phone width, before reporting it done; say plainly what you
  did not check.
- **Ask before outward actions**: Lucas previews before anything is deployed.
  Commit and push to this private repo when a piece of work is finished;
  deploy only when he says so (`npm run deploy`).
- **Secrets**: the DeepSeek key lives in `.env.local` (gitignored) and as a
  Cloudflare secret. Never print, copy or commit a key; Lucas sets secrets
  himself.
- **When asked to discuss, discuss** (options, trade-offs, a recommendation),
  and don't implement until he says so.
