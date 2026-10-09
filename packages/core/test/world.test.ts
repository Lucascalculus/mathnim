import { describe, expect, it } from 'vitest';
import { WorldSession, stars_by_time, type WorldOutput } from '../src/world';

const ctx = { vars: {}, rng: Math.random };
function session(spec: ConstructorParameters<typeof WorldSession>[0], clock = { t: 0 }) {
  const out: WorldOutput[] = [];
  const w = new WorldSession(spec, {} as any, ctx, (o) => out.push(o), () => clock.t);
  return { w, out, clock };
}

describe('WorldSession', () => {
  it('says only the lines whose condition holds', () => {
    const { w, out } = session({
      goals: [{ id: 'g', check: () => true }],
      lines: [
        { text: 'You called it.', when: 'goal', if: (world) => world.state.bet === 'big' },
        { text: 'The big one is twice the food.', when: 'goal', if: (world) => world.state.bet !== 'big' },
      ],
    });
    w.api.state.bet = 'small';
    w.input();
    expect(out.filter((o) => o.type === 'line').map((o) => (o as any).line.text)).toEqual(['The big one is twice the food.']);
  });

  it('announces each goal once and the last one as final, with stars', () => {
    const { w, out, clock } = session({
      goals: [
        { id: 'many', check: (_s, _c, world) => (world.state.n as number) >= 24, message: 'Many slices!' },
        { id: 'lined', check: (_s, _c, world) => world.state.u === 1 },
      ],
      stars: stars_by_time(30, 60),
    });
    w.api.state.n = 30;
    w.input();
    w.input();
    clock.t = 45_000;
    w.api.state.u = 1;
    w.input();
    const goals = out.filter((o) => o.type === 'goal') as Extract<WorldOutput, { type: 'goal' }>[];
    expect(goals.map((g) => [g.goal.id, g.final, g.stars])).toEqual([['many', false, undefined], ['lined', true, 2]]);
    expect(w.done).toBe(true);
    expect(w.stats().interactions).toBe(3);
  });

  it('turns events into findings through detectors, once per finding', () => {
    const { w, out } = session({
      detectors: [{ id: 'double', on: (e) => (e.type === 'guess' && e.data?.factor === 2 ? { kind: 'misconception', id: 'linear-scaling' } : null) }],
      lines: [{ text: 'Twice as wide - but how much more pizza?', when: { finding: 'linear-scaling' } }],
    });
    w.api.emit('guess', { factor: 2 });
    w.api.emit('guess', { factor: 2 });
    expect(out.filter((o) => o.type === 'finding')).toHaveLength(1);
    expect(out.filter((o) => o.type === 'semantic')).toHaveLength(2);
    expect(out.filter((o) => o.type === 'line').map((o) => (o as any).line.text)).toEqual(['Twice as wide - but how much more pizza?']);
    expect(w.stats().misconceptions).toBe(1);
  });

  it('says enter, event and idle lines at the right times', () => {
    const { w, out, clock } = session({
      lines: [
        { text: 'Cut it!', when: 'enter' },
        { text: 'Try the slider.', when: 'idle' },
        { text: 'Sharp knife.', when: { event: 'cut' } },
      ],
      idle_s: 10,
    });
    w.start();
    clock.t = 5_000;
    w.tick();
    clock.t = 11_000;
    w.tick();
    w.api.emit('cut');
    w.stop();
    expect(out.filter((o) => o.type === 'line').map((o) => (o as any).line.text)).toEqual(['Cut it!', 'Try the slider.', 'Sharp knife.']);
  });
});
