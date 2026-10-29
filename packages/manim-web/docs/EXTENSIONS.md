# manim-web extensions

Everything here is **not in Manim**. It lives under `src/ext/` (plus a few
documented hooks in core classes) and never changes how standard Manim code
renders.

| Module | What it adds |
|--------|--------------|
| `ext/player.ts` | `ScenePlayer`: real-time playback, exact seeking, speed, live mode |
| `ext/interact.ts` | `Interaction`, `DragHandle`, `constrain`: direct manipulation, hit testing, keyboard access |
| `ext/widgets.ts` | `Slider` drawn as mobjects |
| `ext/affordance.ts` | `AffordanceLayer`: halos, arrows, hints, dashed paths and a coach mark over interactive figures |
| `ext/dragdrop.ts` | `Draggable`, `DropZone`: drag mobjects into zones, snapping, return if missed |
| `ext/cut.ts` | `Cutter` (knife strokes) and polygon / disc splitting |
| `ext/stamp.ts` | `Stamp`: tap to place copies, count them |
| `ext/scrub.ts` | `Scrubber`: drag a number sideways to change it |
| `ext/tokens.ts` | `TokenBuilder`: tiles dragged into slots, reported as LaTeX / calculator text |
| `ext/marker.ts` | `NumberLineMarker`: a pin on a NumberLine with a live value |
| `ext/juice.ts` | `Juice`: snap rings, bursts, counter tweens, synthesized blips; `set_muted` |
| `ext/geom.ts` | 2D geometry for the above (point in polygon, areas, outlines of VMobjects) |
| `ext/lint.ts` | Scene linter (layout QA) |
| `ext/describe.ts` | Scene description (data + text) |
| `ext/export.ts` | MP4/WebM export with audio, PNG frames |
| `ext/py/` | Run Manim **Python** code in the browser (with `tools/py2js.py`) |
| `camera/camera.ts` `effects` | Themes: backgrounds, glow, shadow, grain, vignette |
| `utils/kwcall.ts` | Keyword arguments for every public method |

## Scenes as timelines: `ScenePlayer`

Manim renders a scene to a video. manim-web *records* it instead: `construct()`
runs once, every `play`/`wait` becomes a **segment** with a snapshot of the
state at its start. Any frame can then be recomputed exactly (restore the
segment snapshot, then step forward with Manim's own frame rules - updaters,
`dt`, rate functions), so seeking is exact and cheap.

```ts
import { ScenePlayer } from 'manim-web/ext/player';
const player = new ScenePlayer(new MyScene(), canvas, { live: true });
await player.load();          // runs construct(), records the timeline
player.play();                // real time, with add_sound() audio
player.seek_time(3.2);        // exact frame at 3.2 s
player.set_rate(1.5);         // speed
player.show_end();            // final state (like save_last_frame)
await player.play_now(FadeIn(extra));   // animate outside the timeline (interactive use)
player.refresh();             // redraw after changing a ValueTracker from UI code
```

Frame counts follow Manim exactly (`ceil(run_time·fps)` per animation,
`int(duration·fps)` for frozen waits), so `seek_time(t)` shows the frame
Manim would have written at `t`.

**Waiting for a voice.** `player.wait_for(at, end)` holds the picture before
each section (begun by `next_section()`) until `at[k]` seconds, and on its last
frame until `end`; the timeline (`duration`, `time`, `seek_time`) then runs on
the voice's clock, and the picture stays where it is when the waits change.
A picture that is already late never waits. The arithmetic is `voice_waits` (a
pure function, exported beside the player): the lesson doctor and
`apps/mathnim/tools/beats.mjs` use it to report what will play. Lessons get `at` from the narration's
beats (`§`) and the recording's word timings (`beat_times` in
`@mathnim/core`), so the same scene lines up with any voice
(docs/COURSE-PLAYBOOK.md, "Time each scene to its voice").

**Recording skips to the last frames.** Recording only needs each segment's
starting state, so a segment with no stop condition and no updater that takes
`dt` runs just its last 3 frames (`Scene.LAST_FRAMES`) instead of all of them
(5-10x faster: a 20 s scene no longer freezes the page when a step opens). The
last frames let a chain of updaters that read each other (a grid that follows a
matrix that follows `n`, each one frame behind the next) end where
frame-by-frame recording leaves it. Two things would make a segment end
differently from the frames the player then shows, and so jump at the next
segment: a chain of followers 3 or more deep, and an updater without `dt` that
accumulates per frame (`m.shift(0.01 * RIGHT)`, smoothing `x += (target - x) * 0.2`).
Write such motion with `dt` (it is then recorded frame by frame) or as a
function of a ValueTracker. When it was introduced (October 2026), all 414
visuals and lesson scenes recorded this way matched frame-by-frame recording
pixel for pixel, except float rounding on 44 (edge anti-aliasing).

