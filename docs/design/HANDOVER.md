# Handover: the next-generation interface (2026-11-03)

For a cloud session picking up the visual design work. It is written to give you context and taste, not rules. Lucas
said: "暂时不要给那么多限制". Use your own judgement and go further than we did.

## What Lucas asked for, and how he judged it

His words, in order, so you can hear the bar:

- On what the interface is for:
  - "用下一代的设计语言。用 layout 和设计来代替文字说话。不必拘泥于平庸的设计，要求突破和创新。"
  - "当页面设计、排版、或动画能指引某个功能时，就不要用语言。需要语言时，要简洁。同时又需要保证这个设计确实能让人明白是干这个的。"
- On life and character:
  - "我想让这个页面看起来’像有生命力’，有点像多邻国那样有角色互动。但我不是说要画人上去……每个部分都看起来’有生命，有思考，有性格’。"
  - Apple's "克制中的美学". "细节中的完美。"
- On restraint:
  - "’克制’的意思，不是整个页面只能放一点东西。你看 iOS 它的元素一点都不少。’克制’是审美上的……任何材质都可以用……fancy 是可以的，但是不要大杂烩。要有自己的审美逻辑。"
- On ambition:
  - "不要收敛到一个平庸解。"
  - "你认为 5 年后的 iOS 会做成什么样？"
  - "大胆想象需求。"
  - "尽可能发挥你的全部能力和想象力。"
- On how general it must be, and for whom:
  - "审美框架需要有通用性，能 generalize 到其他课程"
  - "小孩子也能一眼明白怎么用"
  - "注意不要损失学习效率"
  - "不要拘泥于我们目前的底层框架。大胆地提出新的需求和新的功能。"
- On materials and animation:
  - "不但要探索一些普通材质，还要探索一些 harder 但更美的材质。"
  - "需要的是一些通用的材质和动画……最好对可视化数学还有点用"
- His last verdict on the work so far: "不错！但我觉得这些不是你最强的能力。这些对你来讲都太简单了。" **This is your
  starting point.**

**What he rejected, so you don't repeat it:**

| Rejected | What it was |
|---|---|
| Three cloud previews (展厅 / 路线 / 镜头) | "还差一大截" |
| A pen-tip tutor character | "非常俗，之前做过类似的" |
| Line-only design | "太粗糙" |
| Anything that reads as low-end, AI-flavoured style | Discarded on sight |
| Realistic rain | He wanted "很帅的粒子特效，目的是勾勒轮廓" instead |

**What he liked:**

- Course protagonists appearing at your progress (the MPC cart parked where you stopped, the circle rolled to your
  progress, the network packet at its hop), but only as a rare surprise: "出现一下会很惊喜，一直在那会很烦人".
- The direction from the first prototype on ("now I like the way you do it"):
  - the white study-model worlds;
  - the valley that turns into the top-view contour picture;
  - the night particles that trace outlines.

## Where things are

- `docs/design/NEXT.md`: the current logic, the review rounds, the research summary, what it asks of the framework,
  and the bold product requirements. Read it first.
