// The shape of the engine (docs/design/ENGINE-ARCH.md): the kernel never imports the library, stays under its line
// budget and touches no DOM at import; every library file is exported. These keep "a new kind is a new file, the
// kernel untouched" true as the library grows.
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

// (the sources as text, through the bundler: the engine's tests have no node types)
const files = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const in_dir = (d: string) => Object.keys(files).filter((f) => f.startsWith(`../src/${d}/`));
const kernel = in_dir('kernel'), lib = in_dir('lib');
const read = (f: string) => files[f];
const path = { basename: (f: string, ext = '') => f.split('/').pop()!.replace(ext, '') };
/** The kernel's line budget (ENGINE.md §4: at most ten thousand lines). */
const BUDGET = 10_000;

describe('the engine\'s shape', () => {
  it('no kernel file imports the library', () => {
    const bad = kernel.filter((f) => /from ['"]\.\.\/lib\//.test(read(f)) || /from ['"]\.\/lib\//.test(read(f)));
    expect(bad.map((f) => path.basename(f))).toEqual([]);
  });
  it(`the kernel stays under ${BUDGET} lines`, () => {
    const lines = kernel.reduce((n, f) => n + read(f).split('\n').length, 0);
    expect(lines).toBeLessThan(BUDGET);
  });
  it('the kernel touches no DOM when imported (node renders everything)', () => {
    // (a top-level statement reading document or window would break node: they may appear only inside functions)
    for (const f of kernel) {
      const top = read(f).split('\n').filter((l) => /^(const|let|var|export const|export let)\b/.test(l) && /\b(document|window)\./.test(l));
      expect(top, path.basename(f)).toEqual([]);
    }
  });
  it('every library file is exported by the index', () => {
    const index = read('../src/index.ts');
    const missing = lib.map((f) => path.basename(f, '.ts')).filter((n) => !index.includes(`'./lib/${n}'`));
    expect(missing).toEqual([]);
  });
  it('only the index lives beside the two folders', () => {
    expect(Object.keys(files).filter((f) => f.split('/').length === 3)).toEqual(['../src/index.ts']);
  });
});
