// What the model is asked at each step of making a course from uploaded
// slides and practice exams. The teaching rules are docs/TASTE.md and
// docs/COURSE-PLAYBOOK.md boiled down to what a single model call can act on;
// keep them in step when those documents change.
//
// Steps: map (one per slide deck) and exam (all practice exams at once) read
// the PDFs; plan designs the course from those maps (text only); lesson writes
// one lesson (its decks attached); review checks a lesson's coverage and
// quality, and a lesson that fails is written once more with the review.
import { LESSON_FORMAT } from './format';

export type CourseLang = 'zh' | 'en';
const LANG_NAME: Record<CourseLang, string> = { zh: 'Simplified Chinese', en: 'English' };

/** The same for every step of every course (so the start of each request can be cached with the documents). */
export const SYSTEM = `You are the course author of Mathnim, a site of interactive lessons judged by one question: does the learner genuinely understand (讲明白)? A learner who understands can explain the idea to a classmate in their own words and say when they would use it.

Mathnim turns a university course's lecture slides and practice exams into a course of its own. The slides are the floor, not the ceiling: every major knowledge point in them must be taught, but the course should teach it far better than the slides do. You are not bound by the slides' order, wording or examples.

How a Mathnim lesson teaches:
- Purpose first, then intuition, then the mechanism or the math, then the details. Say what a technique is for before how it works. Say what each term of a formula does before deriving or using it.
- Answer "why this and not X?" where a learner would naturally ask it (why this design, what breaks without it, what the alternative costs).
- Never open with a pile of definitions, acronyms or a formula. Details arrive once the learner has somewhere to hang them; otherwise they go into a "details" block or are cut.
- Concrete before abstract: a small worked example, a scenario with real numbers, a picture. Prefer one example that carries through a lesson (and, where the subject allows, through the course) over many disconnected ones.
- Concise means refined, not stripped: one idea per page, short sentences, no filler ("In this lesson we will..."), no restating the slides' bullet lists. Keep what matters and make it good.
- Draw diagrams (svg blocks) where a picture explains better than words: structures, timelines, message sequences, state machines, layouts.
- Questions test understanding and transfer, not recall: predict, apply to a new case, compute, compare, diagnose. A wrong option's feedback names the misconception behind it. A prediction before an idea makes the learner want the answer.
- Honest: no invented facts, numbers, quotes or sources. Numbers come from the slides, from standard well-established values, or from a worked example you compute in the open.
- Going beyond the slides is welcome (a deeper why, how two lectures connect, the history that explains a design, a better example). When something goes beyond what the slides and exams require, say so lightly (a "details" block or a callout titled e.g. "超出课件" / "Beyond the slides"), so the learner knows what the exam needs.
- No instructions about the interface ("click", "scroll", "answer the question below").

Reply with exactly one JSON object and nothing else.`;

const lang_rules = (lang: CourseLang) =>
  lang === 'zh'
    ? `Write every learner-facing string in ${LANG_NAME.zh}, written natively (as a good Chinese teacher would say it, not translated): short sentences, plain spoken words. The course's exams are likely in the slides' language, so give the original technical term in parentheses the first time a term appears, e.g. 拥塞控制 (congestion control).`
    : `Write every learner-facing string in ${LANG_NAME.en}: short sentences, plain words.`;

// ---------------------------------------------------------------- map: one slide deck
export function map_prompt(o: { lang: CourseLang; deck: string }): string {
  return `The attached PDF is one lecture deck of a university course: "${o.deck}".

Map it, so a course can be designed from the maps of all the decks:
- "points": its major knowledge points, at the grain of "backpropagation" or "decision trees", "TCP congestion control" or "sliding window": what a student must be able to explain or do after this lecture. Usually 3-10 per deck; not every bullet. Mark each "core" (central, likely examined) or "minor" (a side remark, an aside, a historical note).
- for each point, the slide pages it is on, and a one-sentence gist of what the slides actually say about it (including any formula or number they give).
- "assumes": what the deck takes for granted.
- "weak_spots": where the slides are thin, confusing, or skip a "why": the places a better lesson should do better.
- "examples": the concrete examples, numbers and figures the slides use.

${lang_rules(o.lang)} (Names of points in that language, with the original term in parentheses.)

Reply as:
{"title": string, "summary": string, "points": [{"key": string (short, lowercase, hyphens), "name": string, "pages": string (e.g. "4-9, 12"), "gist": string, "weight": "core" | "minor"}], "assumes": [string], "weak_spots": [string], "examples": [string]}`;
}

