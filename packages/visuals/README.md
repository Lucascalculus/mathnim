# @mathnim/visuals

Parametric, pre-verified explanation scenes ("visuals") shared by authored
lessons and AI answers, the compact catalog the AI chooses from, and the
named-colour themes they are drawn with.

## What a visual is

A visual is a small, self-contained explanation: a manim-web `Scene` of 8-30 s
that builds one idea step by step and then *stays explorable* - the student
drags handles and sliders and everything follows live. It is parametric, so one
visual answers many questions ("the same picture for **this** matrix").

The AI tutor never writes scene code on the fast path. It reads `catalog()`,
picks a visual, fills in its parameters as JSON, and `check_params` fills
defaults, clamps out-of-range values and reports what it changed. Because the
visual was checked for every example beforehand, the answer is on screen within
the 8-second budget and cannot break the layout.

```ts
import { catalog, check_params, get_visual } from '@mathnim/visuals';

const v = get_visual('lambda_sweep')!;
const { params, notes, errors } = check_params(v, { A: [[2, 1], [1, 2]] });
const player = new ScenePlayer(v.scene(params), canvas);
await player.load();
player.play();
// when it ends: player.show_end(); v.explore?.(player.scene, new Interaction(player), params); player.start_live();
```

The contract (`src/visual.ts`):

| Field | Meaning |
|---|---|
| `name` | snake_case, unique |
| `summary` | one line for the AI: what it shows and what the student does |
| `topics` | tags used to narrow the catalog |
| `params` | `ParamSpec` per parameter: type, range, default and a `doc` the AI reads |
| `examples` | parameter sets that must pass the checks (include the edge cases) |
| `scene(p)` | the explanation as a Scene; it ends on an explorable state |
| `explore(scene, ui, p)` | adds handles/sliders (`ext/interact`, `ext/widgets`) to the finished scene |
| `ids` | names (`mobject.name`) of the key objects, for highlighting and scene descriptions |

## Writing a visual

1. `define_visual<P>({...})` in a file of its own (group by subject: `geometry/`, `linalg/`).
2. **Parameters for a model.** Give ranges that cannot break the picture and a
   `doc` that says what the value does, with sensible example values
   (`'the matrix, rows first [[a, b], [c, d]]; e.g. [[2,1],[1,2]] (λ = 3, 1) ...'`).
   Matrices are `{ type: 'matrix', rows, cols, min, max }`.
3. **Examples** cover the defaults and the edge cases (det 0, negative det,
   repeated or complex eigenvalues, correlation near 0 and near 1...). The
   checker runs every one of them in both themes.
4. **Colours by name only**: `palette()` (read inside `construct()`), so the
   light and the 3b1b-like dark theme both work. Font sizes >= 24; everything
   inside the 14.2 x 8 frame.
5. **State lives in ValueTrackers**, registered with `this.track(...)`, so the
   player's snapshots can seek exactly. Values cached by updaters are stored as
   properties of a mobject (they are snapshotted too), never in closures.
6. **Deterministic**: seeded data (`linalg/math.ts`: `rng`, `gaussian`,
   `cloud2`, `cloud3`), no `Math.random`, no time-based updaters. No updater
   that accumulates per frame without `dt` (`x += (target - x) * 0.2`), and no
   chain of 3 or more updaters each following the next: recording runs only the
   last 3 frames of such segments, so the scene would jump between segments
   (`packages/manim-web/docs/EXTENSIONS.md`, "Recording skips to the last frames").
7. **Explore** works on the finished scene: handles set trackers
   (`ui.add_handle({ get, set, constraint, step, label })`), sliders are
   `Slider(...).attach(ui)`. Keep every handle's effect inside the frame: the
   checker drags every handle to the far corners and lints each state.
8. **No sentences in the picture.** A note about the figure (a simulation, a toy
   model, exact or real data and its source, how to read it) goes through
   `aside(this, words(...))` (`src/aside.ts`): its words are kept on the scene
   and the lesson shows them in a faint line under the figure; the visual gets
   an empty group in its place. Labels on things (an axis, a curve, a value)
   stay in the picture.
9. **Name the key objects** (`m.name = 'matrix'`) and list them in `ids`.
10. Register it in `src/index.ts` and run the checks.