**Closures and snapshots.** Snapshots capture mobjects, ValueTrackers,
animations and the camera. State hidden in JS closures (a counter captured by
an updater) is not visible to them; call `scene.track(mob)` for extra
mobjects, or keep state in a ValueTracker.

## Direct manipulation: `Interaction`

```ts
import { Interaction, constrain } from 'manim-web/ext/interact';
const ui = new Interaction(player);
const d = ValueTracker(2);
ui.add_handle({
  tracker: d, label: 'distance',
  from_value: (v) => [v, 0, 0],            // tracker value -> handle position
  to_value: (p) => p[0],                   // dragged position -> value
  constraint: constrain.on_segment(mul(4, LEFT), mul(4, RIGHT)),
  step: 0.1,                               // arrow-key step
});
ui.on_click((point, hits) => console.log(hits.map((m) => m.constructor.name)));
player.start_live();                        // keep updaters running while dragging
```

* Handles can move a mobject directly (`mobject`), set one tracker
  (`tracker` + `from_value`/`to_value`), two trackers (`trackers: [x, y]`),
  or call your own `get`/`set`.
* Constraints: `free`, `on_segment`, `on_line`, `on_circle(center, r, arc?)`,
  `on_curve(f, t_range)`, `in_box`, `snap(step)`, and `all(...)` to chain.
* Accessibility: the canvas is focusable; **Tab** cycles handles, **arrow
  keys** move them (Shift = 5x), and `aria-label`/`aria-valuetext` describe
  them.
* `hit_test(point)` returns the mobjects under a point (leaf, then top-level)
  using fill containment and stroke distance - the basis for "what is this?".

`Slider(tracker, { x_range, length, label, decimals })` is a slider drawn with
mobjects (so it appears in exports); `slider.attach(ui)` makes it draggable.

## Interaction toolkit: drag and drop, cut, stamp, scrub, tokens, markers, juice

Game-like lessons are built from a few primitives on top of `Interaction`.
None of them knows about goals, stars or scores (that is `@mathnim/core`):
each one changes the scene, calls `ui.on_change()` (through `ui.notify()`)
and reports what happened through its callbacks, which a lesson turns into
semantic events (`world.emit('bet', { zone })`).

Common to all of them:

* **One registry.** Every primitive is an `InteractiveItem` registered with
  `ui.add_item()` (the constructors do it). Pointer presses go to handles
  first, then to the item with the highest `priority` that is hit (then the
  best score, then the topmost): draggables and scrubbers (2) win over stamp
  areas (1), which win over a knife (0). `item.enabled = false` switches one
  off (e.g. a "knife" / "hand" tool toggle).
* **Pointer events** (mouse, pen, touch). `touch-action: none` is set on the
  canvas while an `Interaction` exists and restored by `ui.dispose()`. Touch
  gets larger hit tolerances (items 16 px instead of 6 px; handles 36 px
  instead of 26 px). A second finger during a drag is ignored.
* **Keyboard.** Tab cycles through handles, then focusable items, in creation
  order; each item documents its keys below (arrows, Enter, Escape, Delete).
  Shift makes arrow steps 5x, as for handles.
