# @mathnim/engine

The kernel figures are made with (the design: `docs/design/ENGINE.md`; what was built and measured:
`docs/design/ENGINE-REPORT.md`). A figure is **state** (params and what is derived from them), **things with roles**
that show it, a **layout by rules**, a **script** that is a pure function of time, and the **checks** that must hold.
How every role looks (colour, stroke, type size, motion) is `@mathnim/look`; a figure never names a colour, a
coordinate on the canvas or a font size.

## A figure in one screen

```ts
import { Figure, Marker, Path, beat, column, reveal, row, set, t, wait, type XY } from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from './kit';

const XS = Array.from({ length: 41 }, (_, i) => -2 + i / 10);
export function bowl_figure(p: { a: number; lang: string }): Figure {
  const fig = new Figure({ lang: figure_lang(p.lang) });            // the page's language; no font to wait for
  const a = fig.param('a', p.a, { range: [0, 2], step: 0.1 });       // state: params (and derive(() => …) values)
  const x = fig.param('x', 1, { range: [-2, 2], step: 0.05 });
  const P = fig.plot({ id: 'plane', x: [-2, 2], y: [0, 4], x_ticks: [-2, 0, 2], y_ticks: [0, 2, 4], priority: 2 });
  const curve = P.add(new Path(() => XS.map((u): XY => [u, a.value * u * u]), { id: 'curve', role: 'noun:cost' }));
  const dot = P.add(new Marker(() => [x.value, a.value * x.value ** 2], { id: 'dot', role: 'noun:cost' }));
  fig.label('y = a x^2', dot, { id: 'dot_word', tex: true });       // attached: placed where it hides least
  fig.handle(P, x, null, { id: 'x_handle', says: t('a point on the curve', '曲线上的点') }); // glass, on in explore
  fig.layout(row([P, column([fig.caption(t('the [cost](noun:cost) is a bowl', '[代价](noun:cost)是一个碗'), { id: 'cap' })])]));
  fig.script(reveal(P, curve, dot), beat(), set(a, 2, 'travel'), wait(1)); // beat(): a § of the narration
  fig.check('the dot is on the curve', () => (Math.abs(a.peek() * x.peek() ** 2 - dot.where()![1]) < 1e-9 ? null : 'off'));
  return fig;
}
export const bowl = define_figure({
  name: 'bowl', summary: 'A parabola y = a x² whose a grows; the learner moves a point along it.', topics: ['parabola'],
  params: { a: { type: 'number', min: 0, max: 2, default: 0.5, doc: 'the coefficient a' }, lang: LANG_SPEC },
  examples: [{}, { lang: 'zh' }], figure: bowl_figure, explore: () => {},
});
```

Read a ported figure before writing one: `packages/visuals/src/mpc/qp_figure.ts` (a scene and a world),
`mpc/shift_tail.ts` (a page figure), `linalg/determinant_area.ts` (handles on vectors),
`ft/b/training_curves.ts` (small multiples). The MPC kit for the cart is `mpc/track.ts`.

## What there is

