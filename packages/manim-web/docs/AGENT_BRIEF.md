# Brief for parallel porting work (manim-web)

Package root: this directory (`packages/manim-web`). It re-implements the public
API of **Manim Community v0.21** in TypeScript so scenes render in real time in
the browser (Canvas2D). Read `docs/CONVENTIONS.md` and `docs/TESTING.md` first.

## Porting recipe
* Source of truth: `../../reference/.venv/lib/python3.*/site-packages/manim/<path>.py`.
  Print it without docstrings: `../../reference/.venv/bin/python tools/pystrip.py <file.py>`.
  Port to `src/<same path>.ts` keeping names, defaults, algorithms and method order.
* Look at already-ported files for the house style and patterns:
  `src/mobject/geometry/arc.ts`, `line.ts`, `polygram.ts`, `src/animation/transform.ts`,
  `src/animation/creation.ts`, `src/mobject/types/vectorized_mobject.ts`, `src/mobject/mobject.ts`.
* Constructors: Python sets attributes *before* `super().__init__()` (which calls
  `generate_points`). In TS every constructor resolves its args with
  `pyargs(args, [positional names], {defaults})`, passes one kwargs object up via
  `super(kw)`, and each class reads its own attributes in
  `protected override _init_attrs(kw)` (then calls `super._init_attrs(kw)`).
  Fields are declared with `declare` (never class-field initialisers).
* Keyword arguments: public methods with fixed parameters automatically accept
  a trailing kwargs object (see `src/utils/kwcall.ts`; signatures are extracted by
  `tools/gen_index.mjs`). Methods that take `...args` must call `pyargs` themselves.
* Import cycles: use the late-binding registry (`src/utils/registry.ts`):
  `register({ MyClass })` at the bottom of the defining module and
  `registry.MyClass` at the use site.
* Public exports are generated: run `node tools/gen_index.mjs` after adding a
  module (classes become callable without `new`).
* Differences from manim get a `// web:` comment. Every public class/function gets
  a one-line TSDoc. No over-engineering; match manim's behaviour.
* Real time matters: avoid needless allocation in per-frame paths.

## Verify
```bash
npx tsc --noEmit 2>&1 | grep -E "<your files>"    # others' files may be mid-edit; ignore their errors
node tools/gen_index.mjs
../../reference/.venv/bin/python tools/py2js.py --json examples/manim_examples.json examples/manim_examples_js.json
node tools/regress.mjs <ExampleName...> --images   # then LOOK at examples/regress_out/<key>.png (manim | web | diff)
npx vitest run test/<your test>.test.ts
```
Examples relevant to a class: `grep -l` in `examples/manim_examples.json` (field
`code`), or the `module` field. Aim for `pass` (or a `warn` you can explain,
e.g. font hinting). Also write a few focused vitest tests (numbers vs manim; you
can compute reference values with the manim venv python).

## Shared tree etiquette (several agents work concurrently)
* Only create/edit the files you own (listed in your task). If you need a small
  fix in a shared core file (`mobject.ts`, `vectorized_mobject.ts`,
  `animation.ts`, `scene.ts`, `camera.ts`, `player.ts`, `src/ext/py/*`,
  `tools/py2js.py`, `constants.ts`), make a minimal surgical Edit (never rewrite
  or reformat) and list it in your final report.
* Do not run `tools/golden_examples.py` unless your task says so; do not `git commit`.
* Do not start dev servers; use the node harness.

## Final report (keep it short)
Files created; classes/functions ported; regression results for the relevant
examples (pass/warn/fail with the reason for each non-pass); shared-file edits;
known gaps.
