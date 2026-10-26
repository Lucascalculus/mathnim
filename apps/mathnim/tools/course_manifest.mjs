// Bundles tools/course_manifest.ts with every lesson module, unit list and
// visual pack of the lazily loaded courses (found on disk), runs it, and so
// regenerates src/lessons/<course>/manifest.generated.ts.
//   npm run manifest -w mathnim      (npm run ft-manifest is the same)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pk = (p) => path.resolve(here, '../../../packages', p);
/** The courses whose lessons load on demand (their folders under src/lessons and packages/visuals/src). */
const COURSES = ['ft', 'mpc'];
// (the two roots can be moved for a dry run on sample content)
const LESSONS_ROOT = process.env.MATHNIM_LESSONS_ROOT ?? path.resolve(here, '../src/lessons');
const VISUALS_ROOT = process.env.MATHNIM_VISUALS_ROOT ?? pk('visuals/src');

const SKIP = (f) => !f.endsWith('.ts') || f.endsWith('.test.ts') || f.endsWith('.d.ts') || f === 'manifest.generated.ts';
/** Every .ts file under dir, as paths relative to it without the extension. */
function walk(dir, rel = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().flatMap((f) => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) return walk(full, rel ? `${rel}/${f}` : f);
    return SKIP(f) ? [] : [rel ? `${rel}/${f.replace(/\.ts$/, '')}` : f.replace(/\.ts$/, '')];
  });
}
const sources = COURSES.map((course) => {
  const lessons_dir = path.join(LESSONS_ROOT, course);
  const visuals_dir = path.join(VISUALS_ROOT, course);
  const files = walk(lessons_dir);
  const units = files.filter((f) => path.posix.basename(f) === 'unit');
  const modules = files.filter((f) => path.posix.basename(f) !== 'unit');
  // a pack: the course's visual folder or one of its subfolders, with an index.ts that registers visuals
  const packs = fs.existsSync(visuals_dir)
    ? ['', ...fs.readdirSync(visuals_dir).filter((d) => fs.statSync(path.join(visuals_dir, d)).isDirectory()).sort()].filter((d) => fs.existsSync(path.join(visuals_dir, d, 'index.ts')))
    : [];
  const imp = (file) => `() => import(${JSON.stringify(file)})`;
  return `${JSON.stringify(course)}: {
    lessons_dir: ${JSON.stringify(lessons_dir)}, visuals_dir: ${JSON.stringify(visuals_dir)},
    units: { ${units.map((u, i) => `${JSON.stringify(path.posix.dirname(u) === '.' ? '' : path.posix.dirname(u))}: u_${course}_${i}`).join(', ')} },
    modules: [${modules.map((m) => `{ file: ${JSON.stringify(m)}, load: ${imp(path.join(lessons_dir, m + '.ts'))} }`).join(', ')}],
    packs: [${packs.map((p) => `{ pack: ${JSON.stringify(p)}, load: ${imp(path.join(visuals_dir, p, 'index.ts'))} }`).join(', ')}],
  }`;
});
const unit_imports = COURSES.flatMap((course) => {
  const files = walk(path.join(LESSONS_ROOT, course)).filter((f) => path.posix.basename(f) === 'unit');
  return files.map((u, i) => `import * as u_${course}_${i} from ${JSON.stringify(path.join(LESSONS_ROOT, course, u + '.ts'))};`);
});
const virtual = {
  name: 'course-sources',
  setup(b) {
    b.onResolve({ filter: /^mathnim:course-sources$/ }, () => ({ path: 'course-sources', namespace: 'course-sources' }));
    b.onLoad({ filter: /.*/, namespace: 'course-sources' }, () => ({
      contents: `${unit_imports.join('\n')}\nexport const SOURCES = {\n${sources.join(',\n')}\n};\n`,
      loader: 'ts', resolveDir: here,
    }));
  },
};
const out = path.resolve(here, '../node_modules/.cache/course_manifest.mjs');
await build({
  entryPoints: [path.join(here, 'course_manifest.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, target: 'node20',
  external: ['@napi-rs/canvas', 'mediabunny'], logLevel: 'error', plugins: [virtual],
  alias: { 'manim-web': pk('manim-web/src'), '@mathnim/core': pk('core/src'), '@mathnim/present': pk('present/src'), '@mathnim/ai': pk('ai/src'), '@mathnim/visuals': pk('visuals/src') },
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
await import(pathToFileURL(out).href);
