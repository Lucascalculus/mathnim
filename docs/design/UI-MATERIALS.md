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