Pitfalls met while writing the linear algebra set:

* Animating a *new* `VGroup` of mobjects that are already on screen inside
  another group (e.g. `Indicate(VGroup(entry1, entry2))`) makes the scene split
  that group apart (standard manim restructuring), and the group's updaters
  stop. Animate the members themselves.
* A `DecimalNumber` that changes its number of characters during a `FadeIn`
  breaks the animation; call `m.update(0)` on live readouts right before
  animating them in.
* Add a named group to the scene at the end (`this.add(group)`) when its members
  were animated in one by one, so the id exists.

`linalg/kit.ts` has the building blocks: a `Plane` (math plane placed in a box
of the frame), clipped grids of a linear map (`transformed_grid`, dense
families fade and merge), live arrows and labels that follow tips and dodge
each other, `LiveMatrix` (entries follow trackers, brackets drawn as paths),
`readout`, `live_row`, `switcher`, and `MatrixTrackers` (a 2x2 matrix in four
trackers with `morph` and `lerp` animations). `linalg/math.ts` has the pure math
(2x2 eigen-decomposition incl. repeated and complex cases, determinant,
covariance, projection variance, Jacobi eigen-solver, PCA, seeded clouds).

## Checking

```bash
npm run typecheck -w @mathnim/visuals
npm test -w @mathnim/visuals                       # vitest: math + catalog + helpers
npm run check -w @mathnim/visuals                  # every visual x example x theme
node tools/check_visuals.mjs --only eigen_hunt --theme dark --full
```

`tools/check_visuals.mjs` bundles `check_visuals.ts` with esbuild and, for every
registered visual and every example (defaults included) in both themes: checks
the parameters, builds and records the scene, runs `lint_timeline` (off-frame,
text overlap, tiny text, contrast, crowding, pacing), calls `explore()` with a
stand-in `Interaction`, drags each handle to the extremes and lints every state,
checks that the declared ids exist, measures one live frame, and writes a
contact sheet (frames along the timeline, the end state and an explored state)
per example to `$TMPDIR/mathnim-visuals-check/<name>-<example>.png`
(`--out dir` to change, `--full` also writes the single frames). It exits with
1 on any lint error, crash, invalid example or missing id. The bundle is written
to `tools/.cache/`; a relative import inside manim-web that does not exist yet
(another package being edited at the same time) is stubbed and reported rather
than failing the run.

## Catalog

| Visual | What the student sees and does |
|---|---|
| `circle_slices` | A circle cut into slices lined up into a near-rectangle r high and πr wide (A = πr²); sliders for slices and line-up. |
| `linear_map` | A 2x2 matrix moves the grid; î and ĵ land on A's columns and v = xî + yĵ lands on x·Aî + y·Aĵ; drag î and ĵ, grid and matrix follow. |
| `determinant_area` | The unit square becomes a parallelogram of area det A; ĵ turned onto î's line gives det 0, past it det < 0; drag î and ĵ. |
| `eigen_hunt` | A probe v circles while Av follows; lining up highlights the eigenline and reads λ = ±\|Av\|/\|v\|; drag v. |
| `lambda_sweep` | Grid under A − λI beside the curve det(A − λI); at each root the grid collapses and the eigenvectors appear; drag λ. |
| `rotation_no_eigen` | A moves into a rotation: eigenlines merge and vanish, the field swirls, λ = a ± bi = \|λ\|e^{±iθ}; drag î and ĵ. |
| `matrix_power` | Aⁿv swings a fan of vectors onto the dominant eigenvector; in the eigenbasis A only stretches axes (A = PDP⁻¹); scrub n, turn the fan. |
| `symmetric_ellipse` | A symmetric S turns the unit circle into an ellipse with perpendicular eigenvector axes of half-length \|λ\|; drag the axis ends. |
| `covariance_ellipse` | A seeded 2D cloud: mean, sign of (x − x̄)(y − ȳ), live Σ, 1σ and 2σ ellipses; drag some points. |
| `pca_projection` | A line through the mean turns; the variance of the projections peaks at λ₁ on Σ's top eigenvector; turn the line. |
| `pca_3d` | A 3D cloud, its principal axes and variance shares, projection onto the PC1-PC2 plane, camera looking at it; turn, tilt, project. |
