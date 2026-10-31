// Production builds rename our internal properties, the names that start with "_" (Manim's own convention for
// internals, such as _internal_value or _setup_scene, kept in manim-web), to short meaningless ones, so the code a
// browser downloads explains less of itself. Only our own modules are touched (packages/*/src, apps/mathnim/src), all
// with one table built from our sources, so a name is the same in every chunk and in the sandbox worker; library code
// is left alone. Public names (Manim's API, which lessons and the tutor's scenes call), JSON keys and stored records
// do not start with "_" and keep their names. Quoted keys are renamed too: the engine's keyword table names methods
// such as "_setup_scene" in quotes. Exported names keep theirs (a module's exports are read as properties of its
// namespace, e.g. _m58._np_arange in manim-web's index).
import { transform } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const INTERNAL = /^_[a-z][a-z0-9_]*$/;
const SOURCES = ['packages/manim-web/src', 'packages/visuals/src', 'packages/present/src', 'packages/core/src', 'packages/ai/src', 'apps/mathnim/src'];

function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (/\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Every "_name" in our sources, each to its own short name ($0, $1, ... in a fixed order); exported ones kept (false). */
function rename_table(dirs: string[]): Record<string, string | false> {
  const names = new Set<string>(), exported = new Set<string>();
  for (const f of dirs.flatMap((d) => files(d))) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/\b_[a-z][a-z0-9_]*\b/g)) names.add(m[0]);
    for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+(_[a-z][a-z0-9_]*)/g)) exported.add(m[1]);
    for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) for (const n of m[1].match(/\b_[a-z][a-z0-9_]*\b/g) ?? []) exported.add(n);
  }
  return Object.fromEntries([...names].sort().map((n, i) => [n, exported.has(n) ? false : `$${i.toString(36)}`]));
}

export function mangle_internals(root: string): Plugin {
  const dirs = SOURCES.map((d) => path.join(root, d));
  let table: Record<string, string | false> | null = null;
  const ours = (id: string) => /\.[cm]?[jt]s$/.test(id.split('?')[0]) && dirs.some((d) => id.startsWith(d + path.sep));
  return {
    name: 'mathnim-mangle-internals',
    // (MATHNIM_NO_MANGLE=1 builds without it, to tell a renaming problem from any other)
    apply: (_config, env) => env.command === 'build' && !process.env.MATHNIM_NO_MANGLE,
    enforce: 'post',
    async transform(code, id) {
      if (!ours(id)) return null;
      table ??= rename_table(dirs);
      const r = await transform(code, { loader: 'js', format: 'esm', target: 'esnext', mangleProps: INTERNAL, mangleQuoted: true, mangleCache: { ...table } });
      return { code: r.code, map: null };
    },
  };
}
