// Making a course from uploaded files, one step at a time. The state lives in
// the database (studio_parts: one JSON per finished step), so a course can be
// built over several visits and any step can be run again. The browser asks
// which steps can run (next_steps) and runs them, a few at a time.
//
//   map.<file>      one per slide deck: its knowledge points (reads the PDF)
//   exam            every practice exam: its questions and answers (reads the PDFs)
//   plan            the course: lessons, which points each teaches, their arcs
//   lesson.<id>     one lesson (reads its decks); "lesson.practice" for the exam practice
//   review.<id>     coverage and quality of a lesson; "revise" sends it back once
import type { Lesson } from '@mathnim/core';
import type { BlobStore, SqlDb } from '../db';
import { check_lesson, json_of, lesson_digest } from './format';
import type { StudioDoc, StudioModel, StudioRequest } from './model';
import { exam_prompt, lesson_prompt, map_prompt, plan_prompt, practice_prompt, review_prompt, SYSTEM, type CourseLang, type DeckMap, type ExamQuestion, type Plan, type PlanLesson } from './prompts';

export interface CourseRow {
  id: string;
  owner: string;
  lang: CourseLang;
  title: string;
  public: number;
  created: number;
  updated: number;
}
export interface FileRow {
  id: string;
  course_id: string;
  kind: 'slides' | 'exam';
  name: string;
  type: string;
  size: number;
  blob: string;
  remote: string | null;
  created: number;
}
export interface LessonPart {
  rev: number;
  lesson: Lesson;
}
export interface ReviewPart {
  rev: number;
  verdict: 'ok' | 'revise';
  points: { id: string; status: 'taught' | 'thin' | 'missing'; where: string; note: string }[];
  issues: { severity: 'major' | 'minor'; step: string; problem: string; fix: string }[];
  strengths: string[];
}
export interface State {
  course: CourseRow;
  files: FileRow[];
  parts: Map<string, unknown>;
}
/** Revisions a lesson may get after its review asks for one. */
export const MAX_REV = 2;

const by_name = (a: FileRow, b: FileRow) => a.name.localeCompare(b.name, 'en', { numeric: true }) || a.created - b.created;
export const slides_of = (s: State) => s.files.filter((f) => f.kind === 'slides').sort(by_name);
export const exams_of = (s: State) => s.files.filter((f) => f.kind === 'exam').sort(by_name);
export const lesson_id = (course: string, lid: string) => `${course}-${lid}`;

export async function load_state(db: SqlDb, course_id: string): Promise<State | null> {
  const course = await db.prepare('SELECT * FROM studio_courses WHERE id = ?').bind(course_id).first<CourseRow>();
  if (!course) return null;
  const files = (await db.prepare('SELECT * FROM studio_files WHERE course_id = ?').bind(course_id).all<FileRow>()).results;
  const rows = (await db.prepare('SELECT key, json FROM studio_parts WHERE course_id = ?').bind(course_id).all<{ key: string; json: string }>()).results;
  const parts = new Map<string, unknown>();
  for (const r of rows) {
    try {
      parts.set(r.key, JSON.parse(r.json));
    } catch {
      /* a damaged part is made again */
    }
  }
  return { course, files, parts };
}
export async function save_part(db: SqlDb, s: State, key: string, value: unknown): Promise<void> {
  const now = Date.now();
  await db.prepare('INSERT INTO studio_parts (course_id, key, json, t) VALUES (?, ?, ?, ?) ON CONFLICT(course_id, key) DO UPDATE SET json = excluded.json, t = excluded.t').bind(s.course.id, key, JSON.stringify(value), now).run();
  await db.prepare('UPDATE studio_courses SET updated = ? WHERE id = ?').bind(now, s.course.id).run();
  s.parts.set(key, value);
}
/** After the files change: what was made from them is made again (the maps of unchanged decks are kept). */
export async function drop_derived(db: SqlDb, course_id: string, o: { exam: boolean; file?: string }): Promise<void> {
  await db.prepare("DELETE FROM studio_parts WHERE course_id = ? AND (key = 'plan' OR key LIKE 'lesson.%' OR key LIKE 'review.%')").bind(course_id).run();
  if (o.exam) await db.prepare("DELETE FROM studio_parts WHERE course_id = ? AND key = 'exam'").bind(course_id).run();
  if (o.file) await db.prepare('DELETE FROM studio_parts WHERE course_id = ? AND key = ?').bind(course_id, `map.${o.file}`).run();
}

