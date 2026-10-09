// Persistent TeX -> SVG server backed by manim-web's MathJax adapter
// (src/utils/tex/mathjax.ts), used by tools/golden_examples.py so that real
// manim renders TeX exactly like manim-web does (there is no LaTeX here).
//
//   node tools/tex_server.mjs --build     bundle the adapter (done once by golden_examples.py)
//   node tools/tex_server.mjs             serve: one JSON request per stdin line
//        {"id", "tex", "env", "template"}  ->  {"id", "svg"} | {"id", "error"}
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src/utils/tex/mathjax.ts');
const deps = [src, path.join(root, 'src/utils/svgelements.ts')];
const bundle = path.join(root, 'node_modules/.cache/manim-web/tex_server_lib.mjs');

async function build() {
  const { build } = await import('esbuild');
  await build({ entryPoints: [src], bundle: true, platform: 'node', format: 'esm', outfile: bundle, external: ['mathjax-full'], logLevel: 'error', target: 'node20' });
}
const stale = () => !fs.existsSync(bundle) || deps.some((d) => fs.statSync(d).mtimeMs > fs.statSync(bundle).mtimeMs);

if (process.argv.includes('--build')) {
  await build();
  process.exit(0);
}
if (stale()) await build();
const lib = await import(pathToFileURL(bundle).href);
await lib.init_tex();
const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }
  let res;
  try {
    res = { id: req.id, svg: lib.tex_to_svg(req.tex, req.env ?? null, req.template ?? '') };
  } catch (e) {
    res = { id: req.id, error: String(e?.message ?? e) };
  }
  process.stdout.write(JSON.stringify(res) + '\n');
});
