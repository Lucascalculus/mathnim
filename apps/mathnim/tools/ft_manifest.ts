// Writes src/lessons/ft/manifest.generated.ts: the fine-tuning course as data
// (units, cards, and per lesson the skills, languages, mode, step kinds) plus a
// loader per lesson that imports the lesson module and the visuals of the parts
// it uses. The app shows the course and keeps the learner model with this data
// and downloads a lesson's code, visuals and data only when it is opened.
// Run after adding or changing fine-tuning lessons:   npm run ft-manifest
import fs from 'node:fs';
import path from 'node:path';
import { lesson_langs, type Lesson } from '@mathnim/core';
import { list_visuals } from '@mathnim/visuals';
// @ts-expect-error virtual module made by ft_manifest.mjs
import { MODULES, UNITS, VISUAL_PARTS } from 'mathnim:ft-sources';
import type { CourseLesson, Unit } from '../src/course';

const DIR = process.env.MATHNIM_FT_LESSONS!;
const units = UNITS as Record<string, Record<string, unknown>>;

// the course's order: parts A and B, the halfway practice, C, D, E, the capstone
const u = (p: string) => units[p]?.unit as Unit;
const f = units.f as { midway: CourseLesson; capstone: CourseLesson };
const COURSE_UNITS: Unit[] = [
  u('a'), u('b'),
  { id: 'ft-f0', title: { en: 'Fine-tuning · Choosing, halfway', zh: '微调 · 中场选择练习' }, lessons: [f.midway] },
  u('c'), u('d'), u('e'),
  { id: 'ft-f1', title: { en: 'Fine-tuning F · How to choose', zh: '微调 F · 怎么选' }, lessons: [f.capstone] },
].filter(Boolean);

// visual name -> part: register every part, then find each visual's definition in the part folders
const VIS = process.env.MATHNIM_FT_VISUALS!;
for (const { load } of VISUAL_PARTS as { part: string; load: () => Promise<unknown> }[]) await load();
const registered = new Set(list_visuals().map((v) => v.name));
const part_of = new Map<string, string>();
for (const part of fs.readdirSync(VIS).filter((d) => fs.existsSync(path.join(VIS, d, 'index.ts')))) {
  for (const file of fs.readdirSync(path.join(VIS, part)).filter((x) => x.endsWith('.ts'))) {
    for (const m of fs.readFileSync(path.join(VIS, part, file), 'utf8').matchAll(/\bname:\s*['"]([a-z][a-z0-9_]+)['"]/g)) if (registered.has(m[1])) part_of.set(m[1], part);
  }
}
// lesson id -> module file; the other modules of a part (common.ts, kit.ts) are its shared helpers
const file_of = new Map<string, string>();
const shared = new Map<string, string>();
for (const { file, load } of MODULES as { file: string; load: () => Promise<{ lesson?: Lesson }> }[]) {
  const m = await load();
  if (m.lesson?.id) file_of.set(m.lesson.id, file);
  else shared.set(file.split('/')[0], (shared.get(file.split('/')[0]) ?? '') + fs.readFileSync(path.join(DIR, `${file}.ts`), 'utf8'));
}

const has_scene = (l: Lesson) => l.steps.some((s) => 'scene' in s && !!s.scene);
const problems: string[] = [];
const lessons: Record<string, unknown> = {};
const loaders: string[] = [];
for (const unit of COURSE_UNITS) for (const cl of unit.lessons) {
  const l = cl.lesson!;
  const file = file_of.get(l.id);
  if (!file) {
    problems.push(`${l.id}: no module in src/lessons/ft exports it as \`lesson\``);
    continue;
  }
  // the visuals it uses, by name in its source, and its own part
  // its source and the sources of the lesson modules it imports (helpers of its own or another part), followed through
  const seen = new Set<string>();
  const source = (f: string): string => {
    if (seen.has(f) || !fs.existsSync(path.join(DIR, `${f}.ts`))) return '';
    seen.add(f);
    const text = fs.readFileSync(path.join(DIR, `${f}.ts`), 'utf8');
    const deps = [...text.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
    return text + deps.map(source).join('');
  };
  const src = source(file) + (shared.get(file.split('/')[0]) ?? '');
  const parts = new Set<string>([file.split('/')[0]].filter((p) => [...part_of.values()].includes(p)));
  for (const m of src.matchAll(/['"`]([a-z][a-z0-9_]+)['"`]/g)) if (part_of.has(m[1])) parts.add(part_of.get(m[1])!);
  lessons[l.id] = {
    title: l.title, mode: l.mode ?? 'essay', langs: lesson_langs(l), has_scene: has_scene(l),
    kinds: [...new Set(l.steps.map((s) => s.kind))], skills: l.skills.map((s) => ({ id: s.id, name: s.name })),
    // a (stable) count of checkpoint steps, so the review page knows a lesson has practice questions without loading it
    checkpoints: l.steps.filter((s) => s.kind === 'checkpoint').length,
  };
  const imports = [`import('./${file}')`, ...[...parts].sort().map((p) => `import('@mathnim/visuals/ft/${p}')`)];
  loaders.push(`  ${JSON.stringify(l.id)}: () => Promise.all([${imports.join(', ')}]).then(([m]) => m.lesson),`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
const strip = (cl: CourseLesson) => ({ id: cl.id, title: cl.title, summary: cl.summary, minutes: cl.minutes, level: cl.level, thumb: cl.thumb });
const manifest = { units: COURSE_UNITS.map((un) => ({ id: un.id, title: un.title, lessons: un.lessons.map(strip) })), lessons };

const out = `// Generated by apps/mathnim/tools/ft_manifest.ts (npm run ft-manifest) - do not edit.
// The fine-tuning course as data, and one loader per lesson (its module and the
// visuals of the parts it uses), so the course's code arrives only when opened.
import type { Lesson } from '@mathnim/core';
import type { FtManifest } from '../../course';

export const FT_MANIFEST: FtManifest = ${JSON.stringify(manifest, null, 1)};

export const FT_LOADERS: Record<string, () => Promise<Lesson>> = {
${loaders.join('\n')}
};
`;
fs.writeFileSync(path.join(DIR, 'manifest.generated.ts'), out);
console.log(`wrote src/lessons/ft/manifest.generated.ts: ${Object.keys(lessons).length} lessons in ${COURSE_UNITS.length} units`);
