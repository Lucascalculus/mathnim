// Guess, then see (guess.ts): a guess is committed by letting go, once, and the lesson hears it; a replay starts it
// again; the gap between guess and truth is drawn with its size in words; a timer runs a reveal in explore.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { Figure, Gap, column, guess, load_tex, reveal, timer, wait } from '../src/index';
import { use_node_canvas } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

function make() {
  const fig = new Figure();
  const P = fig.plot({ id: 'p', x: [0, 10], y: [-2, 2], axes: 'none', grid: false });
  const v = fig.param('v', 2, { range: [0, 10] });
  const g = guess(fig, P, v, { id: 'land', role: 'noun:cost', at: (x) => [x, 0], to: (d) => d[0], truth: 6, tolerance: 0.5, says: { en: 'where it lands', zh: '落点' } });
  const shown = fig.param('shown', 0, { range: [0, 1] });
  const gap = P.add(new Gap(() => [g.guessed.value, -1], () => [6, -1], { id: 'gap', role: 'noun:cost', shown, text: () => `${Math.abs(g.error.value).toFixed(1)} short` }));
  const reports: unknown[] = [];
  fig.listen((type, r) => { if (type === 'report') reports.push(r); });
  fig.layout(column([P]));
  fig.script(g.fresh(), reveal(P), wait(1));
  fig.build();
  fig.layout_for(500, 200);
  return { fig, P, v, g, gap, shown, reports };
}
/** The hand: drag to a value and let go. */
const drag = (g: ReturnType<typeof make>['g'], to: number) => { g.handle.px.set(g.handle.o.to!([to, 0])[0]); g.handle.o.on_end!(); };

describe('guess, then see', () => {
  it('letting go commits the guess, once, and the lesson hears it (right within the tolerance)', () => {
    const { g, reports } = make();
    expect(g.committed.value).toBe(0);
    drag(g, 5.7);
    expect(g.committed.value).toBe(1);
    expect(g.guessed.value).toBeCloseTo(5.7);
    expect(g.right.value).toBe(true);
    expect(reports).toEqual([{ kind: 'answer', item: 'land', correct: true, response: '5.7' }]);
    // (a second drag moves nothing: a guess is made once)
    drag(g, 1);
    expect(g.guessed.value).toBeCloseTo(5.7);
    expect(reports.length).toBe(1);
  });
  it('once made, the guess has no glass on it; a replay brings it back', () => {
    const { fig, g } = make();
    expect(g.handle.o.look).toBeUndefined();
    drag(g, 4);
    expect(g.handle.o.look).toBe('none');
    fig.at(0);
    expect(g.handle.o.look).toBeUndefined();
  });
  it('letting go without moving is not a guess', () => {
    const { g, reports } = make();
    g.handle.o.on_end!();
    expect(g.committed.value).toBe(0);
    expect(reports.length).toBe(0);
  });
  it('a wrong guess is heard as wrong; what the hand does after it (the keys) does not change it', () => {
    const { g, reports } = make();
    drag(g, 3);
    expect(reports[0]).toMatchObject({ correct: false, response: '3' });
    g.handle.nudge(1, 0);
    expect(g.guessed.value).toBe(3);
    expect(g.error.value).toBe(-3);
  });
  it('commit runs what the figure says showing the answer is', () => {
    const { g } = make();
    let shown = 0;
    g.on_commit(() => shown++);
    drag(g, 4);
    expect(shown).toBe(1);
  });
  it('a replay starts the guess again (fresh() names its params to the script)', () => {
    const { fig, g } = make();
    drag(g, 4);
    fig.at(0);
    expect(g.committed.value).toBe(0);
    expect(g.guessed.value).toBe(2);
    drag(g, 7);
    expect(g.guessed.value).toBeCloseTo(7);
  });
  it('the guess is a hollow ring; the gap is drawn and said only when shown', () => {
    const { fig, P, g, gap, shown } = make();
    drag(g, 3);
    const c = createCanvas(500, 200), ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    fig.at(1); // (revealed)
    // (fig.at resets the guess: make it again after the seek)
    drag(g, 3);
    fig.draw(ctx, 1, { force: true });
    const ink = (x: number, y: number) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return 255 - (d[0] + d[1] + d[2]) / 3; };
    const [rx, ry] = P.P([3, 0]);
    expect(ink(rx, ry)).toBeLessThan(15);           // hollow: paper in the middle
    expect(ink(rx + 7, ry)).toBeGreaterThan(60);    // the ring
    const [mx, my] = P.P([4.5, -1]);
    expect(ink(mx, my)).toBeLessThan(15);           // no gap yet
    expect(gap.text()).toBe('');
    shown.set(1);
    fig.draw(ctx, 1, { force: true });
    expect(ink(mx, my)).toBeGreaterThan(60);        // the gap's line
    expect(gap.text()).toBe('3.0 short');
    expect(gap.box.w).toBeGreaterThan(P.P([6, 0])[0] - P.P([3, 0])[0]);
  });
  it('a timer runs 0 → 1 over its length once played, as a sim (seekable)', () => {
    const fig = new Figure();
    const tm = timer(fig, 'reveal', 0.5);
    expect(tm.t.value).toBe(0);
    tm.play();
    expect(tm.sim.running.value).toBe(1);
    tm.sim.advance(0.25);
    expect(tm.t.value).toBeCloseTo(0.5, 1);
    tm.sim.advance(1);
    expect(tm.t.value).toBe(1);
    expect(tm.sim.running.value).toBe(0);
  });
});