* **Screen readers.** The canvas's `aria-label` lists every control;
  `aria-valuetext` describes the focused one (`item.describe()`); primitives
  announce results ("coin 2 placed in the 16-inch bet", "tile placed: 3 of
  12") through `ui.announce(text)`, a polite live region next to the canvas.
* **Affordances.** With an `AffordanceLayer`, every item draws its own cue
  (see below); `aff.coach()` demonstrates the first handle, or, when there is
  none, the first item (a coin travelling to its zone, a knife swipe with a
  dashed trail, a tap). Hint labels are kept inside the canvas (the font
  shrinks, then the text is ellipsized, if a label is wider than the canvas).
* **Feedback.** `new Juice(ui)` becomes `ui.juice`; the primitives then click
  on pick-up, pulse and "snap" on drops, pop on stamps, swish on cuts, tick
  while scrubbing. Without it they are silent.
* **Snapshots.** Primitives change the live scene after `show_end()` (like
  handles); seeking the player restores the recorded state.

```ts
import { Interaction } from 'manim-web/ext/interact';
import { AffordanceLayer } from 'manim-web/ext/affordance';
import { Juice } from 'manim-web/ext/juice';
const ui = new Interaction(player);
const juice = new Juice(ui);          // optional: sounds and rings
new AffordanceLayer(ui).coach();      // optional: cues and a demonstration
```

Pure helpers (no DOM) are exported next to each primitive and unit-tested:
`split_polygon`, `choose_zone`, `snap_to_grid`, `stamp_position`,
`scrub_value`, `build_expression`, `tween_value`... (see
`test/interact_geometry.test.ts`).

### Drag and drop: `ui.add_draggable(mobject, options)`

```ts
const bet_big: DropZone = { id: 'big', region: big_pizza, label: 'the 16-inch pizza', snap_to: 'none' };
const bet_small: DropZone = { id: 'small', region: { box: [1.3, 5.4, -2, 2.7] }, capacity: 10 };
const coin = ui.add_draggable(coin_mob, {
  zones: [bet_big, bet_small], return_if_missed: 'home', label: 'coin 1',
  on_drop: (zone, d, info) => world.emit('bet', { zone, from: info.from }),
});
coin.zone_id;                  // 'big' | 'small' | null
draggables_in(ui, 'big');      // everything on that bet
```

| Option | |
|---|---|
| `zones` | `DropZone[]`: `{ id, region, snap_to?, accepts?, capacity?, when_full?, label?, hint? }` |
| `snap` | grid step (`0.5` or `[sx, sy]`, with `snap_origin`, applied while dragging), magnet points (`[[x, y, 0], ...]`, on drop within `snap_radius`), or any `Constraint` |
| `return_if_missed` | `true`: back where it was picked up (and into its old zone); `'home'`: back to `home` (out of every zone) |
| `constrain` | a `Constraint` on the item's centre (`constrain.in_box(...)`) |
| `home`, `label`, `hint`, `halo`, `lift`, `to_front`, `step`, `data` | home position (default: current), accessible name, hint text, pulsing halo, 6% lift while dragged, bring to front, arrow-key step, anything |
| `keyboard_zone(d, moved)` | which zone Enter drops into (default: the nearest allowed one; `null`: none) |
| `on_pick(d)`, `on_move(d, p)`, `on_drop(zone_id \| null, d, info)` | `info = { from, point, missed, via: 'pointer' \| 'keyboard' \| 'code' \| 'bump', bumped }` |

A **region** is a Mobject (its bounding box, read live), `{ shape: vmobject }`
(its outline), `{ polygon }`, `{ box: [xmin, xmax, ymin, ymax] }`,
`{ center, radius }` or a predicate `(p) => boolean`. The zone for a drop at
the item's centre is chosen by `choose_zone`: containing zones first (the
smallest, then the nearest centre), then zones within `snap_radius` (0.35).
`snap_to`: `'center'` (default), `'none'`, a point, or
`(d, p, n_already_there) => point` for layouts (a row of coins). A full zone
rejects the drop, or with `when_full: 'bump'` pushes its oldest item back to
where the new one came from (a swap) or home. `on_drop` fires once the item
has settled (after the short snap animation), with the zone it ends up in.

Also: `d.send_to(zone | id | null)` (a drop from code, with callbacks),
`d.reset()` (home, silently), `d.remove()`, `d.can_enter(zone)`.

Keyboard: Tab selects a draggable; arrow keys pick it up and move it (Shift
5x); Enter drops it into the nearest allowed zone (or `keyboard_zone`);
Escape puts it back; tabbing away drops it where it is. Affordance: a
pulsing halo until one item of the kind has been used; while one is moved,
the zones are outlined (dashed, animated), the candidate zone is filled and
labelled "Drop here" (`zone.hint`).

### Cutting: `ui.add_cutter(options)` and polygon splitting

```ts
// general: split whatever the stroke crosses, then make the pieces draggable
ui.add_cutter({ targets: () => tiles, on_split: (old, pieces) => pieces.forEach((p) => ui.add_draggable(p)) });
// pizza fast path: radial cuts -> sectors
let cuts: number[] = [];
ui.add_cutter({
  adjust: (a, b) => snap_line_through(a, b, C, 0.4),      // strokes near the centre go through it
  on_cut: (a, b) => { cuts = add_cut_angles(cuts, disc_cut_angles(C, R, a, b)); rebuild(sectors_from_angles(cuts)); },
});
```

