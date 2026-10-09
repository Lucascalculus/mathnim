// Bundles tools/check_visuals.ts (resolving the workspace aliases) and runs it.
//   node tools/check_visuals.mjs [--only linear_map,eigen_hunt] [--theme light|dark] [--out dir] [--full] [--quiet]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pk = (p) => path.resolve(here, '../..', p);
const manim_src = pk('manim-web/src');

// Other packages are edited in parallel; a relative import inside manim-web that
// does not exist yet (work in progress) is replaced by an empty module instead
// of failing the whole check. Such modules are reported.
const stubbed = new Set();
const stub_missing = {
  name: 'stub-missing',
  setup(b) {
    b.onResolve({ filter: /^\.\.?\// }, (a) => {
      if (!a.importer.startsWith(manim_src)) return undefined;
      const base = path.resolve(path.dirname(a.importer), a.path);
      const found = ['', '.ts', '.js', '/index.ts'].some((ext) => fs.existsSync(base + ext) && fs.statSync(base + ext).isFile());
      if (found) return undefined;
      stubbed.add(path.relative(manim_src, base));
      return { path: base, namespace: 'stub' };
    });
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
  },
};

// inside the repo so that the external packages resolve from the root node_modules
const out = path.resolve(here, '.cache/check_visuals.bundle.mjs');
await build({
  entryPoints: [path.join(here, 'check_visuals.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, target: 'node20',
  external: ['@napi-rs/canvas', 'mediabunny'], logLevel: 'error', plugins: [stub_missing],
  alias: { 'manim-web': manim_src, '@mathnim/visuals': pk('visuals/src') },
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
if (stubbed.size) console.log(`note: stubbed modules missing from manim-web (in progress elsewhere): ${[...stubbed].join(', ')}\n`);
process.env.MANIM_WEB_FONTS = pk('manim-web/src/ext/text/fonts');
await import(pathToFileURL(out).href);
