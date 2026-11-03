// Bundles tools/bench_check.ts (resolving the workspace aliases) and runs it.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const pk = (p) => path.resolve(here, '../../../packages', p);
const out = path.resolve(here, '../node_modules/.cache/bench_check.mjs');
const alias = { 'manim-web': pk('manim-web/src'), '@mathnim/core': pk('core/src'), '@mathnim/present': pk('present/src'), '@mathnim/ai': pk('ai/src'), '@mathnim/visuals': pk('visuals/src') };
if (fs.existsSync(pk('engine/src'))) Object.assign(alias, { '@mathnim/engine': pk('engine/src'), '@mathnim/look': pk('look/src') });
await build({ entryPoints: [path.join(here, 'bench_check.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, target: 'node20', alias, external: ['@napi-rs/canvas', 'mediabunny'], logLevel: 'error' });
process.env.MANIM_WEB_FONTS ??= pk('manim-web/src/ext/text/fonts');
await import(out);
