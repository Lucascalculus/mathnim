// Text pages and bilingual lessons without a DOM: grading a derivation's
// fill-in line, and walking every learner-facing string of a lesson (for the
// lesson doctor, the narration tool and the presenters).
import { is_bilingual, tr, type Block, type DeriveContent, type L10n, type Lang } from './content';
import { grade } from './grading';
import type { CaseGroup, CheckpointStep, Grade, Lesson, Step } from './schema';

/** Grade what the learner typed for a derivation's fill-in line (the expression grader). */
export function grade_blank(d: DeriveContent, text: string, lang: Lang = 'en'): Grade {
  const b = d.blank;
  if (!b) throw new Error('this derivation has no fill-in line');
  return grade({ type: 'expression', answer: b.answer, variables: b.variables, ranges: b.ranges }, { type: 'expression', text }, {}, lang);
}

/** Where a string sits and what it is for. */
export interface LessonString {
  /** e.g. 'steps[3].blocks[2].items[0]' */
  where: string;
  value: L10n;
  /** 'narration' and 'line' are spoken; 'prose' is running text; 'label' is short (titles, options, names). */
  role: 'prose' | 'label' | 'narration' | 'line';
}

function block_strings(b: Block, at: string, out: LessonString[]): void {
  const add = (where: string, value: L10n | undefined, role: LessonString['role'] = 'prose') => value !== undefined && out.push({ where: `${at}.${where}`, value, role });
  switch (b.type) {
    case 'h': return void add('text', b.text, 'label');
    case 'p': return void add('text', b.text);
    case 'list': return b.items.forEach((x, i) => add(`items[${i}]`, x));
    case 'math': return;
    case 'code': return void add('caption', b.caption);
    case 'figure': add('alt', b.alt, 'label'); return void add('caption', b.caption);
    case 'visual': return void add('caption', b.caption);
    case 'callout': add('title', b.title, 'label'); return void add('body', b.body);
    case 'details': add('summary', b.summary, 'label'); return b.blocks.forEach((c, i) => block_strings(c, `${at}.blocks[${i}]`, out));
    case 'table': b.head.forEach((x, i) => add(`head[${i}]`, x, 'label')); return b.rows.forEach((r, i) => r.forEach((x, j) => add(`rows[${i}][${j}]`, x, 'label')));
    case 'cite': return void add('text', b.text, 'label');
  }
}

/** Every learner-facing string of one step. */
export function step_strings(s: Step, at = s.id): LessonString[] {
  const out: LessonString[] = [];
  const add = (where: string, value: L10n | undefined, role: LessonString['role'] = 'prose') => value !== undefined && out.push({ where: `${at}.${where}`, value, role });
  add('chapter', s.chapter, 'label');
  add('title', s.title, 'label');
  add('narration', s.narration, 'narration');
  switch (s.kind) {
    case 'scene': break;
    case 'explore':
      add('prompt', s.prompt);
      add('goal.message', s.goal?.message, 'label');
      s.goals?.forEach((g, i) => add(`goals[${i}].message`, g.message, 'label'));
      s.lines?.forEach((l, i) => add(`lines[${i}].text`, l.text, 'line'));
      s.hints?.forEach((h, i) => add(`hints[${i}]`, h));
      s.actions?.forEach((a, i) => add(`actions[${i}].label`, a.label, 'label'));
      for (const [k, sc] of Object.entries(s.scrub ?? {})) add(`scrub.${k}.label`, sc.label, 'label');
      break;
    case 'checkpoint': {
      add('prompt', s.prompt);
      s.hints?.forEach((h, i) => add(`hints[${i}]`, h));
      add('explain', s.explain);
      const q = s.question;
      if (q.type === 'choice') q.options.forEach((o, i) => {
        add(`options[${i}].label`, o.label, 'label');
        add(`options[${i}].feedback`, o.feedback);
      });
      if (q.type === 'number') add('unit', q.unit, 'label');
      if (q.type === 'number' || q.type === 'expression') (q.wrong as { feedback?: L10n }[] | undefined)?.forEach((w, i) => add(`wrong[${i}].feedback`, w.feedback));
      if (q.type === 'text') {
        q.rubric.key_points.forEach((k, i) => add(`rubric.key_points[${i}]`, k));
        add('rubric.model_answer', q.rubric.model_answer);
        add('placeholder', q.placeholder, 'label');
      }
      if (s.group) {
        add('group.title', s.group.title, 'label');
        s.group.brief?.forEach((b, i) => block_strings(b, `${at}.group.brief[${i}]`, out));
      }
      break;
    }
    case 'read':
      s.blocks.forEach((b, i) => block_strings(b, `${at}.blocks[${i}]`, out));
      break;
    case 'derive':
      add('intro', s.intro);
      s.lines.forEach((l, i) => add(`lines[${i}].why`, l.why));
      add('blank.prompt', s.blank?.prompt);
      add('outro', s.outro);
      break;
    case 'code':
      add('intro', s.intro);
      s.notes.forEach((n, i) => add(`notes[${i}].text`, n.text));
      break;
  }
  return out;
}

/** Every learner-facing string of a lesson (title, skills, misconceptions, character, steps). */
export function lesson_strings(lesson: Lesson): LessonString[] {
  const out: LessonString[] = [];
  out.push({ where: 'title', value: lesson.title, role: 'label' });
  if (lesson.description !== undefined) out.push({ where: 'description', value: lesson.description, role: 'prose' });
  if (lesson.character) out.push({ where: 'character.name', value: lesson.character.name, role: 'label' });
  lesson.skills.forEach((s, i) => out.push({ where: `skills[${i}].name`, value: s.name, role: 'label' }));
  lesson.misconceptions?.forEach((m, i) => out.push({ where: `misconceptions[${i}].description`, value: m.description, role: 'prose' }));
  for (const s of lesson.steps) out.push(...step_strings(s, `steps.${s.id}`));
  return out;
}

