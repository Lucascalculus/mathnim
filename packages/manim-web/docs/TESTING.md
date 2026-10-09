# Testing manim-web

Everything is checked against **real manim** (Community v0.21, in
`../../reference/.venv`). Three layers:

1. `npx tsc --noEmit` - types.
2. `npx vitest run` - unit tests in `test/` (node, no canvas).
3. **Doc-example regression** - manim's own documentation examples
   (`.. manim::` blocks in its docstrings, 395 scenes) are transpiled from
   Python to JS, rendered by manim-web, and compared frame by frame with
   frames rendered by real manim.

## Doc-example regression

```bash
PY=../../reference/.venv/bin/python
$PY tools/extract_examples.py ../../reference/.venv/lib/python3.*/site-packages/manim examples/manim_examples.json  # once
$PY tools/golden_examples.py            # real manim -> examples/golden/<key>/f<N>.png, last.png  (slow-ish, parallel)
$PY tools/py2js.py --json examples/manim_examples.json examples/manim_examples_js.json   # transpile all
node tools/regress.mjs                  # headless compare (all, ~5 s)
node tools/regress.mjs Circle ArcBetweenPoints --images   # selected keys/names; writes examples/regress_out/<key>.png
node tools/regress.mjs --fail           # list only non-passing
```

Statuses: `pass`, `warn` (small differences, usually anti-aliasing or font
hinting), `fail`, `skip` (no golden: the example needs something Manim could not
render here), and `known` - the golden itself cannot be matched, listed with a
reason in `examples/known_diffs.json` (unseeded randomness in Manim, e.g.
StreamLines and spring layouts; Manim's double-drawn saved last frame). Keep
that list short and never use it to hide a manim-web bug.

* Frames are 480x270 at 10 fps. Frames are sampled every 5 frames plus the
  final state (`last`). Each example runs in its own worker, so config or
  class defaults changed by one example never leak into another.
* Status: `pass` = mean abs diff < 1.5/255 and < 0.5 % pixels off by > 40;
  `warn` = mean < 6 and < 4 %; otherwise `fail`. Also `warn` if the frame
  count differs from manim's.
* `--images` writes a strip `manim | manim-web | diff` for each non-passing
  example - look at it before trusting numbers.
* The same comparison runs in the browser at `dev/regress.html`
  (`npm run dev` in `dev/`, or the `manim-web-dev` launch config).
* `examples/golden/index.json` records why manim could not render an example
  (e.g. no LaTeX); those are `skip`.

## Transpiler

`tools/py2js.py` turns manim Python into JS that runs against
`src/ext/py/runtime.ts` (Python semantics for operators, indexing, kwargs...)
and `src/ext/py/numpy.ts` (numpy / math / random). A run-time
`NameError: name 'X' is not defined (not available in manim-web)` means the
class or function X has not been ported yet.
