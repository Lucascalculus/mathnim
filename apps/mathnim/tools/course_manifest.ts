// Writes src/lessons/<course>/manifest.generated.ts for every course whose
// lessons load on demand (LAZY below): the course as data (units, cards, and
// per lesson the skills, languages, mode, step kinds) plus one loader per
// lesson that imports the lesson module and the visual packs it uses. The app
// shows the course and keeps the learner model with this data, and downloads
// a lesson's code, visuals and data only when it is opened.
// Run after adding or changing lessons of such a course:   npm run manifest -w mathnim
// (tools/course_manifest.mjs finds the sources on disk, bundles this file and runs it.)
import fs from 'node:fs';
import path from 'node:path';
import { lesson_langs, type Lesson } from '@mathnim/core';
import { list_visuals } from '@mathnim/visuals';
// @ts-expect-error virtual module made by course_manifest.mjs
import { SOURCES } from 'mathnim:course-sources';
import type { CourseLesson, Unit } from '../src/course';

/** What course_manifest.mjs found for one course. */
interface Sources {
  /** src/lessons/<course> and packages/visuals/src/<course> (absolute). */
  lessons_dir: string;
  visuals_dir: string;
  /** The unit modules by folder ('' for <course>/unit.ts, 'a' for <course>/a/unit.ts). */
  units: Record<string, Record<string, unknown>>;
  /** Every other module of the course folder ('a/a1', 'm1', ...). */
  modules: { file: string; load: () => Promise<Record<string, unknown>> }[];
  /** The visual packs: folders with an index.ts that registers visuals ('' = the course folder itself). */
  packs: { pack: string; load: () => Promise<unknown> }[];
}

/** The lazily loaded courses: their folder name and how their units are ordered. */
const LAZY: { course: string; units: (u: Sources['units']) => Unit[] }[] = [
  {
    // the fine-tuning course: parts A and B, the halfway practice, C, D, E, the capstone
    course: 'ft',
    units: (units) => {
      const u = (p: string) => units[p]?.unit as Unit | undefined;
      const f = units.f as { midway: CourseLesson; capstone: CourseLesson } | undefined;
      return [
        u('a'), u('b'),
        f && { id: 'ft-f0', title: { en: 'Fine-tuning · Choosing, halfway', zh: '微调 · 中场选择练习' }, lessons: [f.midway] },
        u('c'), u('d'), u('e'),
        f && { id: 'ft-f1', title: { en: 'Fine-tuning F · How to choose', zh: '微调 F · 怎么选' }, lessons: [f.capstone] },
      ].filter((x): x is Unit => !!x);
    },
  },
  {
    // model predictive control: src/lessons/mpc/unit.ts exports `units` in course order
    course: 'mpc',
    units: (units) => (units['']?.units as Unit[] | undefined) ?? [],
  },
];

const ALL = SOURCES as Record<string, Sources>;
const is_lesson = (x: unknown): x is Lesson => !!x && typeof x === 'object' && typeof (x as Lesson).id === 'string' && Array.isArray((x as Lesson).steps);
const has_scene = (l: Lesson) => l.steps.some((s) => 'scene' in s && !!s.scene);
const strip = (cl: CourseLesson) => ({ id: cl.id, title: cl.title, summary: cl.summary, minutes: cl.minutes, level: cl.level, thumb: cl.thumb });

// every pack of every course registers its visuals first (a lesson may use another course's visuals)
for (const s of Object.values(ALL)) for (const p of s.packs) await p.load();
const registered = new Set(list_visuals().map((v) => v.name));

