# Taste

How Mathnim should feel, in the owner's (Lucas's) words where possible. Read
this before designing a lesson, a page or a piece of UI. These are judgments,
not rules to tick: when two pull against each other, ask which one serves the
learner understanding, and when unsure, show Lucas two options rather than
guessing.

## 1. 讲明白 is the only criterion

A lesson is good if the learner genuinely understands: they could explain the
idea to a colleague in their own words and say when they would use it.

- **Purpose first, then intuition, then math, then details.** Say what a
  technique is for before how it works; give the high-level picture before
  the formula, and say what each term of a formula does before deriving it.
- **Answer "why this and not X?"** where a learner would naturally ask it.
- **Don't open with a pile of details** (definitions, configs, a formula).
  Details arrive once the learner has somewhere to hang them; otherwise they
  go into a `details` block or are cut.
- These are examples, not a checklist. "我举这些例子不代表你每个部分都要加进去，
  根据'讲明白'这个唯一的验收标准自己斟酌."

## 2. 简洁是精炼 (concise means refined, not stripped)

- Keep what matters and make it good; don't delete everything. "不是说要把
  所有东西都精简掉." "是要有创意，而不是复杂."
- Remove features that don't serve learning. The dashboard (学习记录) was
  deleted because each course's map already shows progress; 复习 left the top
  bar and appears on a course page only when questions are due.
- One idea per screen. Fewer controls, each doing real work.
- Product logic must stay simple: "你这个产品逻辑太复杂了" was said about a
  flow with too many states, not about the visuals.

## 3. No instructional copy

Never write sentences that tell the learner what to do ("读到哪儿冒出疑问，就在
这儿问。", "点一下就问 · 或直接打字"). Guide with the thing itself:
- a suggested question is the invitation to ask;
- a mark appears where an action is possible;
- motion shows where something went (a note folding into the margin, the page
  gliding to the next lesson).

Labels and short descriptions under a setting are fine; explanations of how to
use the interface are not.

## 4. Interaction only when the action is the concept

"不要为了交互而交互." "不要为了用 mathnim 库而用." Choose the simplest form that
teaches the idea: often a static figure, a table or a single handle. A world
must earn its place (prediction before acting, the learner moves the cause,
goals that random dragging won't reach, specific feedback). The full bar:
`docs/lessons/llm-finetuning/INTERACTION-BAR.md`.

## 5. Visual language

- **One light theme everywhere.** Never a dark or black lesson theme ("3b1b
  style" means the kind of explanation, not black backgrounds). No dark-mode
  toggle.
- **Fancy, yet 高级 and 简洁.** Distinctive, not generic: the gradient-pill
  "AI bar" was rejected as overused ("这个 AI bar style 被用得太多了"). So were
  cheesy Chinese "AI style" glows and robot imagery. Technical feel comes from
  precision (a dot grid, crop marks, a small monospaced label), not from glow.
- What exists and works:
  - the **course map** as a level route (checks, a pulsing next stop, a crown
    you can drag and wear);
  - the **moving cover** (the course's signature animation plays once);
  - the **margin conversation** drawn as an engineering sheet ("ASK · 01"),
    answers in a serif voice;
  - **highlighters**: each question gets its own colour; a selected sentence
    is highlighted in the text and in its note in the same colour.
- Type: the interface is sans; the tutor's voice (answers, notes) is serif.
  Sizes in one panel must match (a select box larger than the inputs was
  called ugly).
- Alignment matters: rows share one grid; icons are optically centred (an
  off-centre gear was noticed immediately).

## 6. Motion

- Motion explains or rewards; it is short (0.2–0.9 s), springy where it is a
  response to the learner, and always skipped for `prefers-reduced-motion`.
- Good examples: a stop on the map pops and the route runs on when it is
  cleared; the language pill slides, then the page softens out and rises in
  the new language; the crown wiggles once when a course page opens.
- Avoid motion that loops forever without meaning (a wave that "breathes" at
  rest was dropped: it read like a spell-check squiggle).

## 7. Feedback is human, not gamified

No points, badges, streaks or leaderboards ("游戏式奖励太土了"). Positive
feedback comes from visual logic and human nature: your question stays as a
note on the page, the map lights up, the next lesson is waiting. The course
map's crown is the one sanctioned game touch, and it is a toy, not a score. Do
not show numbers that read as a failing grade (a "mastery 18%" after finishing
a lesson was removed).

## 8. Friction

The first lesson of a course has almost none: one click on a choice, the
explanation appears, the first page fades in. Choices answer on one click (no
separate submit). Ask before adding any step, confirmation or setting.

## 9. Writing

- Bilingual: every learner-facing string is `{ en, zh }`, and the Chinese is
  written natively, not translated. Short sentences. Natural spoken Chinese for
  small touches ("网络断掉了诶").
- Titles everywhere: a step never shows its id (an untitled question shows
  "练一练 n").
- Honest numbers: every factual claim has a source in the course's research
  notes; simulations are marked as simulations; no invented measurements.
- One sentence where a list would do: "适合…" and "需要…" became one sentence
  on the course page.

## 10. Narration

Only "videos" (scene steps, and short world lines while the eyes are on the
canvas) are narrated. Text pages and questions are read silently. Voices:
edge-tts `en-US-AndrewMultilingualNeural` and `zh-CN-YunxiNeural`; never the
browser's own voice.

## 11. Weight and speed

- No heavy libraries in the web app: no CasADi, no Python runtime (Pyodide).
  Small solvers (OSQP as WASM/JS) only if truly needed; prefer a small TS
  implementation or data computed at build time.
- Lessons load on demand; heavy assets (the Chinese canvas font) load only
  when a page draws with them.
- AI answers start streaming fast (the latency bar is about 8 seconds to a
  useful answer); text first, a ready-made visual only when it explains better.

## 12. How Lucas likes to work

- When asked to **discuss**, discuss: options with trade-offs and a
  recommendation, no implementation ("不要 implement"). When given freedom
  ("你允许自己优化任何设计"), act like a product manager and decide.
- For visual choices, build **real variants side by side** to compare (A/B,
  four looks) rather than describing them; delete the losers afterwards.
- **Preview before deploy** unless told to deploy. Report what changed in
  plain words, with screenshots.
- Fewer, better: if a feature looks useless (学习记录, 复习 as a tab), say so and
  propose to cut or fold it.
