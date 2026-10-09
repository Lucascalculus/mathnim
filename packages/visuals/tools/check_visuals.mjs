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

// The fine-tuning visuals live in src/ft/<part>/index.ts and register themselves
// on import; this virtual module imports the parts that exist (missing relative
// imports inside them, i.e. files still being written, are stubbed too).
const visuals_src = pk('visuals/src');
const ft_parts = fs.existsSync(path.join(visuals_src, 'ft'))
  ? fs.readdirSync(path.join(visuals_src, 'ft')).filter((d) => fs.existsSync(path.join(visuals_src, 'ft', d, 'index.ts'))).sort()
  : [];
const ft_visuals = {
  name: 'ft-visuals',
  setup(b) {
    b.onResolve({ filter: /^mathnim:ft-visuals$/ }, () => ({ path: 'ft-visuals', namespace: 'ft-visuals' }));
    b.onLoad({ filter: /.*/, namespace: 'ft-visuals' }, () => ({
      contents: ft_parts.map((d) => `import ${JSON.stringify(path.join(visuals_src, 'ft', d, 'index.ts'))};`).join('\n'),
      loader: 'ts', resolveDir: visuals_src,
    }));
    b.onResolve({ filter: /^\.\.?\// }, (a) => {
      if (!a.importer.startsWith(path.join(visuals_src, 'ft'))) return undefined;
      const base = path.resolve(path.dirname(a.importer), a.path);
      const found = ['', '.ts', '.js', '/index.ts'].some((ext) => fs.existsSync(base + ext) && fs.statSync(base + ext).isFile());
      if (found) return undefined;
      stubbed.add(path.relative(visuals_src, base));
      return { path: base, namespace: 'stub' };
    });
  },
};

// inside the repo so that the external packages resolve from the root node_modules
const out = path.resolve(here, '.cache/check_visuals.bundle.mjs');
await build({
  entryPoints: [path.join(here, 'check_visuals.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, target: 'node20',
  external: ['@napi-rs/canvas', 'mediabunny'], logLevel: 'error', plugins: [ft_visuals, stub_missing],
  alias: { 'manim-web': manim_src, '@mathnim/visuals': pk('visuals/src') },
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
if (stubbed.size) console.log(`note: stubbed modules that do not exist yet (in progress elsewhere): ${[...stubbed].join(', ')}\n`);
process.env.MANIM_WEB_FONTS = pk('manim-web/src/ext/text/fonts');
// the app's public folder: where a self-hosted Chinese font would be (tools/cjk_font.ts)
process.env.MATHNIM_PUBLIC ??= pk('../apps/mathnim/public');
await import(pathToFileURL(out).href);