// ---------------------------------------------------------------- exam: every practice exam
export function exam_prompt(o: { lang: CourseLang; files: string[] }): string {
  return `The attached PDFs are practice exams (questions, and possibly solutions) of the same course: ${o.files.map((f) => `"${f}"`).join(', ')}.

List every question (a part of a question that asks something different is its own question). Keep each question's original wording and language; use $...$ for any formula. Give the official answer when a solution is attached ("official": true); otherwise solve it yourself and set "official": false. Name the knowledge points each question tests, in plain words.

Reply as:
{"questions": [{"id": string ("q1", "q2", ...), "source": string (file and question number), "text": string, "kind": "choice" | "numeric" | "short" | "long" | "calculation", "options": [string] (choice only), "answer": string, "official": boolean, "points": [string]}]}`;
}

// ---------------------------------------------------------------- plan: the course
export interface DeckMap {
  file: string;
  name: string;
  title: string;
  summary: string;
  points: { id: string; name: string; pages: string; gist: string; weight: 'core' | 'minor' }[];
  assumes?: string[];
  weak_spots?: string[];
  examples?: string[];
}
export interface ExamQuestion {
  id: string;
  source?: string;
  text: string;
  kind?: string;
  options?: string[];
  answer: string;
  official?: boolean;
  points?: string[];
}

export function plan_prompt(o: { lang: CourseLang; decks: DeckMap[]; questions: ExamQuestion[] }): string {
  const decks = o.decks.map((d, i) => `## Deck ${i + 1} · file "${d.file}" (${d.name}): ${d.title}
${d.summary}
Points:
${d.points.map((p) => `- ${p.id} [${p.weight}] ${p.name} (pages ${p.pages}): ${p.gist}`).join('\n')}${d.weak_spots?.length ? `\nWeak spots: ${d.weak_spots.join(' / ')}` : ''}${d.examples?.length ? `\nExamples used: ${d.examples.join(' / ')}` : ''}`).join('\n\n');
  const qs = o.questions.length ? o.questions.map((q) => `- ${q.id} (${q.kind ?? 'question'}; tests: ${(q.points ?? []).join(', ')}): ${q.text.slice(0, 300)}`).join('\n') : '(no practice exams were uploaded)';
  return `Design a Mathnim course from these lecture decks (in the order the lecturer gave them) and practice-exam questions.

${decks}

# Practice-exam questions
${qs}

Rules:
- By default each deck becomes one lesson. Two or more decks become ONE lesson when they are tightly related (one topic split across lectures, a deck that only continues the previous one). A deck that only reviews earlier decks does not get a lesson of its own: its points are already taught; use it for the practice lesson.
- Every "core" point is taught in exactly one lesson (list its id in that lesson's "points"). "minor" points are taught where they help, or left out if they add nothing. A point may be revisited later, but it belongs to one lesson.
- Order the lessons so each builds on the ones before (usually the lecture order; change it when a prerequisite comes later in the slides).
- Teach better than the slides: for each lesson, write the arc you would use to make it 讲明白 (start from a question or a concrete problem, purpose and intuition before mechanism, a worked example, where a diagram helps, where a learner asks "why not X?"), fixing the weak spots. Add "extras" beyond the slides where they deepen understanding (a connection between lectures, the reason behind a design, a better example).
- Choose a running example or scenario the whole course can come back to, if the subject allows one.
- Group the lessons into 3-7 units: the stops of the course map, each a short title (2-6 words) naming what that stretch is about.
- Assign each exam question to the lesson whose practice it best fits ("exam"), to be adapted as a check there. If there are exam questions, add a final practice lesson ("practice") with the questions as an exam would ask them, each pointing back to the lesson that teaches it.
- ${lang_rules(o.lang)}

Reply as:
{"course": {"title": string, "summary": string (one line: the topics), "audience": string (who it is for, what they should know first), "outcomes": [string, string, string] (what the learner can do afterwards)},
 "running_example": string,
 "units": [{"title": string, "lessons": [lesson id, ...]}],
 "lessons": [{"id": "l1" | "l2" | ..., "title": string, "question": string (the question this lesson answers, as a learner would ask it), "decks": [file, ...], "points": [point id, ...], "extras": [string], "arc": [string, ...] (5-12 lines, one per page or question, in teaching order), "exam": [question id, ...], "minutes": number}],
 "practice": null | {"title": string, "exam": [question id, ...], "minutes": number}}`;
}

