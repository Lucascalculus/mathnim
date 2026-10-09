// Bundles tools/lesson_doctor.ts (resolving the workspace aliases) and runs it.
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pk = (p) => path.resolve(here, '../../../packages', p);
const out = path.resolve(here, '../node_modules/.cache/lesson_doctor.mjs');
await build({
  entryPoints: [path.join(here, 'lesson_doctor.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, target: 'node20',
  external: ['@napi-rs/canvas', 'mediabunny'], logLevel: 'error',
  alias: { 'manim-web': pk('manim-web/src'), '@mathnim/core': pk('core/src'), '@mathnim/present': pk('present/src'), '@mathnim/ai': pk('ai/src'), '@mathnim/visuals': pk('visuals/src') },
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
process.env.MANIM_WEB_FONTS = pk('manim-web/src/ext/text/fonts');
process.env.MATHNIM_PUBLIC = path.resolve(here, '../public');
await import(pathToFileURL(out).href);
