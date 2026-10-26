# Site structure (decided with the user, 2026-10-10)

The user compared four home-page layouts and chose a mix: B ("my learning"
home) plus D (an outline beside the lesson), with every course getting its own
landing page. Three levels:

| Level | URL | Job |
|---|---|---|
| Home | `/` | Get back to learning, pick a course |
| Course page | `/<course-slug>` e.g. `/llm-finetuning`, `/geometry` | What this course is, how it's laid out, where I am in it |
| Lesson | `/<course-slug>/<lesson-id>` | Learn, without distractions |
| Lab | `/<course-slug>/labs/<lab-id>` | Read a hands-on tutorial |
| Other pages | `/review`, `/dashboard`, `/settings` | As before |

Routing uses real paths (history API). Cloudflare Pages serves `index.html` for
unknown paths because there is no `404.html`. Old hash links (`#/`,
`#/lesson/<id>`, `#/review`...) redirect to the new paths. Because pages now live
at nested paths, every asset reference must be absolute (`/thumbs/`,
`/narration/`, `/ft/`, `/fonts/`, figure `src`).

## Home (`/`)

- **Continue learning** (shown only for courses the learner has started):
  - the course studied most recently gets one large card: course title, "第 2/20 课", the current lesson's thumbnail, and a Continue button that opens that lesson directly;
  - other started courses each get one row with their own Continue;
  - when reviews are due, a row "待复习 3 题 · 开始".
- **All courses:** one card per course with cover, title, one-line summary, "20 节课 · 约 10 小时", and progress. The card opens the course page.
  - Once there are more than 6 courses, add filter chips (高中 / 大学 / AI 工程).
- **First visit** (nothing started): one line of introduction, then the course cards, with a featured course first.
- **Removed from home:** the big headline, the skill and answer stats, the Practice button, and "随便问". The ask panel lives in lessons; course pages may get one later.

## Course page (`/<slug>`)

One template for every course, with modules switched on per course in `course.ts`. One light theme for all. Each course may have its own cover and one accent colour.

- **Header:** "‹ 全部课程", title, summary, audience, "N 节课 · 约 X 小时 · 中 / EN", and one primary button "开始 / 继续：<lesson>" with progress "已学 k / N". A feature visual sits beside it (optional; for the LLM course, a prerendered decision map).
- **"学完你能"** (optional): 3 outcomes.
- **Units:** each unit is a section of lesson cards. A card shows the thumbnail, title, minutes, the kinds of steps it has, an optional tag, and its status (✓ finished / ● in progress / ○ not started).
- **"动手实验"** (optional): lab cards that open lab pages.

## Lesson (`/<slug>/<lesson-id>`)

- Breadcrumb "<course title> /" above the lesson title, linking to the course page.
- **Course outline drawer** (D):
  - lists the course's units and lessons, with the current lesson's steps nested under it, so learners can see and jump to where they are;
  - default open on wide screens (≥ 1280 px), collapsed otherwise; remembers the learner's choice;
  - replaces the row of tiny step icons on desktop.
- A progress line "第 5 / 17 步 · <chapter>" and a thin progress bar.
- At the end, the primary button is "下一课：<title>", and the secondary one goes back to the course page.
- Resume where the learner left off, with a "从头开始" link.
- "导出 MP4" moves into a "⋯" menu.
- The mastery panel stays hidden until the learner has answered something in this lesson, then shows only the skills touched here.
- **Not doing:** a goal checklist in worlds (the user declined it).

## Labs

The tutorials in `docs/lessons/llm-finetuning/labs/*.md` each have `## 中文` and `## English` sections, plus code in `labs/code/`. They are rendered as site pages in the learner's language, with copyable code blocks and the code files viewable and downloadable.

## Mobile (< 700 px)

- Top bar: logo and language.
- Bottom tab bar: 首页, 复习, 学习记录, 设置. It is hidden inside lessons, where the outline is an overlay.

## Decisions after phase 1 (2026-10-10)

- **"这里没懂" is a side chat**, like Claude Code's side chat:
  - help opens in a side panel next to the lesson; it never navigates away or loses the reading position;
  - follow-ups continue in the same thread;
  - the answer is text first. A picture appears only when it explains better than words; the visual planner may return none;
  - on phones it is a bottom sheet;
  - it replaces the separate ask box at the bottom of the lesson.
- **Superseded 2026-10-26: questions are margin notes** (apps/mathnim/src/side_chat.ts):
  - on a text page the side column is the page's margin. Hovering a paragraph shows a pen mark beside it, and a click starts a note there;
  - the top of the margin follows the scroll. It holds two questions the model writes for each page (one shared, cached request) and a ruled line to write on. A question asked there becomes a note beside the paragraph being read;
  - notes are numbered, with a matching superscript at the end of the paragraph. They can be folded to one line and reopened to go on asking, and they are kept per lesson in the browser;
  - while the tutor is writing, a light runs along the note's line (a breathing-wave variant was tried and dropped);
  - on scene and question steps the notes sit under the step's panel; question steps get no suggested questions;
  - on phones the line sits at the bottom of the screen and notes sit under their paragraph;
  - a text page's 继续 sits at the end of the page;
  - no instructional copy: the mark, the questions and the line are the guidance.
- **2026-10-27, the margin and the top bar:**
  - the top of the margin holds the step's conversations, drawn as an engineering sheet: "ASK · 01" folds it; "+ 02" starts the next and puts the earlier ones away to one line each; a click on one opens it again;
  - each question is marked with a highlighter, a different colour each time; a sentence selected and asked about ("问这句") becomes a note beside its paragraph, highlighted in the text and the note in the same colour;
  - the top bar is the logo, the language and a gear; settings drop from the gear and apply at once; there is no tab bar on phones;
  - 学习记录 (the dashboard) is gone: progress shows on each course page's map. 复习 left the top bar: a course page shows "待复习 n 题 →" under the map when questions of that course are due;
  - no dark interface and no browser voice (one light theme; recorded narration only).
- **Course page prerequisites:** one or two lines of prerequisites, which expand to a short list of starter links. No self-test.
- **Not now:** splitting the math course into geometry and linear algebra.
- **Learner-facing cleanup:**
  - hide the AI provider label from the top bar (it stays in settings);
  - hide the "平台演示" unit;
  - keep AI-generated (not hand-made) lessons out of the course pages for now;
  - unit titles are not upper-cased, and drop the "微调" prefix inside the course page;
  - no "引导课" tag on lesson cards inside a course;
  - write step kinds in words, or don't show them;
  - lessons without a scene get the page-style thumbnail.