// ---------------------------------------------------------------- lesson
export interface PlanLesson {
  id: string;
  title: string;
  question: string;
  decks: string[];
  points: string[];
  extras?: string[];
  arc: string[];
  exam?: string[];
  minutes: number;
}
export interface Plan {
  course: { title: string; summary: string; audience: string; outcomes: string[] };
  running_example?: string;
  /** The stops of the course map: consecutive lessons. */
  units: { title: string; lessons: string[] }[];
  lessons: PlanLesson[];
  practice: null | { title: string; exam: string[]; minutes: number };
}

const course_outline = (plan: Plan, here: string) =>
  plan.lessons.map((l, i) => `${i + 1}. ${l.title}${l.id === here ? '   <- this lesson' : ''}`).join('\n');

export function lesson_prompt(o: {
  lang: CourseLang; plan: Plan; lesson: PlanLesson; points: DeckMap['points']; decks: DeckMap[]; questions: ExamQuestion[];
  revise?: { previous: string; review: string };
}): string {
  const l = o.lesson;
  const n = o.plan.lessons.findIndex((x) => x.id === l.id) + 1;
  const pts = o.points.map((p) => `- ${p.id} [${p.weight}] ${p.name} (slides: pages ${p.pages}): ${p.gist}`).join('\n');
  const decks = o.decks.map((d) => `"${d.file}" (${d.title})${d.weak_spots?.length ? `; weak spots: ${d.weak_spots.join(' / ')}` : ''}`).join('\n');
  const qs = o.questions.length ? o.questions.map((q) => `- ${q.id}: ${q.text}${q.options?.length ? `\n  options: ${q.options.join(' | ')}` : ''}\n  answer${q.official ? ' (official)' : ''}: ${q.answer}`).join('\n') : '(none)';
  const revise = o.revise
    ? `\n\n# Revision
A reviewer checked your previous version of this lesson. Write the lesson again: fix every issue below and teach any point marked thin or missing properly; keep what already works.

Review:
${o.revise.review}

Previous version:
${o.revise.previous}`
    : '';
  return `Write lesson ${n} of the course "${o.plan.course.title}" (${o.plan.course.summary}). It is for: ${o.plan.course.audience}.

The course:
${course_outline(o.plan, l.id)}
${o.plan.running_example ? `\nRunning example of the course: ${o.plan.running_example}\n` : ''}
# This lesson: ${l.title}
The question it answers: ${l.question}
Slides it covers (attached): ${decks}

Knowledge points it must teach (each one is a skill of the lesson; use these ids as the skill ids):
${pts}

Beyond the slides, planned: ${(l.extras ?? []).join(' / ') || '(none)'}

The planned arc (improve it if you see a better way to make it 讲明白):
${l.arc.map((x, i) => `${i + 1}. ${x}`).join('\n')}

Practice-exam questions to adapt as checks in this lesson (change numbers or framing so the learner must think, not recognise):
${qs}

What the lesson must do:
- Teach every point above so a learner could explain it; a "core" point gets real teaching (intuition, mechanism, an example, a question), not a mention. The slides are the minimum: go deeper where it helps understanding, and do not copy their bullets.
- Open with a concrete question, problem or surprise, often a "predict" checkpoint (choice, "auto_advance": true) that the next pages answer.
- Purpose and intuition before mechanism; derivations and calculations as "derive" steps when the steps matter; diagrams as "svg" blocks where a picture explains better than words.
- 3-6 practice/check questions spread through the lesson (not all at the end), including the adapted exam questions; each with "explain"; wrong options' feedback names the misconception.
- Refer back to earlier lessons by name where this one builds on them; do not re-teach them.
- 10-24 steps; step ids short and readable (e.g. "why-window", "check-rtt").
- ${lang_rules(o.lang)} Exam-style questions may keep technical terms in the original language.

${LESSON_FORMAT}${revise}`;
}

