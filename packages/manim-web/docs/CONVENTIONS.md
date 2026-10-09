# manim-web conventions

manim-web re-implements the public API of **Manim Community v0.21** in
TypeScript so scenes run in real time in the browser. The goal is *API and
visual* equivalence, not bit-for-bit numerical identity.

## 1. Layout mirrors manim

Every Python module `manim/<path>.py` becomes `src/<path>.ts`
(e.g. `manim/mobject/geometry/arc.py` -> `src/mobject/geometry/arc.ts`).
Keep the same class and function names, in the same file, in the same order
where practical. Put a one-line header comment naming the source module.

Things manim does that the browser does not need (CLI, config files, OpenGL
renderer, video/sound writers, LaTeX compilation, caching) are not ported.

## 2. Names are manim's names

| manim (Python)                     | manim-web (TypeScript)                     |
|------------------------------------|--------------------------------------------|
| `Circle(radius=2, color=BLUE)`     | `Circle({ radius: 2, color: BLUE })`       |
| `Line(LEFT, RIGHT, buff=0.1)`      | `Line(LEFT, RIGHT, { buff: 0.1 })`         |
| `mob.next_to(b, DOWN, buff=0.5)`   | `mob.next_to(b, DOWN, { buff: 0.5 })`      |
| `self.play(Create(c), run_time=2)` | `this.play(Create(c), { run_time: 2 })`    |
| `mob.animate.shift(UP)`            | `mob.animate.shift(UP)`                    |
| `mob[0]`, `len(mob)`, `for m in g` | `mob.get(0)`, `mob.length`, `for (const m of g)` |

* Classes: same PascalCase names. All public classes are also callable
  without `new` (`Circle()` and `new Circle()` both work) - see
  `src/utils/callable.ts`. Inside the library always use `new`.
* Methods, properties, parameters, option keys: same **snake_case** names as
  manim (`get_center`, `stroke_width`, `run_time`, `rate_func`).
* Keyword arguments are a trailing plain object. Parameters that are
  positional-or-keyword in Python are normalised with `pyargs()`
  (`src/utils/pyargs.ts`), so both `Line(LEFT, RIGHT)` and
  `Line({ start: LEFT, end: RIGHT })` work, exactly like Python.
* Python properties become getters/setters (`width`, `height`, `color`,
  `animate`...). Python `__getitem__` becomes `get(i)` (negative indices
  allowed) and `get_slice(a, b)`; `__len__` becomes `length`;
  `__iter__` becomes `[Symbol.iterator]`.

## 3. Numbers, points, vectors

* A point / vector is `Point3D = [number, number, number]` (plain array).
  Constants (`UP`, `DOWN`, `ORIGIN`, ...) are frozen arrays.
* `mobject.points` is a `Float64Array` of length `3 * n` (x, y, z per point) -
  manim's `(n, 3)` numpy array, flattened. Use the helpers in
  `src/utils/points.ts` instead of hand-rolled loops where one exists.
* Vector arithmetic: use `src/utils/vector.ts` (`add`, `sub`, `mul`,
  `norm`, `normalize`, `cross`, `dot`, `interpolate`, ...). Numpy semantics:
  scalars broadcast.
* Angles are radians (`DEGREES`, `PI`, `TAU` exported as in manim).

## 4. Colours

`ManimColor` (`src/utils/color/core.ts`) mirrors manim's class. Anything that
accepts a colour accepts a `ParsableManimColor`: hex string, `ManimColor`,
`[r, g, b]` or `[r, g, b, a]` floats. All manim colour constants
(`BLUE`, `BLUE_E`, `PURE_RED`, `XKCD.*` ...) are exported.

## 5. Porting rules

1. Read the Python source of the class and port its logic, including default
   values. Keep manim's algorithms (e.g. Bezier handle construction, point
   alignment) so animations look the same.
2. Where manim calls native code (Cairo, Pango, LaTeX, skia-pathops,
   mapbox-earcut, scipy, networkx) use the browser adapter or a small JS
   implementation, and note the difference in a comment starting `// web:`.
3. Deprecated aliases and OpenGL-only branches are dropped.
4. No global mutable state except `config` (`src/_config.ts`).
5. Every public class/function gets a short TSDoc line; say what differs from
   manim if anything does.
6. Extensions that manim does not have live under `src/ext/` and are
   documented in `docs/EXTENSIONS.md`.

## 6. Verification

* `tools/golden.py` dumps points/styles from real manim for listed
  constructors; `test/*.test.ts` compare (tolerance 1e-6 units unless noted).
* `tools/py2js.py` transpiles manim's documentation examples; the example
  gallery renders each scene's last frame and compares it with manim's.