const plan_of = (s: State) => s.parts.get('plan') as Plan | undefined;
const lesson_of = (s: State, lid: string) => s.parts.get(`lesson.${lid}`) as LessonPart | undefined;
const review_of = (s: State, lid: string) => s.parts.get(`review.${lid}`) as ReviewPart | undefined;

/** Is this lesson finished (written, reviewed, and revised if the review asked and revisions are left)? */
export function lesson_final(s: State, lid: string): boolean {
  const l = lesson_of(s, lid);
  if (!l) return false;
  if (lid === 'practice') return true;
  const r = review_of(s, lid);
  return !!r && r.rev >= l.rev && (r.verdict === 'ok' || l.rev >= MAX_REV);
}

/** The steps that can run now. */
export function next_steps(s: State): string[] {
  const out: string[] = [];
  for (const f of slides_of(s)) if (!s.parts.has(`map.${f.id}`)) out.push(`map.${f.id}`);
  if (exams_of(s).length && !s.parts.has('exam')) out.push('exam');
  if (out.length || !slides_of(s).length) return out;
  const plan = plan_of(s);
  if (!plan) return ['plan'];
  for (const l of plan.lessons) {
    const les = lesson_of(s, l.id), rev = review_of(s, l.id);
    if (!les) out.push(`lesson.${l.id}`);
    else if (!rev || rev.rev < les.rev) out.push(`review.${l.id}`);
    else if (rev.verdict === 'revise' && les.rev < MAX_REV) out.push(`lesson.${l.id}`);
  }
  if (plan.practice && s.parts.has('exam') && !s.parts.has('lesson.practice')) out.push('lesson.practice');
  return out;
}
/** Every lesson of the plan finished? */
export function course_ready(s: State): boolean {
  const plan = plan_of(s);
  return !!plan && plan.lessons.every((l) => lesson_final(s, l.id)) && (!plan.practice || !s.parts.has('exam') || lesson_final(s, 'practice'));
}

// ---------------------------------------------------------------- running a step
export class StepFailed extends Error {}
export interface RunDeps {
  model: StudioModel;
  files: BlobStore;
  /** Where a blob is on disk (dev), for models that read files themselves. */
  blob_path?: (key: string) => string;
  signal?: AbortSignal;
  on_progress?: (chars: number) => void;
}

const doc = (f: FileRow, d: RunDeps): StudioDoc => ({
  id: f.id,
  name: f.name,
  type: f.type,
  path: d.blob_path?.(f.blob),
  bytes: async () => {
    const o = await d.files.get(f.blob);
    if (!o) throw new StepFailed(`The file ${f.name} is missing from storage.`);
    return o.arrayBuffer();
  },
});