- `docs/design/specimen/index.html`: one self-contained page; no build and no dependencies. To serve it:
  - `python3 -m http.server 5183 --directory docs/design/specimen`, or
  - the `specimen` entry in `.claude/launch.json`.

  Pages, via the `?v=` query (or the dashed "样本" bar at the bottom left):
  - `home`: course worlds under one camera.
  - `lesson`: MPC lesson 4, the valley. A ball rolls and stops at the wall fence; the camera turns to look down and
    the valley becomes the QP picture, with water showing the levels. A wrong guess offers "从你猜的地方放", and the
    class's guesses fall like sand.
  - `attn`: attention in the fine-tuning course, typeset words with a fan of lines from 「它」.
  - `materials`: the six core materials.
  - `lab`: what Lucas kept on 2026-11-03 (the rest was deleted): material candidates (water, thread, tinted sheets,
    spring, light; and from the cloud session's material lab the broad-nib pen, folding paper, a thread, sand that
    builds a histogram, paper layers), harder materials (ink in water, vector field as light, liquid algebra, liquid
    glass) and learning interactions (sketch your guess, teach back, time as matter, pull a noun out, one thing in
    another view; and from the second round of interface materials: a chain of why, definitions that unfold in the
    sentence, the exploded formula, brushing between formula and figure, a ripple of recomputation, numbers you drag
    with rolling digits, magnetic bins, the tutor as light, a constellation of what you know).

    The lab's materials are ES modules in `gpu/<section>/<name>.js`, one folder per section of the page (`mat`,
    `rare`, `int`). Their shared code is in `gpu/lib/`:
    - `gl`: our WebGL2 core;
    - `ui`: palette, fonts, the frame scheduler, springs, 2D helpers;
    - `geom`, `odometer`, `text` (line breaking), `lesson` (the sample page).

    The page must be served over http, not opened as a file.
  - `motion`: seventeen animations. The first seven are interface effects; the last ten help show mathematics.
  - `blocks`: the 28 building blocks, the nouns of mathematical figures, in six groups (quantity and function, space,
    landscape and field, chance and data, structure, wave and time); what each means and its measured test are in
    `docs/design/BLOCKS.md`. They are modules in `gpu/blk/`, on a shared kit `gpu/lib/plot.js` (nice ticks, a plot,
    adaptive sampling, the glass bead, the marks of the grammar, dimension lines, braces, a row of choices) and
    `gpu/lib/contour.js` (marching squares and the landscape the contour map and the terrain share).
  - Inside the page:
    - `window.__fx_all()` plays every effect.
    - `window.__gpu_accept()` runs the lab materials' tests, each with its tile scrolled on screen; pass paths such
      as `['int/why']` to run some.
    - The tests need frames: a hidden browser pane gives false failures. Headless Chrome needs
      `--use-angle=swiftshader --enable-unsafe-swiftshader` (instead of `--disable-gpu`) for the WebGL ones.
    - `mat/thread` fails its own length test (also in the cloud session's original).
- Published unlisted at https://lab.penghaolun.com/p/0y7r2k8c6i/ (noindex). After changing the specimen, run
  `npm run specimen` (copies it into `apps/mathnim/public/p/…`) before a deploy.
- `docs/design/specimen/shots/`: reference screenshots of where the work stands.
- `apps/mathnim/tools/page_shots.mjs`: drives a headless Chrome and saves screenshots (usage is at the top of the
  file).
- Background docs: `docs/TASTE.md` (the site's taste in Lucas's words) and `docs/design/LESSONS.md` (what the
  discarded previews taught).

## What the reviews said (two rounds; critic and fresh eyes, different models, working from screenshots)

**What works**
- The view from above as the abstraction; the valley with its fence.
- Hollow/dashed turning solid.
- One vermilion verb per screen.
- The white models.
- Soap film, liquid metal and the night particles were what a 13-year-old most wanted to play with.

**What the critic still wanted**
- One stage per lesson: the cart, the valley and the top view as one object with one continuous camera, readouts
  living in the world, and no view toggle.
- Strict colour = noun: the wall is one colour everywhere; no yellow highlighter in the lesson body.
- The first step must be obvious: a child knows the glass bead can be dragged, but not why.
- Less empty space on phones.

**The open-source research** pointed to:
- a tutor that answers only through typed "material actions";
- Bret Victor's ladder of abstraction;
- drawing the gap between a guess and the truth;
- hypercorrection for confident misses;
- Evan Wallace's water (rewrite the principle; the code has no licence).

## The challenge, as we understand it

Everything so far is canvas 2D and small hand-written simulations. Lucas thinks you can do much more. A few
directions we did not take; treat them as a menu, not a plan:

1. **Real light on the GPU.** One small WebGPU/WebGL2 renderer (no library) where the beautiful materials are
   physically real and still mean one exact thing:
   - refraction and caustics from one height field (brightness = 1/|det J|);
   - thin-film soap with real interference;
   - plaster with subsurface softness;
   - soft shadows from the one light.
2. **Simulation as the explanation.** Stable fluids or SPH for flow, diffusion and level sets; membranes and cloth
   for minimal surfaces and regression; true rigid bodies for the valley ball. The page computes; it does not
   animate.
3. **The tutor acting in the world, end to end.** The DeepSeek tutor (`packages/ai`, `apps/mathnim/src/side_chat.ts`)
   answers by calling typed actions on the page's own figure (raise water, pull a thread, roll from the guess, turn
   to the top view, trace an outline with light particles), validated on the server.
4. **Lessons that grow.** A wrong guess produces a real new step, generated in the grammar from the learner's own
   ghost.
5. **One continuous stage per lesson,** as the critic asked. The camera move is the ladder of abstraction.
6. **The engine in the library.** The specimen's 2.5D world (one camera, one light, models, shadows, picking on
   surfaces, water) becomes a real module in `packages/manim-web`, so actual lessons can use it.
7. **Spatial.** The same scenes on a desk in WebXR or visionOS.

Pick what you believe is the strongest, show it, and tell Lucas what you would build next.

## The few things that do hold (from AGENTS.md)

- Learner-facing text is bilingual `{ en, zh }`, with natural Chinese.
- One light theme for the site. A dark tray inside a light page, as a material, was accepted.
- No heavy libraries in the browser (no Pyodide, no CasADi). Your own small WebGPU/WebGL code is fine.
- Lucas previews before anything is deployed; never deploy on your own.
- Never print or commit secrets.
- Work on this branch, `design/next-ui`. Show him screenshots or recordings, and say plainly what you did not
  check.
