# Development

## Setup

```bash
npm install                 # all workspaces (Node 20+)
bash reference/setup.sh     # optional: real Manim (Python venv) for regression goldens
```

The workspaces import each other by package name (`manim-web`,
`@mathnim/core`, `@mathnim/present`, `@mathnim/visuals`, `@mathnim/ai`); the packages ship TypeScript sources and
are compiled by whoever consumes them (Vite, Vitest, esbuild).

| Command (repo root) | |
|---|---|
| `npm run dev` | the app with hot reload |
| `npm run build` | production build of the app (`apps/mathnim/dist`) |
| `npm test` | Vitest in every package |
| `npm run typecheck` | `tsc` in every package |
| `npm run regress` | manim-web vs real Manim (needs goldens) |
| `npm run doctor` | lint all lesson scenes and recorded AI answers |
| `npm run narration` | record narration for new or changed lines (edge-tts, needs `reference/.venv`) |
| `npm run -w manim-web dev` | engine playground + regression gallery (`/regress.html`) |

## Conventions

* **Match Manim.** In `packages/manim-web`, names, arguments, defaults and
  algorithms follow Manim Community 0.21; read
  `packages/manim-web/docs/CONVENTIONS.md` before porting anything. Every
  difference gets a `// web:` comment. Anything Manim does not have belongs in
  `src/ext/` and in `EXTENSIONS.md`.
* **snake_case** for everything that mirrors Manim or is used from lessons
  (`run_time`, `get_center`, `add_handle`); TypeScript types in PascalCase.
* **Generated files are not edited by hand:** `packages/manim-web/src/index.ts`
  (`node tools/gen_index.mjs`), `packages/ai/src/api_digest.generated.ts`
  (`node tools/gen_api_digest.mjs`), `examples/*.json`.
* **Tests next to the code they protect**: `packages/*/test/*.test.ts`.
  Engine changes are not done until the doc-example regression has no new
  failures (`node tools/regress.mjs --fail`).
* **Accessibility is part of done** for UI: keyboard path, `aria-live` for
  feedback, captions for narration, no information in colour alone.

## Adding a lesson

1. Create `apps/mathnim/src/lessons/<id>/lesson.ts` exporting a `Lesson`
   (see `packages/core/src/schema.ts`, `packages/core/src/world.ts` and the "best angle" lesson).
   Scenes are manim-web `Scene` classes, or factories taking the variant
   values.
2. Put shared figures in a `figures.ts` so every step places them the same
   way.
3. Every prediction checkpoint should have a `reveal` scene; every wrong
   option a `misconception`; misconceptions that need more than feedback get
   a `remediation` scene step marked `branch_only`.
