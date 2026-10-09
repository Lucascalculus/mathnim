// Part E: run packages/visuals/tools/check_visuals.ts with the part E visuals
// registered (they are not wired into src/index.ts yet; the main session does that).
//   node apps/mathnim/tools/ft-data/e/check_visuals_e.mjs --only grpo_group [--theme light] [--out dir]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const pk = (p) => path.resolve(root, 'packages', p);
const manim_src = pk('manim-web/src');
const out = path.resolve(pk('visuals/tools'), '.cache/check_visuals_e.bundle.mjs');
fs.mkdirSync(path.dirname(out), { recursive: true });
await build({
  stdin: {
    // system fonts give CJK glyphs in node (the plain checker draws Chinese as empty boxes)
    contents: `import { load_fonts } from 'manim-web/ext/text/fonts';\nimport ${JSON.stringify(pk('visuals/src/ft/e/index.ts'))};\nawait load_fonts({ font_dir: process.env.MANIM_WEB_FONTS, system_fonts: true });\nawait import(${JSON.stringify(pk('visuals/tools/check_visuals.ts'))});\n`,
    resolveDir: pk('visuals/tools'), loader: 'ts', sourcefile: 'check_e_entry.ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, target: 'node20',
  external: ['@napi-rs/canvas', 'mediabunny'], logLevel: 'error',
  alias: { 'manim-web': manim_src, '@mathnim/visuals': pk('visuals/src') },
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
process.env.MANIM_WEB_FONTS = pk('manim-web/src/ext/text/fonts');
await import(pathToFileURL(out).href);
