# Brief for every MPC lesson agent (one lesson per agent)

You write one lesson of the course "模型预测控制（MPC）/ Model Predictive
Control" in the Mathnim repo `/Users/lucas/Documents/Mathnim`. Several agents
work in parallel, one per lesson.

## Read first
1. `docs/lessons/mpc/README.md`: the plan, notation, running example, and the
   update at the end (two batches, no labs, ownership).
2. `docs/lessons/mpc/KIT.md` and the kit in `packages/visuals/src/mpc/`
   (`math.ts`, `kit.ts`, `dock.ts`, `receding_loop.ts`, `qp2d.ts`), plus
   `apps/mathnim/src/lessons/mpc/common.ts` (helpers `t`, `vis`, `attach`).
   Use them; don't write a competing kit. If you need an addition, add it in
   your own file.
3. `docs/lessons/llm-finetuning/BUILD.md`: the rules, the only criterion
   "讲明白", and the product-manager pass.
4. `docs/lessons/llm-finetuning/INTERACTION-BAR.md`: use toolkit features
   only where they truly add meaning.
5. `docs/SITE-STRUCTURE.md` and `docs/DEVELOPMENT.md`.
6. A model of tone and structure: `apps/mathnim/src/lessons/ft/c/c2_lora.ts`.
   Also check the other MPC lessons already on disk in
   `apps/mathnim/src/lessons/mpc/`, so notation, the running example and
   cross-references ("M2 讲过…") stay consistent.

## Standards
- **One lesson file:** `apps/mathnim/src/lessons/mpc/m<N>_<name>.ts`,
  exporting a `Lesson` with mode 'essay' and id `mpc-m<N>-<name>`. Use read,
  derive, code, scene, explore and checkpoint steps. If a draft or research for
  your lesson already exists on disk, continue from it.
- **Bilingual:** every learner-facing string is `{ en, zh }`, with the Chinese
  written natively, not translated.
- **Narration only on scene steps.** Text pages, derivations, code and
  checkpoints get none.
- **Order:** purpose and intuition first, then the math with what each term
  does, then details. Answer "why this and not X" where a learner would ask
  it. Never open with a pile of details.
- **Worlds:** at most 1–2, each passing INTERACTION-BAR. Each has `solve()`,
  goals not met at entry, specific detector lines, and a `cue` order. Prefer a
  static figure or text when the action isn't the concept.
- **Visuals:**
  - one file each in `packages/visuals/src/mpc/`;
  - canvas labels follow `lang` (the `LANG_SPEC` pattern);
  - Arimo has no '≤' glyph, so write limits in words or TeX;
  - unit-test your math.
- **Checks:** end the lesson with 3–4 transfer checks (number, choice and text
  questions, with misconception feedback).
- **Sources:** every factual claim has a verified source in
  `docs/lessons/mpc/research-m<N>.md`. Mark simulations as simulations, and
  don't invent measured numbers.
- **No labs** in this course.

## Registration and checks
- **Register your own lesson.** There is no central registrar. You edit only
  your own sections:
  - In `packages/visuals/src/mpc/index.ts`, add your visuals (import, export,
    `register`) in your lesson's section.
  - In `apps/mathnim/src/lessons/mpc/unit.ts`, uncomment your import line and
    fill in your entry in your slot.
  - Other agents edit these files at the same time. Re-read each file right
    before editing, and make a small exact edit of your lines only.
  - Then run `npm run manifest -w mathnim`.
- **The kit belongs to the M1 agent.** It owns `kit.ts`, `math.ts` and
  `KIT.md`. Put helpers you need in your own files; don't edit kit.ts or
  math.ts.
- **Before you report, all of these pass:**
  - `npm run doctor` for your lesson;
  - `node apps/mathnim/tools/lesson_text.mjs <id> zh`, and it reads well;
  - `npm run check -w @mathnim/visuals -- --only <your visuals>`, in en and zh,
    after you have looked at the contact sheets;
  - the typecheck is clean.
- **Never edit** `course.ts`, `packages/visuals/src/index.ts`, `packages/core`,
  `packages/present`, `manim-web`, or other agents' files.
- No browser pane, no dev servers, no narration recording, and no commits.

## Finish
Do the product-manager pass, then send a short work report: the file, a
3-line summary, the worlds and why each is needed, the checks you ran, and
any open issues.
