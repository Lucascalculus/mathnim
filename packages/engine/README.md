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
  fig.handle(P, x, null, { id: 'x_handle', says: t('曲线上的点', 'a point on the curve') }); // glass, on in explore
  fig.layout(row([P, column([fig.caption(t('[代价](noun:cost)是一个碗', 'the [cost](noun:cost) is a bowl'), { id: 'cap' })])]));
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
| marks (in a plot) | `Path` (`upto` draws it on), `Region`, `Marker` (dot ring cross square arrow), `Dots`, `Arrow`, `Drawn` (draws itself), `Field` (GPU-shaded scalar field: `quadratic(...)` or your own GLSL/WGSL/CPU), `Handle` |
| labels | `fig.label(content, thing \| point \| () => point, { sides, on: plot, own, within, tex })` |
| script | `reveal`, `hide`, `set(param, to, intent, dur?)`, `wait`, `beat`, `together`; intents (reveal, travel, grow, converge, settle, emphasise) are springs in the look |
| world | `fig.report_with(() => …)`, `fig.emit`, `fig.listen`; a subclass adds `set_state` etc. for goals and `solve()` |
| checks | `fig.check(name, () => null \| problem)`; `fig.lint()`; `fig.describe()`; `fig.explain(id)` |

## The rules the lint enforces

Text overlaps no text; nothing leaves the figure; text is at least 12 px and 4.5:1 against the stage; a handle's
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

## How it runs

`FigurePlayer` has `ScenePlayer`'s surface (the runtime and the view take either through `make_player` in
`@mathnim/core`). The canvas is drawn at the size it is shown (CSS px × device pixels, at most 2), and laid out for
it: below 560 px wide, the phone layout, and the stage grows to the figure's height. A frame is drawn only when a
param it depends on changed (`watch_writes`); still figures cost nothing. Things that have not changed are drawn
once into cached layers. Fields use WebGPU (after a self-test), else WebGL2, else the CPU (a software GL counts as
none).
