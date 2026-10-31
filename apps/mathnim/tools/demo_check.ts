// Check a demo course (public/demo/<id>/, listed in public/demo/courses.json) before it is published: every lesson,
// in each of its languages, against the generated-lesson format (server/studio/format.ts, as the model's replies are
// checked), and the bilingual text, markup and TeX (text_lint.ts, as the doctor checks the hand-made lessons); the
// catalog entry's lessons and units must match the files. Blocks a model does not write (interactive figures,
// questions in the page) are checked by the text lint, then left out of the format check.
//   node tools/demo_check.mjs <course-id>
import { grade_blank, is_bilingual, type DeriveStep, type L10n, type Lesson } from '@mathnim/core';
import { tex_to_svg } from 'manim-web/utils/tex/mathjax';
import { init_tex } from 'manim-web';
import fs from 'node:fs';
import path from 'node:path';
import { check_params, get_visual } from '@mathnim/visuals';
import '@mathnim/visuals/econ';
import { check_lesson } from '../server/studio/format';
import { lint_lesson_text } from './text_lint';

const id = process.argv[2];
if (!id) {
  console.error('usage: node tools/demo_check.mjs <course-id>');
  process.exit(2);
}
const DEMO = path.join(process.env.MATHNIM_PUBLIC!, 'demo');
await init_tex();

type Entry = { id: string; units: { lessons: string[] }[]; lessons: { id: string; minutes: number; meta: { skills: { id: string }[] } }[] };
const entry = (JSON.parse(fs.readFileSync(path.join(DEMO, 'courses.json'), 'utf8')) as Entry[]).find((c) => c.id === id);
if (!entry) {
  console.error(`${id} is not in public/demo/courses.json`);
  process.exit(2);
}

/** The lesson in one language: every { en, zh } replaced by its `lang` side. */
const project = (v: unknown, lang: 'en' | 'zh'): unknown =>
  is_bilingual(v as L10n) ? (v as Record<string, string>)[lang] : Array.isArray(v) ? v.map((x) => project(x, lang)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, project(x, lang)])) : v;

/** The lesson without the blocks the generated-lesson format does not know (visual, quiz), at any depth. */
const EXTRAS = new Set(['visual', 'quiz']);
const without_extras = (v: any): any =>
  Array.isArray(v) ? v.filter((x) => !(x && EXTRAS.has(x.type) && 'type' in x && (x.name !== undefined || x.options !== undefined))).map(without_extras) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, without_extras(x)])) : v;

let errors = 0;
const report = (where: string, list: string[], kind: 'error' | 'warning') => {
  for (const m of list) console.log(`  ${kind}: ${where}: ${m}`);
  if (kind === 'error') errors += list.length;
};
const listed = new Set(entry.units.flatMap((u) => u.lessons));
for (const l of entry.lessons) {
  if (!listed.has(l.id)) report(l.id, ['in lessons but in no unit'], 'error');
  const file = path.join(DEMO, id, `${l.id}.json`);
  if (!fs.existsSync(file)) {
    report(l.id, [`missing ${path.relative(DEMO, file)}`], 'error');
    continue;
  }
  const lesson = JSON.parse(fs.readFileSync(file, 'utf8')) as Lesson & { minutes: number };
  console.log(`${l.id} (${lesson.steps.length} steps, ${l.minutes} min)`);
  const skills = l.meta.skills.map((s) => s.id);
  for (const lang of ['en', 'zh'] as const) report(`format (${lang})`, check_lesson(project(without_extras(lesson), lang), { id: l.id, skills }).errors, 'error');
  const issues = lint_lesson_text(lesson, {
    check_visual: (name, params) => {
      const v = get_visual(name);
      if (!v) return null;
      const c = check_params(v, params ?? {});
      return { errors: c.errors, notes: c.notes, explorable: !!v.explore };
    },
    tex_error: (tex, display) => {
      try {
        tex_to_svg(tex, display ? 'displaymath' : 'math');
        return null;
      } catch (e: any) {
        return String(e?.message ?? e).split('\n')[0];
      }
    },
  });
  // every fill-in line must accept its own answer (it parses, and the grader agrees with itself)
  for (const st of lesson.steps) {
    if (st.kind !== 'derive' || !(st as DeriveStep).blank) continue;
    const d = st as DeriveStep;
    try {
      const g = grade_blank(d, d.blank!.answer);
      if (!g.correct) report(`${st.id}.blank`, [`its own answer '${d.blank!.answer}' is graded wrong`], 'error');
    } catch (e: any) {
      report(`${st.id}.blank`, [`answer '${d.blank!.answer}' does not grade: ${String(e?.message ?? e)}`], 'error');
    }
    if (d.blank!.line >= d.lines.length) report(`${st.id}.blank`, [`line ${d.blank!.line} does not exist`], 'error');
  }
  report('text', issues.filter((i) => i.severity === 'error').map((i) => `${i.where}: ${i.message}`), 'error');
  report('text', issues.filter((i) => i.severity === 'warning').map((i) => `${i.where}: ${i.message}`), 'warning');
}
for (const u of entry.units) for (const lid of u.lessons) if (!entry.lessons.some((l) => l.id === lid)) report(lid, ['in a unit but not in lessons'], 'error');
console.log(errors ? `\n${errors} error${errors === 1 ? '' : 's'}` : '\nno errors');
process.exitCode = errors ? 1 : 0;
