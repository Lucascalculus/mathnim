# Course covers: a drawing journal

Each course page opens on a drawing made for that course alone (`apps/mathnim/src/covers/<slug>.ts`, listed in
`covers/index.ts` with where its words sit). Lucas, 2026-11-08: "每个课的绘画风格都可以不一样。有时候未必要跟课程主题
完全紧密相连，这才是艺术" and "重要的是过程，不是结果". So this file is a journal: what each drawing tried, what it
looked like, what was learnt. Read it before drawing the next one; add to it after.

## What holds for every cover

- **The words come first.** Decide where the title, start and map will sit, then draw around that space. The
  drawing frames a clear part; it never runs under the words. (MPC: the track's infield. Fine-tuning: the lower
  left, under the flock's wing.)
- **One drawing, one gesture.** A cover that reads as a figure sheet (several small plots side by side) is ugly:
  the first MPC attempt, a rail with a phase plane, a QP and a road bend, looked like a dashboard. One big shape
  with a lot of life inside it reads as art.
- **Drawn in once, each part at its own pace.** Every cover arrives when the page opens (lines drawn, glyphs
  flying in, shapes sliding) and then rests. Reduced motion shows it finished. Its animation lives in its own
  `<style>` inside the SVG, with class names of its own.
- **Light.** It is a background: thin lines, low opacity, the page's paper showing through. The title is the
  darkest thing on the page.
- **Colour means something within the drawing**, not across the site. Each course's start button takes the
  course's colour (a wash of it, never a black block: Lucas, "我很不喜欢那个黑色按钮").
- **Check it in the real page** at 1440 x 900 (and 1920, 1024), after the drawing has finished arriving.
- **Cost** (measured 2026-11-08, headless Chrome at 1440 x 900): what costs is not the drawing's file but the
  number of elements and, above all, of animations. The glyph flock first had 2,500 glyphs each in its own `<g>`,
  each animated: 550 KB, 55 ms to insert, frames of 170-250 ms while it arrived. Now glyphs arrive in a few dozen
  waves (one animation per group: a stretch of a flock, a ring of the halftone, a random share of the dots),
  glyphs turn by the text's own `rotate` (no wrapping `<g>`), repeated attributes are classes: 218 KB, about
  35 ms, 36 animations, no long frames. Rule: under 3,000 elements, under 100 animations, and nothing animates
  after the arrival. The page computes each drawing once a visit.

## The covers

### MPC: the Team Bat logbook's track (technical line drawing)

A rounded track round the page, cone dots, cars, bays, a drift skidpad, small mono labels with real units
(≥ 2 m, R 1.05 m, β 30°). Strokes draw themselves in (`pathLength=1`, a dash of 1.3 because Chrome measures arcs
short), each at its own pace. Taken unchanged from the logbook ("直接用log book的画"), its cars filled with the
page's colour, held at its bottom edge so a short window loses empty sky and not the bays.

Learnt: the first attempt drew MPC's own pictures (the rail, the phase plane, the QP) from the lessons' real
runs. It was accurate and ugly. Truth to the subject is not what makes a cover.

### Fine-tuning large language models: a murmuration of words (glyph particles)

About 2,500 tiny glyphs (Latin, digits, Chinese, punctuation) fly as starlings do at dusk: each flock a ribbon
twisting along a Bézier spine, its seen width |cos| of the twist, so it pinches thin and dark where it folds
edge-on and spreads where it faces us. A big mass over the upper right, a smaller flock splitting off down the
right, a thin stream leaving along the top left. A violet thread (the course's colour) flies inside the big one.
The glyphs arrive along each flock's length from a little behind, as a wave.

Tried and learnt:
- First a single long S-shaped ribbon of 1,500 glyphs round the title: it read as a river of letters, not a
  flock. A murmuration needs mass: few, wide ribbons, many birds, and the folds.
- Across the ribbon, birds spread evenly (|u|^0.8), not by a Gaussian: a flock has edges.
- An element's `transform` attribute and its CSS animation `transform` are one property: rotate each glyph on a
  wrapping `<g>` and animate the `<text>`, with the arrival offset turned into the glyph's own frame.
- Chinese glyphs at 8 px read as small smudges: fine for birds, since nobody reads them.

### Geometry through motion: a Bauhaus poster (flat shapes, printers' colours)

A yellow disc cut into twelve slices, five of them out and laid head to tail in a strip below it (the old way of
finding a circle's area, stopped halfway); a fine outline of the whole disc; a red triangle leaning in from above;
a black diameter with a dot; a blue quarter disc in the corner; rules and a row of shrinking dots. Overlaps
multiply, as inks do. The shapes spring into place (`transform: var(--from)` to `var(--to)` in one keyframe rule,
an overshooting curve), each at its own time.

Tried and learnt:
- Bold colour can hold a light page if it keeps to one side and the blacks stay small: the title must still be
  the darkest, heaviest thing; the diameter went from 2.4 to 1.6, the dots down a size.
- With slices missing, a disc stops reading as a disc; a fine outline of the whole circle brings it back and
  makes the gaps meaningful.
- Moving SVG shapes with CSS: set `transform` in CSS (it overrides the attribute; the origin is the SVG's 0 0),
  and keep each shape drawn at the origin, so `--from` and `--to` are plain translate/rotate/scale.
- Placing nested wedges, apex up and apex down by turns: the up ones sit with their apex at baseline − R cos(a/2),
  the down ones with their apex on the baseline; centres half a slice width apart.

### Internet Technologies: a transit map (thick flat lines, 45° and 90°)

A yellow loop and four lines (red, blue, green, purple) crossing it on a 20-unit grid, bends rounded by a fixed
radius (a quadratic at each corner), white ringed interchanges, stubs for single-line stations, and stations named
after protocols (DNS, TCP, TLS, BGP…): the net as a city. The lines are laid one after another, the interchanges
pop, the names fade in last. Its colour is the red line's, so its start button is red.

Tried and learnt:
- A closed path that starts at a corner leaves that corner sharp and an overlap at the end: start a loop in the
  middle of an edge.
- Stubs (stations) go on the side away from the name, in the line's own colour; grey stubs read as dirt.
- A course with nine units cannot show its map with names on a cover: the map becomes its dots, only the next
  stop named, each named on hover. (A rule of the page, not of this drawing: any course over four units.)
- A course made from slides must still say so on its cover, but as a quiet grey mono note, not in the accent.
- The drawing decides the page's colour: a cover's own colour wins over the course's.

### ECON90015: a risograph print (two inks, grain, off register)

Fluorescent pink and blue, multiplied where they overlap. A pink halftone sun (dots on a grid turned 15°, big in
the middle, small at the rim) and across it a blue band rising and a pink band falling, crossing in an X. The
drum's grain is an SVG filter on every solid (fractal noise turned into an alpha mask: `feColorMatrix` with alpha
row `0 0 0 -2.4 1.75`, then `feComposite in`); the blue layer sits 5 px off register. The inks slide in from
either side; the sun comes up ring by ring.

Tried and learnt:
- A halftone on a square, upright grid reads as polka dots. Turn the screen (15°) and keep the biggest dot small
  (r ≈ 5 on a 14 grid): then it reads as print.
- Grain on large strokes is cheap and does most of the work of "riso"; misregistration has to be small (a few
  px) or it reads as a mistake.
- Long titles: a first line over 16 characters is set a size down (a page rule now), so "ECON90015 mock exam"
  stays on one line above its light "explained".

### Introduction to Machine Learning: a pointillist dusk (Seurat)

About 3,000 dots of pure colour on a jittered 15-unit grid: violet-blue sky, an orange sun, green hills flecked
with their complement (a red dot among the greens, as Seurat did), water at the bottom. A dot's region is picked
by a soft coin across each border (a logistic in the signed distance), so the edges blur as classes overlap. The
picture dissolves towards the title (keep a dot with probability smoothstep in x) and frays at the top. Dots are
dabbed on in no order over about 2.5 s.

Tried and learnt:
- Gaps between dots make it look sparse and cold; larger dots close the gaps without adding elements (cost
  matters: every dot is an element with its own animation).
- A landscape needs only three or four regions with clear shapes (a horizon, a sun, hill crests as two sines);
  the eye does the rest.
- A very long bold line ("Introduction to Machine Learning") must wrap where the meaning breaks: `text-wrap:
  balance` on the bold line gives "Introduction to / Machine Learning" (a page rule now).

### MKTG90037: paper cut-outs after Matisse

Fronds of seaweed, coral blobs and uneven stars in ultramarine, coral, pink, leaf green and yellow, pinned loosely
over the right, overlapping (multiplied). Outlines are Catmull-Rom curves through points nudged a few per cent
(scissors are not exact). Each piece drops in from above, turning, and settles with a small overshoot.

Tried and learnt:
- A frond is its lobes: first, lobes as gentle bumps on both sides made long wavy blobs, nothing like Matisse.
  What reads as his algae is deep finger lobes, one side at a time, and their tips lifted (pull each outline
  point up by a share of its lobe's width).
- Big flat shapes need room: keep them clear of the map's end as well as of the title.
- A blob with 4 or 5 lobes of +28% radius and a second harmonic reads as cut coral; stars need uneven points
  (±18%) or they look printed.

### MGMT90141: a dry garden (karesansui)

Three stones in raked gravel, each ringed by concentric rake lines (slightly wobbly ellipses, squashed to 0.86 for
a little perspective); across the rest of the bed, parallel lines with a gentle swell, broken where a stone's
rings begin, their left ends ragged where the raking stopped short of the title. Warm grey lines, stones in a
grey gradient lit from the upper left with a soft shadow, a little moss tucked under the big stone. The stones are
there first; the rake is pulled across line by line from the top; then the rings go round. Slower than the others,
on purpose.

Tried and learnt:
- Calm comes from repetition and slowness: one line weight, one spacing (14), long durations (2.6 s per line),
  a small stagger. Anything fast breaks it.
- The ragged edge towards the title is part of the drawing (where the raking stopped), and it has to stop well
  short of the words and of the map: the rows level with the title start further right (a bulge in the start x).
- Moss off to one side of a stone reads as a stain; under its foot it reads as moss.