Press, drag and release draws a straight stroke (a red line, `color` /
`width`); strokes shorter than `min_length` (0.8) are ignored. `region`
limits where strokes may start (default: anywhere another item does not
claim). `adjust(p0, p1)` can move or reject strokes (live preview included).
With `targets`, every closed VMobject the stroke crosses all the way
(`through`, default true) is replaced in the scene (same draw order, also
inside groups) by `Polygon` pieces with its style, and `on_split(old, pieces)`
is called. `on_cut(p0, p1)` fires for every accepted stroke; `cutter.cut(p0,
p1)` cuts from code; `cutter.cuts` lists the strokes.

Geometry (pure): `split_polygon(poly, a, b)` splits any simple polygon by the
line a-b (convex: two pieces, left of a->b first; concave: all pieces; null
when the line misses), `split_vmobject(m, a, b)` does it for a closed
VMobject approximated as a polygon (circles, sectors, squares; 12 samples per
Bezier curve, straight edges exact), `stroke_crosses(poly, p0, p1)`,
`vmobject_to_polygon(m)`, `polygon_area`, `polygon_centroid`. Discs:
`disc_cut_angles(C, R, p0, p1, tolerance)` gives the radial cuts of a stroke
(`[θ, θ+π]` across the centre, `[θ]` from the crust to the centre, `[]` when
it misses the centre), `add_cut_angles` merges them, `sectors_from_angles`
lists the pieces, `sector_polygon` turns one into a polygon for further
general cuts.

Keyboard: Tab to the knife shows an aimed line through the region's centre;
Left/Right turn it (15°, Shift 45°), Up/Down shift it, Enter cuts.
Affordance: "Swipe to cut" above the region; `coach()` swipes a ghost hand
with a dashed trail across it.

### Stamps: `ui.add_stamp(template, options)`

```ts
const tiles = ui.add_stamp(radius_square, {
  area: { center: C, radius: r }, grid: r, origin: C, max: 4, label: 'radius-square',
  on_count: (n) => world.emit('tiles', { n }),
});
tiles.count; tiles.stamps; tiles.place(p); tiles.remove(m); tiles.clear();
```

Tap in the `area` places a copy of the template (or `make(p)`) centred at
the tap, snapped to `origin + k * grid`; pressing and dragging positions it
before release. Drag a placed stamp to move it (snapped); drag it out of the
area (it fades, "Release to remove") or double-click / double-tap it to
remove it. `max` limits the count (`on_full`), `unique` (default with a grid)
allows one stamp per grid point. A quick double tap on empty space places one
stamp. Callbacks: `on_place`, `on_move`, `on_remove`, `on_count(n)`.
`adopt(m)` / `forget(m)` hand over pieces, e.g. of a stamp cut by a knife
(adopted pieces are not snapped): `on_split: (old, ps) => { tiles.forget(old); ps.forEach((p) => tiles.adopt(p)); }`.

Keyboard: arrow keys move a placement cursor (grid steps, kept in the area),
Enter/Space places, Delete/Backspace removes the stamp under the cursor.
Affordance: a translucent ghost under the mouse (and the keyboard cursor)
where a stamp would go, a dashed outline of the area and "Tap to place a
{label}" until first use.

### Scrubbable numbers: `ui.add_scrubber(number, tracker, options)`

```ts
const r = ValueTracker(2);
const num = DecimalNumber(2, { num_decimal_places: 1 }).next_to(label, RIGHT);
ui.add_scrubber(num, r, { step: 0.1, min: 0.5, max: 4, px_per_step: 6, label: 'the radius' });
```

Dragging sideways on the number changes the tracker by `step` every
`px_per_step` CSS pixels (8), on the step grid (anchored at `min`), clamped
to `[min, max]` (`scrub_value(start, dx_px, o)` is the pure rule). A
DecimalNumber target is updated too (`sync`, default true); a MathTex target
is redrawn by the lesson's own updater. The target can be a function (for
`always_redraw`). Cursor `ew-resize`; callbacks `on_start`, `on_change(v)`,
`on_end(v)`.

Keyboard: arrows ±1 step (Shift 5), PageUp/PageDown ±10, Home/End min/max.
Affordance: a dotted underline, ◂ ▸ arrows and "Drag ↔ to change {label}".

### Token builder: `ui.add_tokens(options)`

