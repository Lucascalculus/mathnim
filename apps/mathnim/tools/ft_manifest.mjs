// Bundles tools/ft_manifest.ts with every fine-tuning lesson module and visual
// index (found on disk), runs it, and so regenerates
// src/lessons/ft/manifest.generated.ts.   npm run ft-manifest
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pk = (p) => path.resolve(here, '../../../packages', p);
const ft_lessons = path.resolve(here, '../src/lessons/ft');
const ft_visuals = pk('visuals/src/ft');
const parts = fs.readdirSync(ft_lessons).filter((d) => fs.statSync(path.join(ft_lessons, d)).isDirectory()).sort();
// every module of every part except the unit lists: the ones that export `lesson` are lessons
const modules = parts.flatMap((p) => fs.readdirSync(path.join(ft_lessons, p)).filter((f) => f.endsWith('.ts') && f !== 'unit.ts' && !f.endsWith('.test.ts')).sort().map((f) => `${p}/${f.replace(/\.ts$/, '')}`));
const visual_parts = fs.readdirSync(ft_visuals).filter((d) => fs.existsSync(path.join(ft_visuals, d, 'index.ts'))).sort();
const virtual = {
  name: 'ft-sources',
  setup(b) {
    b.onResolve({ filter: /^mathnim:ft-sources$/ }, () => ({ path: 'ft-sources', namespace: 'ft-sources' }));
    b.onLoad({ filter: /.*/, namespace: 'ft-sources' }, () => ({
      contents: [
        ...parts.map((p, i) => `import * as unit${i} from ${JSON.stringify(path.join(ft_lessons, p, 'unit.ts'))};`),
        `export const UNITS = { ${parts.map((p, i) => `${JSON.stringify(p)}: unit${i}`).join(', ')} };`,
        `export const MODULES = [${modules.map((m) => `{ file: ${JSON.stringify(m)}, load: () => import(${JSON.stringify(path.join(ft_lessons, m + '.ts'))}) }`).join(', ')}];`,
        `export const VISUAL_PARTS = [${visual_parts.map((p) => `{ part: ${JSON.stringify(p)}, load: () => import(${JSON.stringify(path.join(ft_visuals, p, 'index.ts'))}) }`).join(', ')}];`,
      ].join('\n'),
      loader: 'ts', resolveDir: here,
    }));
  },
};
const out = path.resolve(here, '../node_modules/.cache/ft_manifest.mjs');
await build({
  entryPoints: [path.join(here, 'ft_manifest.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, target: 'node20',
  external: ['@napi-rs/canvas', 'mediabunny'], logLevel: 'error', plugins: [virtual],
  alias: { 'manim-web': pk('manim-web/src'), '@mathnim/core': pk('core/src'), '@mathnim/present': pk('present/src'), '@mathnim/ai': pk('ai/src'), '@mathnim/visuals': pk('visuals/src') },
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
process.env.MATHNIM_FT_LESSONS = ft_lessons;
process.env.MATHNIM_FT_VISUALS = ft_visuals;
await import(pathToFileURL(out).href);
