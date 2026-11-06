// The MGMT90141 engine figures: every example lints clean (wide and phone, at the end of every section of the script),
// and the figure's numbers are the lecturer's.
import { beforeAll, describe, expect, it } from 'vitest';
import { is_figure, load_tex } from '@mathnim/engine';
import { lint_figure } from '../../engine/node';
import { check_params, get_visual } from '../src';
import '../src/mgmt';

beforeAll(async () => {
  await load_tex();
});

describe('mgmt_lp_plane', () => {
  const v = get_visual('mgmt_lp_plane')!;
  it('is an engine visual', () => expect(v.engine).toBe(true));
  for (const lang of ['en', 'zh'] as const)
    it(`lints clean at every example (${lang})`, () => {
      for (const ex of v.examples ?? [{}]) {
        const fig = v.scene(check_params(v, { ...(ex as Record<string, unknown>), lang }).params);
        expect(is_figure(fig)).toBe(true);
        if (!is_figure(fig)) continue;
        const errors = lint_figure(fig).filter((i) => i.severity === 'error').map((i) => `[${i.size} @${i.time.toFixed(1)}] ${i.message}`);
        expect(errors, JSON.stringify(ex)).toEqual([]);
      }
    });
  it('reports the lecturer\'s best plan', () => {
    const fig = v.scene(check_params(v, { story: 'shown', tool: 'plan', plan: [30, 40] }).params);
    if (!is_figure(fig)) throw new Error('not a figure');
    const r = fig.report();
    expect(r.best).toEqual([30, 40]);
    expect(r.best_value).toBeCloseTo(410, 9);
    expect(r.allowed).toBe(true);
  });
});