```ts
const b = ui.add_tokens({
  tokens: ['r', '\\pi', { tex: '^2', display: '\\square^2', label: 'squared' }, '\\times', '2'],
  slots: 3, slots_at: [1.4, 1.3, 0], tray_at: [0, -1.6, 0],
  on_change: (latex) => world.emit('formula', { latex }),
});
b.value();          // '\\pi r^2'   (empty slots skipped; b.value('latex', '\\square') shows them)
b.value('plain');   // 'pi*r^2'     (implicit products get '*')
b.complete; b.sequence(); b.reset(); b.set_sequence(['\\pi', 'r', '^2']);
```

Tiles (a rounded rectangle with a MathTex) sit in a tray row; slots are
dashed boxes (`b.slot_boxes`) and capacity-1 drop zones (`b.slots`):
dropping on a full slot swaps the tiles (or sends the old one back to the
tray), dropping anywhere else returns the tile to the tray. The builder only
reports the sequence; grade it with `@mathnim/core`'s expression grader
(`build_expression(seq, 'plain' | 'latex')` is the pure rule, `token_plain`
maps `\pi` -> `pi`, `\times` -> `*`, `^{2}` -> `^2`).

Keyboard: Tab to a tile; Enter puts it into the first empty slot, or back
into the tray when it is in a slot; arrows move it freely and Enter then
drops it into the nearest slot.

### Number-line marker: `ui.add_marker(number_line, tracker, options)`

```ts
const guess = ValueTracker(1);
const m = ui.add_marker(nl, guess, { label: 'your estimate of π', decimals: 2, snap: 0.01, show_value: false });
m.show_value(true);   // reveal after the estimate
```

