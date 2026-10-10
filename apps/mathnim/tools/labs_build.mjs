// Bundles tools/labs_build.ts and runs it: converts the lab tutorials
// (docs/lessons/llm-finetuning/labs/*.md and labs/code/) into src/labs/*.ts.
//   npm run labs -w mathnim
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pk = (p) => path.resolve(here, '../../../packages', p);
const out = path.resolve(here, '../node_modules/.cache/labs_build.mjs');
await build({
  entryPoints: [path.join(here, 'labs_build.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, target: 'node20',
  logLevel: 'error',
  alias: { '@mathnim/core': pk('core/src') },
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
const { main } = await import(pathToFileURL(out).href);
main({ fs, labs_dir: path.resolve(here, '../../../docs/lessons/llm-finetuning/labs'), out_dir: path.resolve(here, '../src/labs') });
