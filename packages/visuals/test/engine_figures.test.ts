// The visuals made with @mathnim/engine: every example lints clean at both sizes (wide and phone) at the end of every
// section of its script, and keeps its own invariants (lint_figure runs them).
import { beforeAll, describe, expect, it } from 'vitest';
import { is_figure, load_tex } from '@mathnim/engine';
import { lint_figure } from '../../engine/node';
import { check_params, get_visual, list_visuals } from '../src';
import '../src/mpc';
import '../src/ft/b';
import { set_ft_lang } from '../src/ft/f/kit';

beforeAll(async () => {
  await load_tex();
});

describe('engine figures', () => {
  const names = ['mpc_qp_plane', 'mpc_shift_tail', 'determinant_area', 'training_curves'];
  it('are registered as engine visuals', () => {
    for (const n of names) expect(get_visual(n)?.engine, n).toBe(true);
    expect(list_visuals().filter((v) => v.engine).map((v) => v.name).sort()).toEqual([...names].sort());
  });
  for (const n of names)
    for (const lang of ['en', 'zh'] as const)
      it(`${n} (${lang}) lints clean at every example`, () => {
        set_ft_lang(lang);
        const v = get_visual(n)!;
        for (const ex of v.examples ?? [{}]) {
          const fig = v.scene(check_params(v, ex as Record<string, unknown>).params);
          expect(is_figure(fig)).toBe(true);
          if (!is_figure(fig)) continue;
          const errors = lint_figure(fig).filter((i) => i.severity === 'error').map((i) => `[${i.size} @${i.time.toFixed(1)}] ${i.message}`);
          expect(errors, `${n} ${JSON.stringify(ex)}`).toEqual([]);
        }
        set_ft_lang(null);
      });
});