A pin (tip on the line) and a live DecimalNumber label, added to the scene
and kept at the tracker's value by an updater; dragging is a regular
`add_handle` (so `m.handle` has the handle's keyboard access, halo, arrows
and dashed path). Options: `min`/`max` (default the line's range), `snap`,
`step` (default a tenth of the tick step), `color`, `font_size`, `size`,
`on_change(v)`, `on_end(v)`. Handles come before items in the Tab order.

### Juice: `new Juice(ui)`

```ts
const juice = new Juice(ui);
juice.snap(p);                    // ring + snap blip (the primitives do this)
juice.success(p);                 // confetti burst + chime (the lesson decides when)
juice.fail(p);                    // red ring + low blip
await juice.count_to(tracker, 12, { duration: 0.5, round: true });  // tween a counter
juice.sound('click' | 'tick' | 'pop' | 'snap' | 'swish' | 'success' | 'fail');
set_muted(true); set_volume(0.5); set_reduced_motion(true | false | null);
```

Rings and particles are drawn on their own transparent overlay canvas
(created on the first effect, removed with `ui.dispose()`); sounds are short
oscillator/noise blips synthesized with WebAudio (`SOUNDS` lists them; no
audio files, nothing plays before the first user gesture). With
`prefers-reduced-motion` (or `set_reduced_motion(true)`): no particles, rings
do not grow, snaps and counters jump, and an item's coach mark shows a still
hand (handle halos and their coach mark are unchanged). `tween()`,
`glide(ui, mob, to)` and `tween_value()` are the animation helpers the
primitives use.

### Writing a new kind of item

Implement `InteractiveItem` (`kind`, `hit(p, tol)`, `down/move/up`, `key`,
`describe`, `draw_affordance(ctx)`, `coach_path()`...) and call
`ui.add_item(item)`. `AffordanceCtx` gives `halo`, `outline`, `label` (kept
inside the canvas), `arrows`, `px` (scene -> overlay pixels), `fresh` and
`show_hint` (one hint on screen at a time) and `reduced_motion`.

The demo page `dev/interact.html` (`npm run -w manim-web dev`, then
`/interact.html`) shows every primitive in a small scene.

## Quality gates: linter and description

```ts
import { lint_frame, lint_timeline } from 'manim-web/ext/lint';
lint_timeline(player)   // -> [{ rule, severity, message, mobjects, time, segment }]
```

Rules: `off-frame` (cut off or outside), `text-overlap`, `label-crosses-line`,
`tiny-text` (< 14 px at 1080p), `low-contrast` (< 3:1 against the background),
`crowded` (> 12 texts), `too-fast` (text animated in < 0.25 s). Text-like
mobjects are recognised by class (Text, MathTex, DecimalNumber...), so the
linter works on any scene.

```ts
import { describe_scene, describe_text } from 'manim-web/ext/describe';
describe_text(player.scene)
// - MathTex "\theta = 16.3^\circ" [MathTex#12], #2563EB, top-right at (3.75, 2.75), 2.1×0.5
// Parameters: ValueTracker#3 = 12
```

Stable ids (`name` if set) let a tutor refer to objects; the text is also a
screen-reader alternative.

## Export

```ts
import { export_video, export_png } from 'manim-web/ext/export';
const mp4 = await export_video(player, { fps: 30, quality: 'high', on_progress: (f) => ... });
```

WebCodecs (via mediabunny) renders faster than real time; audio from
`add_sound()` is mixed in. Falls back to WebM/VP9 where H.264 is unavailable.

## Themes and effects

`camera.effects` (see `CameraEffects` in `camera/camera.ts`): `background`
(`solid`, `linear`, `radial`, `paper`), `dotGrid`, `grain`, `vignette`,
`glow` (default radius for mobjects with `mob.glow = true`), `lineCap`,
`lineJoin`. Per mobject: `mob.glow = true | radius`, `mob.shadow = { color,
blur, offsetY }`. Without effects the output matches Manim.

## Keyword arguments everywhere

Manim code passes keywords freely (`mob.rotate(angle=PI, about_point=ORIGIN)`,
`always_shift(sq, RIGHT, rate=5)`). In manim-web every public function and
method accepts a trailing plain object of keywords:
`tools/gen_index.mjs` records each signature and `utils/kwcall.ts` maps the
keywords to positions. A plain object is treated as keywords only when all its
keys are parameter names (or when it comes from transpiled Python), so option
objects passed positionally still work.

`Cls.set_default({...})` works for mobjects and animations (applied when the
public constructor is called).

## Running Manim Python: `ext/py`

```bash
python tools/py2js.py scene.py > scene.js
```
```ts
import { load_transpiled } from 'manim-web/ext/py';
const mod = load_transpiled(js);          // { MyScene, ... }
```

The transpiler keeps Python semantics through a small runtime
(`ext/py/runtime.ts`): numpy-style broadcasting for `UP + 2 * LEFT`, list
concatenation for `[a] + [b]`, Python truthiness, slicing, negative indices,
`**kwargs`, bound methods, f-strings, comprehensions, `super().__init__`
ordering (attributes set before `super().__init__()` are applied before
`generate_points`). `ext/py/numpy.ts` provides the numpy/math/random subset
Manim code uses, with CPython- and numpy-compatible Mersenne Twister so seeded
random layouts match Manim. All 390 transpilable doc examples of Manim
transpile; see `docs/TESTING.md` for how they are compared with real Manim.

## Text without Pango: `ext/text`

manim draws `Text`, `MarkupText`, `Paragraph` and `Code` with Pango. manim-web
lays text out itself (`ext/text/pango.ts`: HarfBuzz-style shaping, Pango's
pixel-rounded glyph widths and line metrics, wrapping, justification,
underline/strikethrough; `ext/text/markup.ts`: Pango markup;
`ext/text/highlight.ts`: small pygments-compatible lexers and styles) from font
files parsed with opentype.js (`ext/text/fonts.ts`). `Text(...)` stays
synchronous, so fonts are loaded first:

```ts
await load_fonts();                                    // ScenePlayer.load() does this
await register_font('https://example.com/Inter.woff'); // TTF / OTF / WOFF (TTC in node)
await register_font('Fira Code', bytes, { weight: 700 });
set_generic_family('sans', 'Inter');                   // what 'sans' / 'sans-serif' mean
```

* Bundled open fonts (`ext/text/fonts/`, OFL / Bitstream Vera licences) stand in
  for the fonts Pango uses on macOS: `''`/`serif` -> Tinos (Times metrics),
  `sans`/`sans-serif` -> Arimo (Helvetica/Arial metrics), `monospace` ->
  DejaVu Sans Mono (Menlo is derived from it). Their ascent/descent are set to
  the macOS fonts' values so line heights match. Latin, Greek and Cyrillic
  only: other scripts need `register_font`; unknown families fall back to the
  default font with a console warning.
* Node (`load_fonts({ system_fonts: true })`, used by the regression harness)
  registers the real macOS fonts (Times.ttc, Helvetica.ttc, Menlo.ttc), looks
  up other families in the system font folders and loads CoreText's fallback
  fonts for CJK / Tamil / Devanagari / Arabic / Hebrew, so glyph positions match
  manim's goldens exactly.
* Not implemented: AAT (`morx`) shaping beyond fi/fl, contextual (GSUB type 6)
  substitutions, Indic reordering, GPOS mark attachment (marks are centred on
  their base), full Unicode bidi (a simplified version handles Arabic/Hebrew).
