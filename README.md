# Mathnim

Try it on [www.lab.penghaolun.com](https://lab.penghaolun.com/llm-finetuning)

An AI math tutor that explains with **live, interactive Manim scenes** in the
browser: students predict, watch, drag, and get feedback; questions are
answered with new animations; lessons are generated from a syllabus.

| Package | What it is |
|---------|-----------|
| [`packages/manim-web`](packages/manim-web) | Manim Community 0.21 re-implemented in TypeScript: same API, real-time Canvas2D rendering, exact seeking, interaction, export, and a Python→JS path for existing Manim code |
| [`packages/core`](packages/core) | `@mathnim/core` - lesson format and runtime without UI: predict-observe-explain checkpoints, worlds (goals, detectors, stars, triggered narration), flow policies, answer checking (expressions, numbers, sketches), learner model (BKT + spaced review), events |
| [`packages/present`](packages/present) | `@mathnim/present` - presenters: the essay lesson view (the game view is next), narrator, sketchpad |
| [`packages/visuals`](packages/visuals) | `@mathnim/visuals` - parametric, pre-verified explanation scenes shared by lessons and AI answers, their catalog, light/dark palettes |
| [`packages/ai`](packages/ai) | `@mathnim/ai` - question → explanation + validated scene, syllabus → lesson; Claude provider, offline recorded provider, sandboxed validation with a repair loop |
| [`apps/mathnim`](apps/mathnim) | The product prototype: course map, lessons, ask, review, dashboard, settings |
| [`reference`](reference) | Real Manim (Python) used as the reference for regression tests |
| [`legacy`](legacy) | Earlier prototypes (video pipeline, engine bake-off, style studies) |

## Two ways to learn

* **Game** (secondary school): the math is the mechanic. Levels with goals,
  stars and a character who reacts to what you do - e.g. *Pizza shop*: bet,
  cover the pizza with tiles, cut it with a knife, build $\pi r^2$ from tiles,
  run the shop.
* **Visual essay** (university): explanations in the spirit of 3Blue1Brown that
  you can hold in your hands (same light look as every lesson) - e.g. *The directions a matrix can't turn*: drag the basis
  vectors, slide $\lambda$ until the grid collapses, turn a line until the
  data's shadow is widest (PCA).

Students can ask anything at any time: a personal text answer streams in about
two seconds (it knows what is on screen, their mastery and their mistakes), and
a picture follows.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173 - the Mathnim app
```

Without an API key the app runs in **offline demo mode** (suggested questions
and the "Inscribed angles" lesson replay recorded AI output). To use Claude,
either paste a key in *Settings* (kept in the browser) or start the dev server
with `ANTHROPIC_API_KEY=... npm run dev` and set *Settings → Proxy URL* to
`/api/anthropic`.

## Check it

```bash
npm test               # unit tests of all packages
npm run typecheck
npm run regress        # manim-web vs real Manim on Manim's documentation examples
npm run doctor         # lint every scene of every lesson and recorded AI answer
```

`npm run regress` needs the reference goldens; see
[`packages/manim-web/docs/TESTING.md`](packages/manim-web/docs/TESTING.md).

## Read more

* [docs/DEPLOY.md](docs/DEPLOY.md) - Cloudflare Pages deployment, secrets, limits
* [docs/PLAN.md](docs/PLAN.md) - engineering plan for the next phase (game / 3b1b modes, eigen → PCA, 8-second AI answers)
* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - layers, flows, state
* [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - setup, conventions, adding lessons and ports
* [docs/ROADMAP.md](docs/ROADMAP.md) - feature brainstorm and ranking
* [docs/PM_REVIEW.md](docs/PM_REVIEW.md) - prototype gap analysis
* [packages/manim-web/docs/CONVENTIONS.md](packages/manim-web/docs/CONVENTIONS.md) and [EXTENSIONS.md](packages/manim-web/docs/EXTENSIONS.md)
