// phys_throw with predict: the throw waits for the learner's guess of where it lands; letting go throws it; at the
// landing the gap from the guess is drawn and said, and the lesson hears the guess.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { load_tex, type Figure, type Gap, type Handle } from '@mathnim/engine';
import { use_node_canvas } from '../../engine/node';
import { check_params, get_visual } from '../src';
import '../src/physics';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

function make(params: Record<string, unknown> = {}) {
  const v = get_visual('phys_throw')!;
  const fig = v.scene(check_params(v, { predict: true, ...params }).params) as Figure;
  const reports: Record<string, unknown>[] = [];
  fig.listen((type, r) => { if (type === 'report') reports.push(r); });
  fig.build();
  fig.layout_for(720, 400);
  fig.at(fig.duration);
  return { fig, reports, handle: fig.handles[0] as Handle, gap: fig.registry.get('gap') as Gap, sim: fig.sims[0] };
}
const draw = (fig: Figure) => { const c = createCanvas(720, 400); fig.draw(c.getContext('2d') as never, 1, { force: true }); };

describe('phys_throw: guess where it lands, then see', () => {
  it('the throw waits for the guess: the script does not run it', () => {
    const { sim } = make();
    expect(sim.clock.value).toBe(0);
  });
  it('letting go throws it; at the landing the gap is said, and the lesson heard the guess', () => {
    const { fig, reports, handle, gap, sim } = make();
    // (7 m/s at 60°: it lands at 4.33 m; the guess is 3 m)
    handle.px.set(handle.o.to!([3, 0])[0]);
    handle.o.on_end!();
    expect(reports).toEqual([{ kind: 'answer', item: 'landing', correct: false, response: '3' }]);
    expect(sim.running.value).toBe(1);
    draw(fig);
    expect(gap.text()).toBe(''); // (in the air: nothing said yet)
    sim.advance(2.2);
    draw(fig);
    expect(gap.text()).toBe('1.33 m short');
  });
  it('a guess within the tolerance is right, in Chinese too', () => {
    const { fig, reports, handle, sim, gap } = make({ lang: 'zh' });
    handle.px.set(handle.o.to!([4.3, 0])[0]);
    handle.o.on_end!();
    expect(reports[0]).toMatchObject({ correct: true });
    sim.advance(2.2);
    draw(fig);
    expect(gap.text()).toBe('正中');
  });
  it('a replay puts the ball back and asks again', () => {
    const { fig, handle, sim } = make();
    handle.px.set(handle.o.to!([5, 0])[0]);
    handle.o.on_end!();
    sim.advance(1);
    fig.at(0);
    expect(sim.clock.value).toBe(0);
    expect(sim.running.value).toBe(0);
    expect((fig.params.get('landing.committed')!).value).toBe(0);
  });
});