| | |
|---|---|
| state | `param`, `derive`, `read`, `untracked`; params clamp to `range`, snap to `step` (a script's motion is exact) |
| blocks (layout) | `row`, `column`, `grid`, `optional(block)`; a `Row` is a column on a phone unless `phone: 'row'`; `fig.layout(root, { phone })` gives a phone its own composition of the same things |
| text | `fig.caption` (wraps, CJK line rules, `**bold**`, `[word](noun:x)` in a noun's colour), `fig.list` (items revealed one by one), `fig.readout` (TeX, numbers with tabular digits, `{ gap }`), `fig.legend` (entries can fade in with `show`) |
| plots | `fig.plot({ x, y, ticks, x_label: tex or { text }, aspect, fill, axes: 'xy' \| 'x' \| 'origin', numbers, priority, phone_aspect })` |
| marks (in a plot) | `Path` (`upto` draws it on; `heads: [0.5]` puts arrowheads along it), `Region`, `Marker` (dot ring cross square arrow), `Dots`, `Arrow`, `Drawn` (draws itself), `Field` (GPU-shaded scalar field: `quadratic(...)` or your own GLSL/WGSL/CPU), `VectorField` (a grid of arrows sampled from f, spaced in CSS px; `scale: 'unit'` puts strength in the opacity, `'linear'` in the length), `Handle` (`to: (d) => [θ]` holds it to a circle or a curve; `at` draws it where its thing is) |
| vector fields (`vectors.ts`) | `streamline(f, seed, { h, dir, bounds, stop })`: RK4 along the field's direction (each stage normalised: the step is a distance), ending at the edge (clipped onto it), a stop, a stagnation point or back at its seed |
| simulation (`sim.ts`) | `fig.sim({ inputs, start, accel \| deriv, method: 'verlet' \| 'euler' \| 'rk4', dt, max_t })`: a fixed step from the state its inputs give, so `sim.state` (at `sim.clock`) is a pure function of the inputs and the time: `run(sim, s)` in a script, seeks exact, replays bit for bit, a checkpoint every quarter second (a seek costs at most that); `sim.at(t)`, `sim.series(t0, t1, every)` for traces; in explore the player advances running sims in real time (`play`, `pause`, `restart`); `hold_with(handle)`: held, the run waits at its start; let go, it runs. A changed input starts a new run (clock 0) |
| labels | `fig.label(content, thing \| point \| () => point, { sides, on: plot, own, within, tex })` |
| script | `reveal`, `hide`, `set(param, to, intent, dur?)`, `wait`, `beat`, `together`, `seq`, `lagged(lag, …)`, `call(dur, u => …, params)`, `over(dur, step)`, `run(sim, s)`; intents (reveal, travel, grow, converge, settle, emphasise, draw, write, linear, simulate) are springs or curves in the look |
| manim's shapes (`shapes.ts`) | `Circle`, `Ellipse`, `Arc`, `Sector`, `Polygon`, `Rect` (rounded), `Line`, `Brace` (+ `tip()` for its label), `RightAngle`, `Angle`, `TexMark` (TeX or words at a point: MathTex, Text, DecimalNumber), `Flash`, `ImageMark`; `stage()` is a plot in manim's coordinates with nothing drawn; `slider(fig, param, { label })` |
| manim's motions | `create` (Create / DrawBorderThenFill), `uncreate`, `write`, `grow(from, …)` (GrowFromCenter / Edge / Point), `indicate`, `flash(plot, at)`, `transform(a, b)` (shape into shape), `crossfade` (words into words), `seq` (Succession), `lagged` (LaggedStart), `call` (UpdateFromAlphaFunc), intent `'linear'` |
| 3D, minimal (`view3d.ts`) | `new View3D({ phi, theta, gamma?, zoom? }, { size, radius, target?, obstacles? })` with `.dots`, `.line`, `.polyline`, `.arrow`, `.face`, drawn far to near with manim's camera angles; `orbit(fig, plot, view)` turns it by dragging. No depth buffer, so: `pieces` cuts a line or an arrow for the order, `.bar(from, to, { half, segments })` is a solid (faces turned away culled, the rest shaded by one light; `face({ shade, cull })` for your own), `bias` draws an item lying on a face over it, `show` (a param) brings items in one by one; `px(p)` puts a label on a 3D point, `screen_axes()`, `handle3d(fig, plot, view, { get, put, params, along? })` drags a 3D point in the screen's plane or along a line |
| world | `fig.report_with(() => …)`, `fig.emit`, `fig.listen`; a subclass adds `set_state` etc. for goals and `solve()` |
| checks | `fig.check(name, () => null \| problem)`; `fig.lint()`; `fig.describe()`; `fig.explain(id)` |
| certainty (every mark) | `certain: 0` on a `Path`, `Marker` (dot / ring), `Dots`, `Region` or `Arrow` marks it a guess: dashed, a ring, no tint, an outlined head; `certain: k` with `set(k, 1, 'converge')` establishes it (the dashes close up, the ring fills from its edge, the tint comes in). Hollow → solid means the same in every course |
| development (`cases.ts`) | `P.add(new Cases((i) => polyline_i, { count, upto }))`: a family of cases drawn one after another in transparent ink (`ink`, default 0.14), deepest where they agree: secants closing onto a tangent, a pencil of lines keeping its eigen-directions, sample paths settling. A pure function of `upto` (a fraction fades the last case in); kept on a film that grows with it and is drawn anew when it goes back or what the cases read changes. Visual: `tangent_develop` |
| time as matter (`trail.ts`) | `P.add(new Trail((t) => xy, { at, ahead, until, ticks }))` or `new Trail({ sim, xy: (y) => xy }, o)` (at: the sim's clock): the path walked solid, ghosts every `every` s (default 0.1) where they fell, fading with age (spacing is speed), the next `ahead` s dashed (a prediction, stopped at `until`), `ticks` across the path at moments. The past is sampled once and kept (going on adds samples, going back costs nothing, a change to what it reads resamples). Visual: `phys_throw` |
| guess, then see (`guess.ts`) | `const g = guess(fig, P, value, { id, role, at: (v) => xy, to: (d) => v, truth, tolerance, says })`: a hollow ring the hand drags; letting go commits it, once (no button), and tells the lesson an answer (right within the tolerance). `g.on_commit(f)`: what showing the answer is (a sim plays, a reveal runs); `g.fresh(...)` first in the script, so a replay asks again. `new Gap(a, b, { shown, text })`: a distance drawn and said (how far off). `timer(fig, id, dur)`: a 0 → 1 clock for a reveal in explore (a sim underneath). Visual: `phys_throw` with `predict: true` |
| formula steps (`steps.ts`, `steps_check.ts`) | `new Steps(lines)` is one block of any figure's layout (beside a plot: `row([P, column([st])], { align: 'center' })`), moved by the figure's script with `st.go(k)` in `together(...)` with the rest, a `beat()` before each line; `steps_figure(lines)` is a figure of the steps alone (filling a stage); visuals `formula_steps` and `substitute_point` (a graph and the steps of putting a number in). A derivation as one formula that changes line by line (any subject: algebra, calculus, units, chemistry `\ce{}`, logic, Chinese in `\text{}`); every resting frame is the typeset line; tokens are matched from the TeX (stay, travel over the relation on an arc, flow together, cancel, appear); `parse_steps` takes lines as people and models write them (`% reason`, `$…$`, aligned, numbered); `review_steps` reads, typesets and checks them (`check_steps`: equations keep their solutions, chains stay equal, inequalities keep their direction, d/dx, limits, values put in, units by size, truth tables, balanced reactions; what it cannot read is `unchecked`, never `ok`). In a text a ```` ```steps ```` block becomes one (present's `math_html` + `mount_steps`); the tutor's prompt says how to write them Nouns: `new Steps(lines, { nouns: { x_0: 'value', f: 'function' } })` (or a block's line `% nouns: x_0 = value`) draws those symbols, in every line, in their noun's colour and names them for the mirror; a reason's `$…$` is drawn as the characters it shows |
| the tutor's hands | `manifest_of(fig)` (what is on screen, what the hand can move: params under a handle or `{ tutor: true }`, named by `says`); `player.act({ op: 'point' \| 'set' \| 'note' \| 'reset', … })` checks the act (`check_act`), moves as a hand would and keeps `fig.hands().history`; `act_now` does it at once (node). The model writes `ACT:` lines after its words (`packages/ai/src/acts.ts`); `node apps/mathnim/tools/tutor_acts_e2e.cjs` checks it all in the page |

## Overrides (the freedom layer)

Roles are the default, not a cage: anything manim could draw, a figure can draw. Every override is reported by the
lint as a warning (never an error) and listed by `describe()`, so a reviewer sees where a figure left the grammar.

| | |
|---|---|
| any thing's look | `style: { color, text, width, dash, alpha, fill, fill_alpha, size, weight, family, italic, backing }`; colours are palette keys (`cobalt`, `ink2`, `muted`, the old `accent` `gold` `coral` `good` `purple`), roles (`noun:wall`) or `#rrggbb` |
| labels placed by hand | `fig.label(…, { avoid: false, sides: ['right'], gap: 0, offset: [dx, dy] \| () => […] })`; `sides: ['center']` with `avoid: false` puts it exactly on its anchor; `style.backing` gives it a paper card |
| exact positions | `place([[block, [x0, x1, y0, y1]], …])` in a frame (default manim's: x ±7.11, y ±4, y up); `fig.layout(root, { pad: 0, design_w: 984 })` lays the desktop out at one width and draws it scaled, text and all, as a manim scene; a plot's `data_box: true` makes the box it is given its data area |
| plots | `x_numbers` (which ticks carry a number), `x_unit` ("10 m"), `number_tex`, `grid_at`, `tick_marks: { x: 'cross', y: 'none', len }`, `label_px`, `style` (axes, numbers); `plot.inset(block, 'top-left')` puts a legend inside the data area |
| legends, readouts | entries and parts take their own `style` / `color` / `size`; `stack`, `swatch`, `line_h`, `gap` |
| your own drawing | `Drawn` (in a plot's coordinates; gets the plot and itself) and `fig.canvas(...)` (a block of your own) |

A port from manim: `packages/visuals/src/mpc/qp_figure.ts` (the scene's rectangles, sizes, dashes and timings, and a
phone composition of its own); compare old and new with `node apps/mathnim/tools/side_by_side.cjs`.

## The rules the lint enforces

Text overlaps no text; nothing leaves the figure; text is shown at least 12 px and 4.5:1 against the stage (a size or
colour the figure's style chose is a warning); a handle's
target is at least 44 px; one vermilion `verb` per screen; every noun is one the look knows (add new ones to
`NOUNS` in `@mathnim/look`, reviewed); no instructions in the figure ("drag …"); your own `check`s hold. The doctor
lints every figure wide (960 × 540) and on a phone (360 wide) at the end of every section of its script.

## Tools

- `npm run doctor`: lessons, both languages, both sizes, worlds solved headlessly.
- `npm run check -w @mathnim/visuals -- --only <name>`: the visual checker (handles to the corners of their ranges,
  live-frame cost, a contact sheet with the phone layout). Look at the sheet.
- `node apps/mathnim/tools/beats.mjs <lesson>/<step>`: a narrated figure against its voice (the script's log per section).
- `node packages/engine/tools/profile_drag.mjs`: where a drag frame's time goes.
- `node apps/mathnim/tools/perf_steps.cjs <label> <base-url>`: open, frame, seek, idle and drag costs of steps in a browser.
- In node: `packages/engine/node.ts` (`use_node_canvas`, `lint_figure`, `render_figure`, `node_player`).

## Accessibility: the DOM mirror

A figure's words are on a canvas; `mirror.ts` puts a layer of plain elements over it, built from the registry: one per
thing that says something (a legend's entries and a readout's parts each on their own), where it is drawn and in
reading order, with transparent text that can be selected; marks are named by their `says`; readouts are announced
politely after the hand stops; each handle is a keyboard slider (`aria-valuetext` names its params by `says`). TeX is
read as words (`tex_to_text`). The player makes it once the canvas is in a page (`mirror: false` for a canvas only
recorded). `node apps/mathnim/tools/mirror_check.cjs` checks it in the page and saves the words drawn over the figure.

## How it runs

`FigurePlayer` has `ScenePlayer`'s surface (the runtime and the view take either through `make_player` in
`@mathnim/core`). The canvas is drawn at the size it is shown (CSS px × device pixels, at most 2), and laid out for
it: below 560 px wide, the phone layout, and the stage grows to the figure's height. A frame is drawn only when a
param it depends on changed (`watch_writes`); still figures cost nothing. Things that have not changed are drawn
once into cached layers. Fields use WebGPU (after a self-test), else WebGL2, else the CPU (a software GL counts as
none).