/** The languages a lesson is written in: ['en'] for a plain-string lesson, ['en', 'zh'] once it has any { en, zh } text. */
export function lesson_langs(lesson: Lesson): Lang[] {
  return lesson_strings(lesson).some((x) => is_bilingual(x.value)) ? ['en', 'zh'] : ['en'];
}

/** Does the text contain Chinese (Han) characters? */
export const has_cjk = (s: string): boolean => /[㐀-鿿豈-﫿]/.test(s);

/**
 * Steps whose `narration` is spoken: scenes ("videos") and worlds; in a game the
 * character also speaks the questions. Text pages are always read silently, and
 * questions are silent in the essay view.
 */
export const is_voiced = (s: Step, mode: 'essay' | 'game' = 'essay'): boolean => s.kind === 'scene' || s.kind === 'explore' || (s.kind === 'checkpoint' && mode === 'game');

/** The spoken texts of a lesson, as L10n: the narration of voiced steps (in the lesson's own mode) and the triggered lines of worlds. */
export function spoken_strings(lesson: Lesson): L10n[] {
  const out: L10n[] = [];
  for (const s of lesson.steps) {
    if (s.narration !== undefined && is_voiced(s, lesson.mode)) out.push(s.narration);
    if (s.kind === 'explore') for (const l of s.lines ?? []) out.push(l.text);
  }
  return out;
}

/** Spoken lines of a lesson in one language, resolved (still templated with {vars}). */
export function narration_lines(lesson: Lesson, lang: Lang): string[] {
  const out = new Set<string>();
  for (const v of spoken_strings(lesson)) {
    const t = tr(v, lang);
    if (t) out.add(t);
  }
  return [...out];
}

/** Where a checkpoint sits in its case: the case, the question's number (1-based) and how many questions it has. */
export function case_position(lesson: Lesson, index: number): { group: CaseGroup; k: number; n: number } | null {
  const s = lesson.steps[index];
  if (s?.kind !== 'checkpoint' || !s.group) return null;
  const id = s.group.id;
  // the run of consecutive steps of this case (branch-only detours, e.g. reveals, do not break it)
  const same = (x: Step) => x.kind === 'checkpoint' && x.group?.id === id;
  let a = index, b = index;
  for (let i = index - 1; i >= 0; i--) {
    if (same(lesson.steps[i])) a = i;
    else if (!lesson.steps[i].branch_only) break;
  }
  for (let i = index + 1; i < lesson.steps.length; i++) {
    if (same(lesson.steps[i])) b = i;
    else if (!lesson.steps[i].branch_only) break;
  }
  const run = lesson.steps.slice(a, b + 1).filter(same) as CheckpointStep[];
  // title and brief may be given on the first question only
  const group = run.find((x) => x.group?.brief)?.group ?? s.group;
  return { group, k: run.indexOf(s) + 1, n: run.length };
}

/** 1-based line count of a code string (a trailing newline does not add a line). */
export const code_line_count = (code: string): number => code.replace(/\n$/, '').split('\n').length;

/** A text page as plain text (prose with its $TeX$, formulas, code), e.g. for the AI tutor's "on screen". */
export function describe_step(s: Step, lang: Lang): string {
  const out: string[] = [];
  const blocks = (bs: Block[]) => {
    for (const b of bs) {
      switch (b.type) {
        case 'h': out.push(`## ${tr(b.text, lang)}`); break;
        case 'p': out.push(tr(b.text, lang)); break;
        case 'list': out.push(b.items.map((x) => `- ${tr(x, lang)}`).join('\n')); break;
        case 'math': out.push(`$$${b.tex}$$`); break;
        case 'code': out.push(`[code ${b.lang}]\n${b.code}`); break;
        case 'figure': out.push(`[figure: ${tr(b.alt, lang)}]${b.caption ? ` ${tr(b.caption, lang)}` : ''}`); break;
        case 'visual': out.push(`[interactive figure ${b.name}]${b.caption ? ` ${tr(b.caption, lang)}` : ''}`); break;
        case 'callout': out.push(`[${b.kind}] ${b.title ? `${tr(b.title, lang)}: ` : ''}${tr(b.body, lang)}`); break;
        case 'details': out.push(`[details: ${tr(b.summary, lang)}]`); blocks(b.blocks); break;
        case 'table': out.push([b.head, ...b.rows].map((r) => r.map((x) => tr(x, lang)).join(' | ')).join('\n')); break;
        case 'cite': out.push(`[source ${b.key}] ${tr(b.text, lang)}`); break;
      }
    }
  };
  if (s.kind === 'read') blocks(s.blocks);
  else if (s.kind === 'derive') {
    if (s.intro) out.push(tr(s.intro, lang));
    s.lines.forEach((l, i) => out.push(`(${i + 1}) $$${l.tex}$$${l.why ? ` - ${tr(l.why, lang)}` : ''}`));
    if (s.outro) out.push(tr(s.outro, lang));
  } else if (s.kind === 'code') {
    if (s.intro) out.push(tr(s.intro, lang));
    out.push(`[code ${s.lang}]\n${s.code}`);
    for (const n of s.notes) out.push(`lines ${n.lines[0]}-${n.lines[1]}: ${tr(n.text, lang)}${n.shapes ? ` (${n.shapes})` : ''}`);
  } else if (s.kind === 'checkpoint' && s.group?.brief) blocks(s.group.brief);
  return out.join('\n');
}
