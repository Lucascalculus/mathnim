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

for (const name of ['mgmt_tree', 'mgmt_normal'])
  describe(name, () => {
    const v = get_visual(name)!;
    it('is an engine visual', () => expect(v.engine).toBe(true));
    for (const lang of ['en', 'zh'] as const)
      it(`lints clean at every example (${lang})`, () => {
        for (const ex of v.examples ?? [{}]) {
          const fig = v.scene(check_params(v, { ...(ex as Record<string, unknown>), lang }).params);
          if (!is_figure(fig)) throw new Error('not a figure');
          const errors = lint_figure(fig).filter((i) => i.severity === 'error').map((i) => `[${i.size} @${i.time.toFixed(1)}] ${i.message}`);
          expect(errors, JSON.stringify(ex)).toEqual([]);
        }
      });
  });

describe('mgmt_tree: the numbers', () => {
  const v = get_visual('mgmt_tree')!;
  const make = (p: Record<string, unknown>) => {
    const fig = v.scene(check_params(v, p).params);
    if (!is_figure(fig)) throw new Error('not a figure');
    lint_figure(fig);
    return fig as import('../src/mgmt/decision_tree').TreeFigure;
  };
  it('carpool: 26.6 minutes, expressway unless it rains; below P(open | overcast) = 0.75 the overcast route flips', () => {
    const fig = make({});
    expect(fig.report()).toMatchObject({ tree: 'carpool', prob: 0.79, strategy: ['EW', 'EW', 'QC'] });
    expect(fig.report().value).toBeCloseTo(26.631, 9);
    expect(fig.labels.find((l) => l.id === 'value_0')!.text('en')).toBe('26.6');
    fig.set_prob(0.7);
    expect(fig.report().strategy).toEqual(['EW', 'QC', 'QC']);
    expect(fig.labels.find((l) => l.id === 'value_0')!.text('en')).toBe('26.8');
  });
  it('PDC: 15.93 with the study (large if favourable, medium if not); at P(strong | favourable) = 0.8 the study is not worth it', () => {
    const fig = make({ tree: 'pdc' });
    expect(fig.report()).toMatchObject({ tree: 'pdc', strategy: ['Conduct', 'Large', 'Medium', 'Large'] });
    expect(fig.labels.find((l) => l.id === 'value_0')!.text('en')).toBe('15.93');
    fig.set_prob(0.8);
    expect((fig.report().strategy as string[])[0]).toBe('No study');
    expect(fig.labels.find((l) => l.id === 'value_0')!.text('en')).toBe('14.2');
  });
});

describe('mgmt_normal: the paper\'s numbers', () => {
  const v = get_visual('mgmt_normal')!;
  const answer = (p: Record<string, unknown>) => {
    const fig = v.scene(check_params(v, p).params);
    if (!is_figure(fig)) throw new Error('not a figure');
    lint_figure(fig);
    return { r: fig.report(), text: fig.registry.get('answer')!.text('en') };
  };
  it('(i) P(X < 380,000) = 0.0681', () => {
    const { r, text } = answer({});
    expect([r.z_lo, r.area]).toEqual([-1.49, 0.0681]);
    expect(text).toContain('0.0681');
  });
  it('(ii) P(370,000 < X < 450,000) = 0.9821 − 0.0228 = 0.9593', () => {
    const { r, text } = answer({ mode: 'between', a: 370000, b: 450000 });
    expect(r.area).toBe(0.9593);
    expect(text).toContain('0.9821 − 0.0228');
    expect(text).toContain('0.9593');
  });
  it('(iii) the lower 10%: $384,040; (iv) P(385,000 < X < d) = 0.4503: d = $411,925', () => {
    expect(answer({ mode: 'find', p: 0.1 }).text).toContain('$384,040');
    const { r, text } = answer({ mode: 'find', p: 0.4503, from: 385000 });
    expect([r.target, r.z_hi]).toEqual([0.5596, 0.15]);
    expect(text).toContain('$411,925');
  });
  it('the tyre: P(X > 40,000) = 1 − 0.7580 = 0.2420 (no dollar sign: miles)', () => {
    const { r, text } = answer({ mu: 36500, sd: 5000, unit: '', mode: 'right', a: 40000 });
    expect(r.area).toBe(0.242);
    expect(text).toContain('1 − 0.7580');
  });
});