4. Register it in `apps/mathnim/src/course.ts` (optionally `thumb: '<step id>'`
   to choose the card's thumbnail).
5. `npm run doctor` must pass (no layout errors).
6. `npm run narration` records every narration line that has no audio yet
   (`apps/mathnim/public/narration/<hash>.mp3|json`, voice
   en-US-AndrewMultilingualNeural; Chinese lines zh-CN-YunxiNeural). Pad scenes to the length of their line
   (see `hold()` in the pizza lesson) so the picture does not stop mid-sentence.

See `docs/lessons/pizza-circle-area.md` for how a lesson is designed before it
is written.

## Writing a world (an interactive step)

An `explore` step is a *world*: a live scene the learner acts in. The same
world works in both presenters; the game view (`mode: 'game'` on the lesson,
or `?mode=game` in the URL) turns it into a level with stars.

```ts
{
  id: 'grow', kind: 'explore', chapter: 'The dough machine', skill: 'area-scaling',
  scene: () => new GrowExplore(),
  prompt: 'Make a pizza with exactly **twice** the cheese. Radius: {scrub:r}',
  scrub: { r: { tracker: (s: any) => s.r, min: 0.5, max: 2.5, step: 0.01, decimals: 2 } },
  setup: (scene: any, ui, ctx, world) => {
    ui.add_handle({ ... on_change: () => world.emit('radius_changed', { r: scene.r.get_value() }) });
  },
  goals: [{ id: 'double', check: (s: any) => Math.abs(s.r.get_value() ** 2 - 2) < 0.05, message: 'Twice the cheese at r = 1.41!' }],
  detectors: [{ id: 'linear', on: (e) => (e.type === 'released' && e.data?.ratio > 3.5 ? { kind: 'misconception', id: 'linear-scaling' } : null) }],
  lines: [
    { text: 'Drag the edge of the pizza in or out.', when: 'idle' },
    { text: "Twice as wide isn't twice the pizza.", when: { finding: 'linear-scaling' } },
  ],
  stars: stars_by_time(40, 90),
  solve: (scene: any) => scene.r.set_value(Math.SQRT2),
}
```

* **Goals** are checked after every interaction and every event; each is
  announced once, the last one finishes the world (stars, level-complete card
  in the game view). In the game flow the learner cannot move on before that.
* **Events** (`world.emit(type, data)`) describe what happened in the lesson's
  own terms. **Detectors** turn events into findings: a `misconception`
  finding is logged (`verb: 'detected'`), shown gently, debits the skill and is
  sent to the AI tutor as context; `progress` findings show a toast.
* **Lines** are narration triggered on `enter`, `idle` (default 15 s), `goal`,
  `{ event }` or `{ finding }`, optionally with a condition `if`. Keep their
  text fixed (no variant numbers) so they can be recorded: `npm run narration`
  records every line of every world.
* **Scrubbable numbers**: `{scrub:name}` in the prompt becomes a number the
  learner drags left/right, bound to a tracker of the scene.
* **solve** is a scripted winner: `npm run doctor` plays every world
  headlessly and fails if the goals are reached before anyone acts, or if
  `solve` does not reach them.

## Text pages, cases and two languages

Steps of kind `read`, `derive` and `code` are pages of text instead of scenes
(contract and syntax: `packages/core/src/content.ts`; the demo lesson
`apps/mathnim/src/lessons/text-pages-demo/lesson.ts` uses every feature).
Every learner-facing string may be `L10n`: a plain string (the same in both
languages; all older lessons) or `{ en, zh }`.

```ts
{ id: 'idea', kind: 'read', title: { en: 'Why low rank?', zh: '为什么是低秩？' }, blocks: [
  { type: 'p', text: { en: 'LoRA learns $\\Delta W = BA$[^hu].', zh: 'LoRA 学习 $\\Delta W = BA$[^hu]。' } },
  { type: 'code', lang: 'python', label: 'PyTorch', code: TORCH, tabs: [{ label: 'PEFT', lang: 'python', code: PEFT }] },
  { type: 'figure', src: 'ft/c/lora.svg', alt: { en: '…', zh: '…' }, credit: 'Redrawn after Hu et al. (2021)' },
  { type: 'visual', name: 'linear_map', params: { A: [[2, -1], [1, -0.5]] }, explore: true },
  { type: 'callout', kind: 'misconception', body: { en: '…', zh: '…' } },
  { type: 'cite', key: 'hu', text: 'Hu et al. (2021)', url: 'https://arxiv.org/abs/2106.09685' },
] }
{ id: 'count', kind: 'derive', skill: 'lora-params', lines: [{ tex: '\\#B = dr', why: { en: '…', zh: '…' } }, { tex: 'r(d+k)' }],
  blank: { line: 1, answer: 'r*(d+k)', variables: ['r', 'd', 'k'] } }        // line is 0-based
{ id: 'layer', kind: 'code', lang: 'python', code: TORCH,
  notes: [{ lines: [10, 11], text: { en: '…', zh: '…' }, shapes: 'A: [r, d_in]' }] }   // lines are 1-based
```

* **Prose** supports `$TeX$`, `**bold**`, `*italic*`, `` `code` ``, `[text](url)`
  and footnotes `[^key]` pointing at the page's `cite` blocks.
* **Questions**: `{ type: 'text', rubric: { key_points, model_answer, min_points } }`
  is a written answer. With a model the AI tutor marks the key points
  (`grade_text` in `@mathnim/ai`); offline the learner ticks them against the
  model answer. Consecutive checkpoints with the same `group: { id, title, brief }`
  are one case: the brief stays in the reading column and the questions are
  numbered.
* **Language**: the learner picks English or 中文 in the nav bar or Settings.
  Lessons with `{ en, zh }` texts switch; plain-string lessons stay as they
  are. The interface strings live in one dictionary (`t('key')`:
  `packages/present/src/i18n.ts`, the app's own in `apps/mathnim/src/i18n.ts`).
* **Narration** is for "videos": scene steps (and worlds with their triggered
  lines) are voiced, and in game lessons the character also speaks the
  questions; text pages are never voiced and questions are silent in essay
  lessons (the doctor warns when they carry `narration`). Lines without a
  recording are read live by `/api/tts` in the voice of their language
  (same voices; `MATHNIM_VOICE_EN` / `MATHNIM_VOICE_ZH`). Keys are computed from the text in each
  language, so both languages are recorded: `npm run narration` reads English lines with
  en-US-AndrewMultilingualNeural and Chinese ones with zh-CN-YunxiNeural
  (`MATHNIM_VOICE_EN` / `MATHNIM_VOICE_ZH` override; `--revoice` re-records
  lines made with another voice).
* **Visual labels in Chinese**: `linear_map`, `symmetric_ellipse`,
  `pca_projection` and `pca_3d` take `lang` ('auto' follows the learner, like
  the course's own visuals). Canvas text needs a Chinese font: the app
  registers Noto Sans SC (`apps/mathnim/src/cjk_font.ts`; from
  `public/fonts/noto-sans-sc-chinese-simplified-400-normal.woff` when present,
  else the jsDelivr CDN) before drawing in Chinese, and keeps English labels if
  it cannot load one. The node-side tools (`npm run check -w @mathnim/visuals`,
  `npm run doctor`) register a local Chinese font the first time a zh label is
  drawn, so zh contact sheets show real glyphs: `$MATHNIM_CJK_FONT` (a path),
  else `apps/mathnim/public/fonts/noto-sans-sc-chinese-simplified-400-normal.woff`,
  else macOS's `/System/Library/Fonts/Supplemental/Arial Unicode.ttf` (one line
  says which; with Arial Unicode the metrics are close to, not the same as, the
  app's Noto Sans SC). Add `lang: 'zh'` examples to a visual to see its Chinese
  sheet. The check also registers the fine-tuning visuals (`src/ft/<part>/index.ts`).
* **Doctor**: `npm run doctor` lints every lesson's text (both languages
  present, untranslated prose, TeX renders, figures exist, visuals registered
  with valid params, code not empty, notes inside the code, blanks parse and
  grade their own answer, case questions consecutive) and builds embedded
  visuals like scenes.

## Adding a syllabus entry (AI-generated lesson)

Add a `SyllabusEntry` (title, level, objectives in teaching order) to
`course.ts`. The lesson is generated on first open, validated scene by scene,
and cached in the browser. To make it work offline too, record the model's
responses like `packages/ai/src/recorded_lessons.ts`.

## Porting more of Manim

`packages/manim-web/docs/AGENT_BRIEF.md` is the checklist used for the port:
read the Python source (`tools/pystrip.py`), port to the same path, register
for late binding, regenerate the index, transpile the doc examples, run the
regression for the affected examples and look at the image strips.
