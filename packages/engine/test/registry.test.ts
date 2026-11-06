// The registry (kernel/registry.ts): one index of every piece, checked when it is registered; what models are told
// follows maturity; every entry of the engine's own library is well formed, its file exists, its demo draws clean.
/// <reference types="vite/client" />
import { beforeAll, describe, expect, it } from 'vitest';
import { act_now, define, define_act, entries, entry_issues, for_models, load_tex, lookup, run_checks, is_figure, t, Figure, type Entry } from '../src/index';
import { use_node_canvas, render_figure } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});
// (the engine's files, by their path from the repository root: an entry's source must be one of them)
const sources = new Set(Object.keys(import.meta.glob('../src/**/*.ts')).map((f) => f.replace('../src/', 'packages/engine/src/')));
const base = (o: Partial<Entry> = {}): Entry => ({ kind: 'thing', name: 'test_piece', says: t('a piece', '一件东西'), zones: ['figure'], maturity: 'stable', since: '0.3.0', syntax: 'new TestPiece()', source: 'test/registry.test.ts', ...o });

describe('the registry', () => {
  it('refuses a malformed entry, saying what is wrong', () => {
    expect(entry_issues(base({ name: 'BadName' })).join()).toContain('snake_case');
    expect(entry_issues(base({ says: { en: 'x', zh: '' } })).join()).toContain('both languages');
    expect(entry_issues(base({ since: 'soon' })).join()).toContain('version');
    expect(() => define(base({ name: 'Nope' }))).toThrow(/snake_case/);
  });
  it('a name is one piece: another file may not take it, the same file may register again', () => {
    define(base({ name: 'test_once' }));
    expect(() => define(base({ name: 'test_once', source: 'elsewhere.ts' }))).toThrow(/taken by/);
    expect(() => define(base({ name: 'test_once', says: t('again', '再一次') }))).not.toThrow();
    expect(lookup('thing', 'test_once')!.says.en).toBe('again');
  });
  it('an old name still finds the piece', () => {
    define(base({ name: 'test_new_name', aliases: ['test_old_name'] }));
    expect(lookup('thing', 'test_old_name')?.name).toBe('test_new_name');
    expect(entries({ kind: 'thing' }).filter((e) => e.name === 'test_new_name')).toHaveLength(1);
  });
  it('models are told by maturity: the tutor stable pieces, authors also preview ones, nobody experiments', () => {
    define(base({ kind: 'demo_kind', name: 'stable_one' }));
    define(base({ kind: 'demo_kind', name: 'preview_one', maturity: 'preview' }));
    define(base({ kind: 'demo_kind', name: 'experiment_one', maturity: 'experiment' }));
    define(base({ kind: 'demo_kind', name: 'internal_one', internal: true }));
    expect(for_models('demo_kind', 'tutor').map((e) => e.name)).toEqual(['stable_one']);
    expect(for_models('demo_kind', 'author').map((e) => e.name)).toEqual(['stable_one', 'preview_one']);
    expect(entries({ kind: 'demo_kind', audience: 'gallery' }).map((e) => e.name)).toContain('experiment_one');
  });
  it('acceptance runs as code', async () => {
    define(base({ name: 'test_checked', checks: [{ name: 'holds', run: () => null }, { name: 'fails', run: () => 'off by one' }] }));
    expect(await run_checks([lookup('thing', 'test_checked')!])).toEqual(['thing/test_checked · fails: off by one']);
  });
  it('a new tutor act is one entry: checked, done and recorded like the built-in ones', () => {
    define_act({ name: 'test_glow', says: t('glow', '发光'), zones: ['figure'], maturity: 'experiment', since: '0.3.0', syntax: 'ACT: test_glow <id>', source: 'test/registry.test.ts', check: (fig, a) => (fig.registry.get(String(a.id)) ? null : `no '${a.id}'`), now: (fig) => { (fig as Figure & { glowed?: boolean }).glowed = true; } });
    const fig = new Figure();
    const P = fig.plot({ id: 'p', x: [0, 1], y: [0, 1] });
    fig.layout(P);
    fig.build();
    expect(act_now(fig, { op: 'test_glow', id: 'nothing' }).why).toBe("no 'nothing'");
    const r = act_now(fig, { op: 'test_glow', id: 'p' });
    expect(r.ok).toBe(true);
    expect((fig as Figure & { glowed?: boolean }).glowed).toBe(true);
    expect(act_now(fig, { op: 'never_defined' }).why).toContain('unknown act');
  });
});

describe('the engine\'s own library', () => {
  const own = () => entries().filter((e) => e.source.startsWith('packages/engine/'));
  it('has its pieces: things, motions, gestures and acts', () => {
    const kinds = new Set(own().map((e) => e.kind));
    for (const k of ['thing', 'motion', 'gesture', 'act']) expect(kinds.has(k), k).toBe(true);
    for (const n of ['plot', 'path', 'steps', 'parts', 'trail', 'cases', 'gap', 'vector_field']) expect(lookup('thing', n), n).toBeTruthy();
    expect(lookup('gesture', 'point')).toBeTruthy();
    expect(lookup('thing', 'development')?.name).toBe('cases');
  });
  it('every entry is well formed and names a file that exists', () => {
    for (const e of own()) {
      expect(entry_issues(e), e.name).toEqual([]);
      expect(sources.has(e.source), e.source).toBe(true);
    }
  });
  it('every demo draws, in both languages, without a layout error', () => {
    for (const e of own().filter((x) => x.demo))
      for (const lang of ['en', 'zh'] as const) {
        const fig = e.demo!(lang);
        expect(is_figure(fig), e.name).toBe(true);
        const f = fig as Figure;
        render_figure(f, 640);
        const errors = f.lint().filter((i) => i.severity === 'error');
        expect(errors, `${e.kind}/${e.name} ${lang}`).toEqual([]);
      }
  });
  it('their acceptance checks hold', async () => {
    expect(await run_checks(own())).toEqual([]);
  });
});
