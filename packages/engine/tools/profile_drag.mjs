// Bundles profile_drag.ts with the workspace aliases and runs it.
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), pk = (p) => path.resolve(here, '../..', p);
const out = path.resolve(here, '../../../node_modules/.cache/profile_drag.mjs');
await build({
  entryPoints: [path.join(here, 'profile_drag.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, target: 'node20',
  alias: { 'manim-web': pk('manim-web/src'), '@mathnim/engine': pk('engine/src'), '@mathnim/look': pk('look/src') },
  external: ['@napi-rs/canvas'], logLevel: 'error',
});
await import(out);
