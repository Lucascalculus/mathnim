// tangent_develop with predict: the learner tilts a hollow line through P to the slope they expect; letting go
// develops the fan; the tangent turns solid and the gap in slope is said; the tangent is not shown before the guess.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { load_tex, type Figure, type Gap, type Handle } from '@mathnim/engine';
import { use_node_canvas } from '../../engine/node';
import { check_params, get_visual } from '../src';
import { set_ft_lang } from '../src/ft/f/kit';

beforeAll(async () => {
  use_node_canvas();
  set_ft_lang('en');
  await load_tex();
});

function make(params: Record<string, unknown> = {}) {
  const v = get_visual('tangent_develop')!;
  const fig = v.scene(check_params(v, { predict: true, ...params }).params) as Figure;
  const reports: Record<string, unknown>[] = [];
  fig.listen((type, r) => { if (type === 'report') reports.push(r); });
  fig.build();
  fig.layout_for(720, 400);
  fig.at(fig.duration);
  return { fig, reports, handle: fig.handles[0] as Handle, gap: fig.registry.get('gap') as Gap, tm: fig.sims[0] };
}
const draw = (fig: Figure) => { const c = createCanvas(720, 400); fig.draw(c.getContext('2d') as never, 1, { force: true }); return c; };

describe('tangent_develop: guess the slope, then see it develop', () => {
  it('before the guess the tangent is not drawn and nothing has developed', () => {
    const { fig, tm } = make();
    draw(fig);
    expect(tm.clock.value).toBe(0);
    expect(fig.registry.get('tangent')!.box.w).toBe(0);
  });
  it('letting go develops it; then the gap in slope is said and the lesson heard the guess', () => {
    const { fig, reports, handle, gap, tm } = make();
    // (f = 0.15x³ − 0.9x + 0.6 at −2: the slope is 0.9; the hand tilts the line to slope 0.3)
    const y0 = 0.15 * -8 + 1.8 + 0.6, ring = fig.registry.get('slope_guess') as unknown as { pos: () => [number, number] }, dx = ring.pos()[0] + 2;
    handle.px.set(handle.o.to!([0, y0 + 0.3 * dx])[0]);
    handle.o.on_end!();
    expect(reports).toEqual([{ kind: 'answer', item: 'slope_guess', correct: false, response: '0.3' }]);
    draw(fig);
    expect(gap.text()).toBe('');
    tm.advance(5.1);
    draw(fig);
    expect(gap.text()).toBe('slope off by 0.60');
    expect(fig.registry.get('tangent')!.box.w).toBeGreaterThan(0);
  });
  it('a close guess is right', () => {
    const { fig, handle, gap, tm } = make({ fn: 'x^2', x0: 1, lang: 'zh' });
    // (slope 2 at 1: a little steeper than 2, within the tolerance)
    const ring = fig.registry.get('slope_guess') as unknown as { pos: () => [number, number] }, dx = ring.pos()[0] - 1;
    handle.px.set(handle.o.to!([0, 1 + 2.05 * dx])[0]);
    handle.o.on_end!();
    tm.advance(5.1);
    draw(fig);
    expect(gap.text()).toBe('对了');
  });
});