export function practice_prompt(o: { lang: CourseLang; plan: Plan; questions: ExamQuestion[]; teaches: Record<string, string>; points: { id: string; name: string }[] }): string {
  const p = o.plan.practice!;
  const qs = o.questions.map((q) => `- ${q.id} (${q.kind ?? 'question'}; ${q.source ?? ''}): ${q.text}${q.options?.length ? `\n  options: ${q.options.join(' | ')}` : ''}\n  answer${q.official ? ' (official)' : ''}: ${q.answer}\n  taught in: ${o.teaches[q.id] ?? '?'}`).join('\n');
  return `Write the practice lesson "${p.title}" of the course "${o.plan.course.title}": the practice-exam questions as an exam would ask them, for a learner who has done the lessons:
${course_outline(o.plan, '')}

Questions:
${qs}

What it must do:
- One checkpoint per question ("purpose": "check"), in an order that warms up first. Keep each question's original wording and language (it is what the exam will look like); a multi-part question may become several checkpoints with the same "chapter".
- Choose the question type that grades it fairly: "choice" for multiple choice, "number" for a single numeric result (with a sensible tolerance and unit), "text" with key points for explanations and derivations.
- "explain": the worked solution in the course language, short and complete, ending with where it is taught ("→ <lesson title>").
- Skills: the knowledge points the questions test, as ids from this list (a wrong answer then brings that point back for review):
${o.points.map((x) => `  ${x.id}: ${x.name}`).join('\n')}
- A short "read" step first: a title and one sentence on what the set covers (no instructions).
- ${lang_rules(o.lang)}

${LESSON_FORMAT}`;
}

// ---------------------------------------------------------------- review
export function review_prompt(o: { lang: CourseLang; lesson: PlanLesson; points: DeckMap['points']; digest: string }): string {
  return `You review a lesson written for Mathnim. Be specific and strict: the bar is that a learner genuinely understands (讲明白), and that the lesson teaches the slides' knowledge points better than the slides do.

The knowledge points this lesson must teach (from the slides):
${o.points.map((p) => `- ${p.id} [${p.weight}] ${p.name} (pages ${p.pages}): ${p.gist}`).join('\n')}

Planned extras: ${(o.lesson.extras ?? []).join(' / ') || '(none)'}

The lesson:
${o.digest}

Check:
1. Coverage: for each point, is it taught (intuition, mechanism, example, and a question touching it), thin (mentioned or explained without making it understood), or missing? Name the step where it is taught.
2. Teaching: purpose and intuition before details? a "why this and not X?" where learners would ask it? a wall of text, a page that opens with definitions, bullet lists copied from slides? a diagram missing where it would explain?
3. Correctness: any wrong fact, wrong answer, wrong formula, an answer key that disagrees with its explanation, a question that cannot be answered from what was taught?
4. Questions: do they test transfer rather than recall? does wrong-answer feedback name the misconception?
5. Writing: ${o.lang === 'zh' ? 'natural native Chinese (not translated), short sentences, original terms in parentheses on first use' : 'plain, short sentences'}; no instructions about the interface.

"verdict" is "revise" when a core point is thin or missing, or there is any major issue (wrong content, a broken question, a page that would confuse); otherwise "ok".

Reply as:
{"points": [{"id": string, "status": "taught" | "thin" | "missing", "where": string (step id or ""), "note": string}],
 "issues": [{"severity": "major" | "minor", "step": string, "problem": string, "fix": string}],
 "strengths": [string],
 "verdict": "ok" | "revise"}`;
}
