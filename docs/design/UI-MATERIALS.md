# Interface materials (2026-11-03)

Lucas, after the physics lab (`docs/design/gpu/`, kept): "我要的可能不是这种’难’，而是在 UI 设计方面很难……能
generalize 到很多场景的 next gen UI design，我们是为了这个设计材质和动画。" Then: "先不用管现有的逻辑。先想，有哪些
动画和材质、效果可以做。然后先做出来再说……refine to perfection."

So these are **interface** materials: what a control, a panel, focus, a transition, feedback or the AI's presence
is made of. Each must work in any course and any scene. Its physics is how it behaves, not a lesson topic.

## What makes an interface material hard

The rendering is the easy part. These are the hard parts:

- It reads over any content and at any size, from a 44 px button to a full sheet.
- A child knows what to do with it without words.
- It is alive when touched and quiet at rest; every motion can be interrupted and keeps its velocity.
- It costs a phone almost nothing, and it has a reduced-motion version.
- It sits next to the other materials without becoming a hodgepodge.

## Brainstorm (unfiltered)

Glass that really refracts the page under it. Controls whose selection flows like liquid between options. A living
island that changes shape with what it holds. The pointer as a light that surfaces catch. Touch that ripples
through a surface. Cards that are soft bodies when thrown. Depth of field that pulls focus to the sheet you
opened. A thread that ties a sentence to its note and goes slack or taut. Paper that bends and peels to reveal
what is under it. Text that forms out of light particles as an answer streams, and dissolves when dismissed. Ink
that bleeds through paper fibres as a view transition. A presence for the AI made of matter: listening, thinking,
speaking. Variable blur at the edges of a scroll. Iridescent foil for mastery that turns with the device.
Icons that morph by signed distance. A dock-like fisheye over a long list. Progress as liquid that sloshes in its
vessel. A single burst of pigment powder for success. Film grain and ordered dithering as a texture of time.
Skeleton loading as moving caustic light. Typography whose weight answers proximity. Magnetic snapping. Shared
element transitions on springs. Volumetric light from the focused element. Chrome that condenses into one control.

## Round A: ten, built first

| # | Material | The interface job | Behaviour |
|---|---|---|---|
| A1 | **Liquid glass** | Controls and sheets that float over content | Real refraction of the page under it with dispersion at the bevel, frost, one light plus the hand's light; nearby glass merges |
| A2 | **Liquid selection** | Choosing one of several (tabs, segmented controls, toggles) | The selection is a drop that flows to the new option with surface tension, stretching with speed |
| A3 | **The living island** | One control that holds the current state | One shape that morphs on springs between idle, asking, thinking and the answer ready |
| A4 | **Touch light** | What can I touch, and did I touch it | Surfaces have relief; the hand is a light they catch, and a press sends a ripple through the surface |
| A5 | **Soft cards** | Things you can pick up, throw and stack | Cards bend with their velocity and settle on interruptible springs; the edge rubber-bands |
| A6 | **Focus pull** | Attention: what matters now | Opening something pulls focus: the rest recedes in real depth of field |
| A7 | **The thread** | Connecting two things (a sentence and its note, a question and its answer) | A rope with physics: slack when idle, taut when you pull, it follows both ends |
| A8 | **Light into text** | Generated content arriving | Each glyph forms out of light particles as it streams, and dissolves when dismissed |
| A9 | **Ink transition** | Moving from one view to the next | The next view bleeds through the paper along its fibres from where you touched |
| A10 | **Paper** | Hidden content: an answer, a back side | A sheet you curl and peel by hand, lit by the one light, with its back showing |

Round B (ten brand-new) comes after the open-source study.

## Re-aim (Lucas, 2026-11-03, again)

"不要拘泥于目前我们的 UI interface objects 和操作逻辑……你有很大的自由去创建新的 objects，动画 for 新的操作方式和内容，
as long as 你觉得能 generalize。你研究的范围不只是 interface，而是一切有通用能力的材质、动画，只需要能服务我们这个项目。"

So round A is re-picked around **new objects and new operations on knowledge**, any of which could appear in any
course. A1 liquid glass and A2 liquid selection stay as built.

| # | Object / material | The new operation | Why it generalises |
|---|---|---|---|
| A3 | **Semantic zoom** | Pinch a paragraph: it condenses continuously to its key phrase, then its gist; spread it to unfold. Folds leave a mark where detail hides. | Every text in every course has levels of detail |
| A4 | **Pull a noun out** | Drag a coloured word out of the sentence: it lifts off the paper and lands on its thing in the figure (and back) | Text and figure share nouns everywhere |
| A5 | **Time as matter** | Any process leaves ghosts; a ring scrubs time; behind is solid, ahead dashed | Every process can be rewound |
| A6 | **The guess object** | A hollow ring you place on anything; the truth converges into it; the gap is measured; its width is your confidence | Predict-then-see works on any figure |
| A7 | **Certainty** | Marks and digits are clouds while uncertain and sharpen as evidence arrives | Every estimate, every half-known fact |
| A8 | **One thing, another view** | Data morphs continuously: dots → histogram → curve → one number; every frame true | Representations are the core of learning |
| A9 | **Memory patina** | What you learned ages (ink fades, edges soften) along a forgetting curve; review restores it | Review in every course |
| A10 | **The tutor as light** | The AI is a light, not a character: it travels to what it speaks about, pools there, and writes | The tutor is on every page |
| A11 | **Exploded view** | Any composite (a formula, a figure, a sentence) comes apart in depth into labelled parts and reassembles | "What is this made of" is universal |
| A12 | **The thread of reasoning** | Steps of an argument hang on a thread; take one away and the thread goes slack | Every derivation and proof |

