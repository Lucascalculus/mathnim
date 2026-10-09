// Headless regression over manim's doc examples (see docs/TESTING.md).
//
//   node tools/regress.mjs                     all examples
//   node tools/regress.mjs Circle Square       examples whose key/name matches
//   node tools/regress.mjs --fail              list only non-passing results
//   node tools/regress.mjs --images            write manim|web|diff strips for non-passing examples
//
// Needs examples/manim_examples_js.json (python tools/py2js.py --json ...) and
// examples/golden (python tools/golden_examples.py). Writes examples/regress.json.
import { build } from 'esbuild';
import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const failOnly = args.includes('--fail');
const saveImages = args.includes('--images');
const filters = args.filter((a) => !a.startsWith('--'));
const bundle = path.join(root, 'node_modules/.cache/manim-web/regress_worker.mjs');
await build({
  entryPoints: [path.join(root, 'tools/regress_worker.ts')], bundle: true, platform: 'node', format: 'esm', outfile: bundle,
  external: ['@napi-rs/canvas', 'mathjax-full'], logLevel: 'error', target: 'node20', keepNames: true, // Python code reads class __name__
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
const examples = JSON.parse(fs.readFileSync(path.join(root, 'examples/manim_examples_js.json'), 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(root, 'examples/golden/index.json'), 'utf8'));
// goldens that are random in Manim itself (see the file for reasons)
const known = JSON.parse(fs.readFileSync(path.join(root, 'examples/known_diffs.json'), 'utf8'));
const todo = examples.filter((e) => !filters.length || filters.some((f) => e.key === f || e.name === f || e.key.startsWith(f + '__')));
const outDir = path.join(root, 'examples/regress_out');
if (saveImages) fs.rmSync(outDir, { recursive: true, force: true });

const results = [];
let next = 0;
const N = Math.max(2, os.cpus().length - 2);
function runOne(ex) {
  return new Promise((resolve) => {
    const w = new Worker(bundle, { workerData: { ex, golden: golden[ex.key], goldenDir: path.join(root, 'examples/golden'), outDir, saveImages } });
    const timer = setTimeout(() => {
      w.terminate();
      resolve({ key: ex.key, name: ex.name, status: 'fail', error: 'timeout (60s)' });
    }, 60000);
    w.once('message', (r) => {
      clearTimeout(timer);
      w.terminate();
      resolve(r);
    });
    w.once('error', (e) => {
      clearTimeout(timer);
      resolve({ key: ex.key, name: ex.name, status: 'fail', error: `worker: ${e.message}` });
    });
  });
}
await Promise.all(Array.from({ length: N }, async () => {
  while (next < todo.length) results.push(await runOne(todo[next++]));
}));
results.sort((a, b) => a.key.localeCompare(b.key));
for (const r of results) if ((r.status === 'warn' || r.status === 'fail') && (known[r.key] ?? known[r.name])) {
  r.status = 'known';
  r.error = known[r.key] ?? known[r.name];
}
const counts = {};
for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
for (const r of results) {
  if (failOnly && (r.status === 'pass' || r.status === 'skip' || r.status === 'known')) continue;
  const m = r.mean !== undefined ? ` mean=${r.mean} bad=${r.bad}% @${r.worst_frame}${r.frames !== r.our_frames ? ` frames ${r.our_frames}/${r.frames}` : ''}` : '';
  console.log(`${r.status.padEnd(4)} ${r.key}${m}${r.error ? '  ' + r.error.split('\n')[0] : ''}`);
}
console.log('\n' + Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('  '));
if (!filters.length) fs.writeFileSync(path.join(root, 'examples/regress.json'), JSON.stringify(results, null, 1));