/** Ask, check the reply, and if it does not pass, ask once more with the problems listed. */
async function ask<T>(req: StudioRequest, d: RunDeps, check: (data: unknown) => { value: T | null; errors: string[] }): Promise<T> {
  const attempt = async (r: StudioRequest) => {
    const text = await d.model.run(r, { signal: d.signal, on_progress: d.on_progress });
    let data: unknown;
    try {
      data = json_of(text);
    } catch (e) {
      return { text, value: null, errors: [`the reply is not valid JSON (${(e as Error).message})`] };
    }
    return { text, ...check(data) };
  };
  const first = await attempt(req);
  if (first.value && !first.errors.length) return first.value;
  const fix = await attempt({
    ...req,
    step: `${req.step}.fix`,
    prompt: `${req.prompt}\n\n# Your previous reply did not pass these checks\n${first.errors.map((e) => `- ${e}`).join('\n')}\n\nYour previous reply:\n${first.text.slice(0, 200_000)}\n\nReply again with the whole corrected JSON object.`,
  });
  if (fix.value && !fix.errors.length) return fix.value;
  throw new StepFailed(`The reply did not pass the checks: ${fix.errors.slice(0, 5).join('; ')}`);
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text_of = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strings = (v: unknown) => (Array.isArray(v) ? v.map(text_of).filter(Boolean) : []);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'point';

export function check_map(data: unknown, f: FileRow): { value: DeckMap | null; errors: string[] } {
  if (!obj(data) || !Array.isArray(data.points) || !data.points.length) return { value: null, errors: ['"points": a non-empty array is required'] };
  const errors: string[] = [];
  const seen = new Set<string>();
  const points: DeckMap['points'] = [];
  data.points.forEach((p, i) => {
    if (!obj(p) || !text_of(p.name)) return void errors.push(`points[${i}]: a name is required`);
    let key = slug(text_of(p.key) || text_of(p.name));
    while (seen.has(key)) key += '-2';
    seen.add(key);
    points.push({ id: `${f.id}.${key}`, name: text_of(p.name), pages: text_of(p.pages) || String(p.pages ?? ''), gist: text_of(p.gist), weight: p.weight === 'minor' ? 'minor' : 'core' });
  });
  return {
    value: errors.length ? null : { file: f.id, name: f.name, title: text_of(data.title) || f.name, summary: text_of(data.summary), points, assumes: strings(data.assumes), weak_spots: strings(data.weak_spots), examples: strings(data.examples) },
    errors,
  };
}

export function check_exam(data: unknown): { value: { questions: ExamQuestion[] } | null; errors: string[] } {
  if (!obj(data) || !Array.isArray(data.questions)) return { value: null, errors: ['"questions": an array is required'] };
  const questions: ExamQuestion[] = [];
  for (const q of data.questions) {
    if (!obj(q) || !text_of(q.text)) continue;
    questions.push({
      id: `q${questions.length + 1}`,
      source: text_of(q.source),
      text: text_of(q.text),
      kind: text_of(q.kind) || undefined,
      options: strings(q.options).length ? strings(q.options) : undefined,
      answer: text_of(q.answer),
      official: q.official === true,
      points: strings(q.points),
    });
  }
  return questions.length ? { value: { questions }, errors: [] } : { value: null, errors: ['no questions found'] };
}

export function check_plan(data: unknown, s: State): { value: Plan | null; errors: string[] } {
  const errors: string[] = [];
  if (!obj(data) || !obj(data.course) || !Array.isArray(data.lessons) || !data.lessons.length) return { value: null, errors: ['"course" and a non-empty "lessons" array are required'] };
  const maps = slides_of(s).map((f) => s.parts.get(`map.${f.id}`) as DeckMap);
  const point_ids = new Set(maps.flatMap((m) => m.points.map((p) => p.id)));
  const deck_ids = new Set(maps.map((m) => m.file));
  const q_ids = new Set(((s.parts.get('exam') as { questions: ExamQuestion[] } | undefined)?.questions ?? []).map((q) => q.id));
  const lessons: PlanLesson[] = [];
  const owner = new Map<string, string>();
  const renamed = new Map<string, string>();
  data.lessons.forEach((l, i) => {
    if (!obj(l) || !text_of(l.title)) return void errors.push(`lessons[${i}]: a title is required`);
    const id = `l${i + 1}`; // numbered by the server: the model's ids only have to be consistent within its reply
    renamed.set(text_of(l.id) || id, id);
    const points = strings(l.points).filter((p) => point_ids.has(p));
    for (const p of points) if (!owner.has(p)) owner.set(p, id);
    lessons.push({
      id,
      title: text_of(l.title),
      question: text_of(l.question),
      decks: strings(l.decks).filter((x) => deck_ids.has(x)),
      points: points.filter((p) => owner.get(p) === id),
      extras: strings(l.extras),
      arc: strings(l.arc),
      exam: strings(l.exam).filter((q) => q_ids.has(q)),
      minutes: typeof l.minutes === 'number' && l.minutes > 0 ? Math.min(90, Math.round(l.minutes)) : 25,
    });
  });
  const missing = maps.flatMap((m) => m.points.filter((p) => p.weight === 'core' && !owner.has(p.id)).map((p) => `${p.id} (${p.name})`));
  if (missing.length) errors.push(`these core points are in no lesson's "points": ${missing.join(', ')}`);
  // one deck, one lesson (decks may be merged, never split)
  const deck_lessons = new Map<string, string[]>();
  for (const l of lessons) for (const dk of l.decks) deck_lessons.set(dk, [...(deck_lessons.get(dk) ?? []), l.title]);
  for (const [dk, ls] of deck_lessons) if (ls.length > 1) errors.push(`deck ${dk} is split across lessons (${ls.join(' / ')}): a deck belongs to one lesson`);
  for (const l of lessons) {
    if (!l.decks.length) errors.push(`lesson "${l.title}": "decks" must name at least one deck file id (${[...deck_ids].join(', ')})`);
    if (!l.arc.length) errors.push(`lesson "${l.title}": an "arc" is required`);
  }
  // units: consecutive runs of lessons; a lesson left out joins the unit before it (or starts the first)
  const units: Plan['units'] = [];
  const unit_of = new Map<string, number>();
  (Array.isArray(data.units) ? data.units : []).filter(obj).forEach((u) => {
    const ids = strings(u.lessons).map((x) => renamed.get(x)).filter((x): x is string => !!x && !unit_of.has(x));
    if (!text_of(u.title) || !ids.length) return;
    ids.forEach((x) => unit_of.set(x, units.length));
    units.push({ title: text_of(u.title), lessons: [] });
  });
  let at = 0;
  for (const l of lessons) {
    at = Math.max(at, unit_of.get(l.id) ?? at);
    if (!units.length) units.push({ title: text_of(obj(data.course) ? data.course.title : '') || 'Lessons', lessons: [] });
    units[Math.min(at, units.length - 1)].lessons.push(l.id);
  }
  const c = data.course;
  const pr = obj(data.practice) ? data.practice : null;
  const plan: Plan = {
    course: { title: text_of(c.title) || s.course.title || 'Course', summary: text_of(c.summary), audience: text_of(c.audience), outcomes: strings(c.outcomes).slice(0, 4) },
    running_example: text_of(data.running_example) || undefined,
    units: units.filter((u) => u.lessons.length),
    lessons,
    practice: pr && q_ids.size ? { title: text_of(pr.title) || 'Practice', exam: strings(pr.exam).filter((q) => q_ids.has(q)), minutes: typeof pr.minutes === 'number' ? Math.round(pr.minutes) : 30 } : null,
  };
  if (plan.practice && !plan.practice.exam.length) plan.practice.exam = [...q_ids];
  return { value: errors.length ? null : plan, errors };
}

export function check_review(data: unknown, rev: number): { value: ReviewPart | null; errors: string[] } {
  if (!obj(data) || !Array.isArray(data.points) || (data.verdict !== 'ok' && data.verdict !== 'revise')) return { value: null, errors: ['"points" and "verdict" ("ok" or "revise") are required'] };
  const status = (v: unknown) => (v === 'thin' || v === 'missing' ? v : 'taught');
  return {
    value: {
      rev,
      verdict: data.verdict,
      points: data.points.filter(obj).map((p) => ({ id: text_of(p.id), status: status(p.status), where: text_of(p.where), note: text_of(p.note) })),
      issues: (Array.isArray(data.issues) ? data.issues : []).filter(obj).map((x) => ({ severity: x.severity === 'major' ? 'major' : 'minor', step: text_of(x.step), problem: text_of(x.problem), fix: text_of(x.fix) })),
      strengths: strings(data.strengths),
    },
    errors: [],
  };
}

/** Run one step and store what it made. */
export async function run_step(db: SqlDb, s: State, key: string, d: RunDeps): Promise<void> {
  if (!next_steps(s).includes(key)) throw new StepFailed(`The step ${key} cannot run now.`);
  const lang = s.course.lang;
  const base = { course: s.course.id, system: SYSTEM };
  const [kind, arg] = [key.split('.')[0], key.slice(key.indexOf('.') + 1)];
  if (kind === 'map') {
    const f = s.files.find((x) => x.id === arg)!;
    const map = await ask({ ...base, step: key, docs: [doc(f, d)], prompt: map_prompt({ lang, deck: f.name }), effort: 'medium', max_tokens: 16_000 }, d, (x) => check_map(x, f));
    return save_part(db, s, key, map);
  }
  if (kind === 'exam') {
    const files = exams_of(s);
    const exam = await ask({ ...base, step: key, docs: files.map((f) => doc(f, d)), prompt: exam_prompt({ lang, files: files.map((f) => f.name) }), effort: 'medium', max_tokens: 32_000 }, d, check_exam);
    return save_part(db, s, key, exam);
  }
  const maps = slides_of(s).map((f) => s.parts.get(`map.${f.id}`) as DeckMap);
  const questions = (s.parts.get('exam') as { questions: ExamQuestion[] } | undefined)?.questions ?? [];
  if (kind === 'plan') {
    const plan = await ask({ ...base, step: key, docs: [], prompt: plan_prompt({ lang, decks: maps, questions }), effort: 'high', max_tokens: 32_000 }, d, (x) => check_plan(x, s));
    await db.prepare('UPDATE studio_courses SET title = ? WHERE id = ?').bind(plan.course.title, s.course.id).run();
    s.course.title = plan.course.title;
    return save_part(db, s, key, plan);
  }
  const plan = plan_of(s)!;
  const points = maps.flatMap((m) => m.points);
  if (kind === 'lesson' && arg === 'practice') {
    const teaches: Record<string, string> = {};
    for (const l of plan.lessons) for (const q of l.exam ?? []) teaches[q] ??= l.title;
    const qs = questions.filter((q) => plan.practice!.exam.includes(q.id));
    const allowed = points.map((p) => ({ id: p.id, name: p.name }));
    const lesson = await ask(
      { ...base, step: key, docs: [], prompt: practice_prompt({ lang, plan, questions: qs, teaches, points: allowed }), effort: 'high', max_tokens: 64_000 },
      d,
      (x) => to_value(check_lesson(x, { id: lesson_id(s.course.id, 'practice'), skills: allowed.map((p) => p.id) })),
    );
    return save_part(db, s, key, { rev: 1, lesson } satisfies LessonPart);
  }
  const pl = plan.lessons.find((l) => l.id === arg);
  if (!pl) throw new StepFailed(`No lesson ${arg} in the plan.`);
  const mine = points.filter((p) => pl.points.includes(p.id));
  if (kind === 'lesson') {
    const prev = lesson_of(s, pl.id), review = review_of(s, pl.id);
    const rev = prev ? prev.rev + 1 : 1;
    const decks = maps.filter((m) => pl.decks.includes(m.file));
    const files = s.files.filter((f) => pl.decks.includes(f.id)).sort(by_name);
    const revise = prev && review ? { previous: JSON.stringify(prev.lesson), review: JSON.stringify({ points: review.points, issues: review.issues }) } : undefined;
    const lesson = await ask(
      {
        ...base,
        step: rev > 1 ? `${key}.r${rev}` : key,
        docs: files.map((f) => doc(f, d)),
        prompt: lesson_prompt({ lang, plan, lesson: pl, points: mine, decks, questions: questions.filter((q) => pl.exam?.includes(q.id)), revise }),
        effort: 'high',
        max_tokens: 64_000,
      },
      d,
      (x) => to_value(check_lesson(x, { id: lesson_id(s.course.id, pl.id), skills: pl.points })),
    );
    // the skills are named as the map names them (one name per point across the course)
    lesson.skills = lesson.skills.map((k) => ({ ...k, name: mine.find((p) => p.id === k.id)?.name ?? k.name }));
    return save_part(db, s, key, { rev, lesson } satisfies LessonPart);
  }
  if (kind === 'review') {
    const les = lesson_of(s, pl.id)!;
    const review = await ask(
      { ...base, step: les.rev > 1 ? `${key}.r${les.rev}` : key, docs: [], prompt: review_prompt({ lang, lesson: pl, points: mine, digest: lesson_digest(les.lesson) }), effort: 'medium', max_tokens: 16_000 },
      d,
      (x) => check_review(x, les.rev),
    );
    return save_part(db, s, key, review);
  }
  throw new StepFailed(`Unknown step ${key}.`);
}
const to_value = (c: ReturnType<typeof check_lesson>) => ({ value: c.lesson, errors: c.errors });

// ---------------------------------------------------------------- what the pages show
/** Each knowledge point of the slides: where it is taught and how well (the review's word, else "planned"). */
export function coverage(s: State) {
  const plan = plan_of(s);
  return slides_of(s).flatMap((f) => {
    const m = s.parts.get(`map.${f.id}`) as DeckMap | undefined;
    return (m?.points ?? []).map((p) => {
      const l = plan?.lessons.find((x) => x.points.includes(p.id));
      const r = l ? review_of(s, l.id) : undefined;
      const seen = r?.points.find((x) => x.id === p.id);
      return { id: p.id, name: p.name, deck: f.name, pages: p.pages, weight: p.weight, lesson: l?.id ?? null, status: seen?.status ?? (l ? 'planned' : 'unplanned'), note: seen?.note ?? '' };
    });
  });
}

/** A course as the site lists it: its finished lessons, as data for the course page and the learner model. */
export function catalog_entry(s: State, me: string | null) {
  const plan = plan_of(s);
  if (!plan) return null;
  const ids = [...plan.lessons.map((l) => l.id), ...(plan.practice ? ['practice'] : [])];
  const lessons = ids.filter((lid) => lesson_final(s, lid)).map((lid) => {
    const l = lesson_of(s, lid)!.lesson;
    const pl = plan.lessons.find((x) => x.id === lid);
    return {
      id: l.id,
      title: l.title,
      summary: pl?.question || l.description || '',
      minutes: pl?.minutes ?? plan.practice?.minutes ?? 30,
      meta: { title: l.title, mode: 'essay' as const, langs: [s.course.lang], has_scene: false, kinds: [...new Set(l.steps.map((x) => x.kind))], skills: l.skills, checkpoints: l.steps.filter((x) => x.kind === 'checkpoint').length },
    };
  });
  const shown = new Set(lessons.map((l) => l.id));
  const units = [
    ...plan.units.map((u) => ({ title: u.title, lessons: u.lessons.map((lid) => lesson_id(s.course.id, lid)).filter((x) => shown.has(x)) })),
    ...(plan.practice && shown.has(lesson_id(s.course.id, 'practice')) ? [{ title: plan.practice.title, lessons: [lesson_id(s.course.id, 'practice')] }] : []),
  ].filter((u) => u.lessons.length);
  return {
    id: s.course.id,
    title: plan.course.title,
    summary: plan.course.summary,
    audience: plan.course.audience,
    outcomes: plan.course.outcomes,
    lang: s.course.lang,
    mine: s.course.owner === me,
    public: !!s.course.public,
    ready: course_ready(s),
    units,
    lessons,
  };
}