const problems: string[] = [];
for (const { course, units: order } of LAZY) {
  const src = ALL[course];
  const before = problems.length;
  const units = order(src.units);
  // visual name -> pack, from the definitions in each pack's own folder
  const pack_of = new Map<string, string>();
  for (const { pack } of src.packs) {
    const dir = path.join(src.visuals_dir, pack);
    for (const file of fs.readdirSync(dir).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
      for (const m of fs.readFileSync(path.join(dir, file), 'utf8').matchAll(/\bname:\s*['"]([a-z][a-z0-9_]+)['"]/g)) if (registered.has(m[1])) pack_of.set(m[1], pack);
    }
  }
  const packs = new Set(src.packs.map((p) => p.pack));
  // lesson id -> its module and export; the other modules (common.ts, kit.ts) are shared helpers of their folder
  const where = new Map<string, { file: string; name: string }>();
  const shared = new Map<string, string>();
  for (const { file, load } of src.modules) {
    const m = await load();
    const found = Object.entries(m).filter(([, v]) => is_lesson(v));
    for (const [name, v] of found) if (!where.has((v as Lesson).id)) where.set((v as Lesson).id, { file, name });
    if (!found.length) {
      const dir = path.posix.dirname(file);
      shared.set(dir, (shared.get(dir) ?? '') + fs.readFileSync(path.join(src.lessons_dir, `${file}.ts`), 'utf8'));
    }
  }
  // a module's source and the sources of the course modules it imports, followed through
  const source = (f: string, seen: Set<string>): string => {
    if (seen.has(f) || !fs.existsSync(path.join(src.lessons_dir, `${f}.ts`))) return '';
    seen.add(f);
    const text = fs.readFileSync(path.join(src.lessons_dir, `${f}.ts`), 'utf8');
    const deps = [...text.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
    return text + deps.map((d) => source(d, seen)).join('');
  };

  const lessons: Record<string, unknown> = {};
  const loaders: string[] = [];
  for (const unit of units) for (const cl of unit.lessons) {
    const l = cl.lesson;
    const at = l && where.get(l.id);
    if (!l || !at) {
      problems.push(`${course}/${cl.id}: no module in src/lessons/${course} exports this lesson`);
      continue;
    }
    // the packs it needs: its own part's, those whose visuals its sources name, and a course's only pack
    const text = source(at.file, new Set()) + (shared.get(path.posix.dirname(at.file)) ?? '');
    const need = new Set<string>();
    const part = at.file.includes('/') ? at.file.split('/')[0] : '';
    if (part && packs.has(part)) need.add(part);
    if (packs.size === 1) need.add([...packs][0]);
    for (const m of text.matchAll(/['"`]([a-z][a-z0-9_]+)['"`]/g)) if (pack_of.has(m[1])) need.add(pack_of.get(m[1])!);
    lessons[l.id] = {
      title: l.title, mode: l.mode ?? 'essay', langs: lesson_langs(l), has_scene: has_scene(l),
      kinds: [...new Set(l.steps.map((s) => s.kind))], skills: l.skills.map((s) => ({ id: s.id, name: s.name })),
      // a (stable) count of checkpoint steps, so the review page knows a lesson has practice questions without loading it
      checkpoints: l.steps.filter((s) => s.kind === 'checkpoint').length,
    };
    const spec = (p: string) => `@mathnim/visuals/${course}${p ? `/${p}` : ''}`;
    const imports = [`import('./${at.file}')`, ...[...need].sort().map((p) => `import('${spec(p)}')`)];
    loaders.push(`  ${JSON.stringify(l.id)}: () => Promise.all([${imports.join(', ')}]).then(([m]) => m.${at.name}),`);
  }
  const manifest = { units: units.map((un) => ({ id: un.id, title: un.title, lessons: un.lessons.map(strip) })), lessons };
  const out = `// Generated by apps/mathnim/tools/course_manifest.ts (npm run manifest -w mathnim) - do not edit.
// The course as data, and one loader per lesson (its module and the visual
// packs it uses), so the course's code arrives only when a lesson is opened.
import type { Lesson } from '@mathnim/core';
import type { CourseManifest } from '../../course';

export const MANIFEST: CourseManifest = ${JSON.stringify(manifest, null, 1)};

export const LOADERS: Record<string, () => Promise<Lesson>> = {
${loaders.join('\n')}
};
`;
  if (problems.length > before) continue; // nothing is written for a course with problems
  fs.mkdirSync(src.lessons_dir, { recursive: true });
  const file = path.join(src.lessons_dir, 'manifest.generated.ts');
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== out) fs.writeFileSync(file, out);
  console.log(`src/lessons/${course}/manifest.generated.ts: ${Object.keys(lessons).length} lessons in ${units.length} units`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