## Built in round A so far (2026-11-03)

Liquid algebra (SDF glyphs), semantic zoom, pull a noun out, time as matter, the guess object, certainty, one
thing in another view, liquid glass, liquid selection. Still to do from the list: memory patina, the tutor as
light, exploded view, the thread of reasoning (Lucas then asked to focus on the most next-generation, hardest
materials, and to add ten for mathematical objects).

## Ten materials for mathematical objects (Lucas: "添加 10 个对数学实体可视化的动画和材质。refine to perfect")

Each is a real GPU material that could become a manim-web primitive. The object's mathematics is computed, not
drawn.

| # | Object | Material | What is exact |
|---|---|---|---|
| M1 | Vector field | Light that flows along it: GPU particles leave fading trails; sources glow, sinks swallow | Trails are integral curves (RK4); brightness ∝ speed |
| M2 | Linear map | The plane as woven fabric deformed by the matrix; tiles shade by det; a negative det shows the fabric's back | Every point moves by A; tile area = |det A| |
| M3 | Complex function | An enamel relief: height log|f|, phase as a ring of the site's pigments; zeros are wells, poles are peaks you drag | Argument principle: winding around a loop = zeros − poles |
| M4 | Surface z = f(x, y) | Plaster ray-marched with soft shadows; contours appear as the camera rises to straight above | Contours are exact level sets |
| M5 | Fourier series | Machined steel epicycles that draw in ink | Partial sums of the real coefficients |
| M6 | Topology | Glass that deforms continuously (a mug into a torus) | The genus never changes |
| M7 | Optimisation | A swarm of balls rolling on a landscape with momentum, settling into basins | Heavy-ball dynamics on ∇f |
| M8 | Iteration | Newton's method on z³ − 1: basins as a fractal that zooms smoothly | Each pixel is iterated, never cached |
| M9 | Four dimensions | A tesseract turning in 4D, projected in perspective with depth | Rotation in the xw plane |
| M10 | Eigenmodes | Chladni sand on a vibrating plate: sand gathers on the nodal lines | The modes of the plate |

### Results (all ten built and passing their own tests, 2026-11-03)

| # | Material | Measured |
|---|---|---|
| M1 | Vector field as light (long exposure, RK4) | radius drift after a full turn in a vortex 0.000 % |
| M2 | Linear map as fabric (weave, wrinkles along σ₂, back side) | unit-square area vs \|det A\| 0.30 %; back shown for det < 0 |
| M3 | Complex function in cloisonné (silver wires = conformal grid) | 38/38 windings = zeros − poles; right angles to 0.000° |
| M4 | Surface in plaster and water | water = {f < c} on 100 % of pixels |
| M5 | Fourier series in machined steel washers | error falls with every term; full rebuild 1e-11 px |
| M6 | Topology in glass (mug → torus) | χ = 0 at every sampled frame |
| M7 | Optimisation as a swarm (heavy ball) | 228/228 at minima; β = 0 keeps 114/114 in their basins |
| M8 | Newton's method (live iteration, zoom to a found boundary) | basins equal to 0.02 %; every root's neighbourhood correct |
| M9 | Tesseract in steel | edge error 4e-16; inner and outer cubes swap at 90° |
| M10 | Chladni sand | 82 % of sand on the nodal set (10 % of the plate) |

## Ten that need only a 2D engine (Lucas: "再加十个 2D 的，只用 2D 引擎就能跑的")

Canvas 2D only (no WebGL), so each can live in manim-web's renderer as it is.

| # | Material | What is exact |
|---|---|---|
| D1 | A broad-nib pen that writes any path | Stroke width = nib width × |sin(direction − nib angle)| |
| D2 | Paper that folds along a line | The folded part is the reflection of the plane in the crease |
| D3 | Marbling | Every tine stroke is an exact, invertible, area-preserving map (Jaffer & Lu) |
| D4 | Engraving: shading 3D forms with hatching | Line density follows the true Lambert shading |
| D5 | A thread between two things | Verlet rope of fixed length: slack or taut |
| D6 | Sand that builds a histogram | Each grain is one observation; pile height = count |
| D7 | Halftone density | Dot area = density, exactly |
| D8 | Shape morph that conserves area | Every in-between has the same area |
| D9 | Guilloché | A rosette is a sum of rotations |
| D10 | Paper layers in depth | Shadow offset ∝ height above the page |
