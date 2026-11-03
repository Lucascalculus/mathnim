import { describe, expect, it, beforeAll } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import {
  Column, Field, Figure, FigurePlayer, Marker, Path, Plot, Row, TextBlock, beat, column, derive, load_tex, param, place_label, quadratic, read, reveal, row,
  set, settle_time, spring_step, t, track, untracked, wait, watch_writes, now_version,
} from '../src/index';
import { use_node_canvas, lint_figure, render_figure } from '../node';
import { look } from '@mathnim/look';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

describe('state', () => {
  it('recomputes a derived value only when what it read changed, in dependency order', () => {
    const a = param(1), b = param(2);
    let runs = 0;
    const s = derive(() => (runs++, a.value + b.value));
    const s2 = derive(() => s.value * 10);
    expect(s2.value).toBe(30);
    expect(s2.value).toBe(30);
    expect(runs).toBe(1);
    a.set(5);
    expect(s2.value).toBe(70);
    expect(runs).toBe(2);
    b.set(2); // same value: nothing changes
    expect(s2.value).toBe(70);
    expect(runs).toBe(2);
  });
  it('clamps to the range and snaps to the step (unless exact)', () => {
    const p = param(0, { range: [0, 1], step: 0.25 });
    p.set(0.3);
    expect(p.peek()).toBe(0.25);
    p.set(0.3, true);
    expect(p.peek()).toBe(0.3);
    p.set(7);
    expect(p.peek()).toBe(1);
  });
  it('tracks what a function reads, and tells watchers about writes', () => {
    const a = param(1), b = param(2);
    const { deps } = track(() => a.value + untracked(() => b.value));
    expect(deps).toEqual([a]);
    let n = 0;
    const off = watch_writes(() => n++);
    a.set(3);
    off();
    a.set(4);
    expect(n).toBe(1);
    expect(read(() => a.value * 2)).toBe(8);
  });
});

describe('script', () => {
  it('springs go from 0 to 1 and settle', () => {
    expect(spring_step(0, 1, 1)).toBe(0);
    expect(spring_step(5, 1, 1)).toBeCloseTo(1, 6);
    const T = settle_time(0.55, 1);
    expect(Math.abs(1 - spring_step(T, 0.55, 1))).toBeLessThan(0.005);
  });
  it('seeking is a pure function of time, in any order', () => {
    const f = new Figure();
    const x = f.param('x', 0, { range: [0, 10] });
    const P = f.plot({ x: [0, 10], y: [0, 1] });
    const m = P.add(new Marker(() => [x.value, 0.5], { id: 'm' }));
    f.layout(column([P]));
    f.script(reveal(m), set(x, 4, 'travel', 1), beat(), set(x, 9, 'travel', 2), wait(0.5));
    f.build();
    f.at(1.2);
    const mid = [x.peek(), m.opacity.peek()];
    f.at(f.duration);
    expect(x.peek()).toBeCloseTo(9, 9);
    f.at(0);
    expect(x.peek()).toBe(0);
    expect(m.opacity.peek()).toBe(0);
    f.at(1.2);
    expect([x.peek(), m.opacity.peek()]).toEqual(mid);
    expect(f.section_starts().length).toBe(1);
  });
});

describe('layout', () => {
  const lt = () => ({ look: look(), lang: 'en' as const, phone: false });
  it('puts a row side by side, and in a column on a phone', () => {
    const a = new TextBlock('left words', { id: 'a' }), b = new TextBlock('right words', { id: 'b' });
    const r = new Row([a, b]);
    r.arrange({ x: 0, y: 0, w: 600, h: 200 }, lt());
    expect(a.box.y).toBe(b.box.y);
    expect(b.box.x).toBeGreaterThan(a.box.x + a.box.w - 1);
    r.arrange({ x: 0, y: 0, w: 300, h: 400 }, { ...lt(), phone: true });
    expect(b.box.y).toBeGreaterThan(a.box.y);
    expect(a.box.x).toBe(b.box.x);
  });
  it('shrinks the lowest priority first', () => {
    const big = new Plot({ id: 'big', x: [0, 1], y: [0, 1], aspect: 'equal', priority: 2 });
    const small = new Plot({ id: 'small', x: [0, 1], y: [0, 1], aspect: 'equal' });
    new Column([big, small]).arrange({ x: 0, y: 0, w: 400, h: 600 }, lt());
    expect(big.data.h).toBeGreaterThan(small.data.h);
  });
  it('places a label where it hides nothing, and says why', () => {
    const p = place_label([100, 100], 40, 12, { gap: 6, bounds: { x: 0, y: 0, w: 400, h: 400 }, obstacles: [{ o: { box: { x: 104, y: 70, w: 60, h: 28 } }, owner: 'other' }] });
    expect(p.side).not.toBe('above-right');
    expect(p.why).toContain('not above-right (hits other)');
  });
});

describe('figure', () => {
  const small_figure = () => {
    const f = new Figure();
    const a = f.param('a', 1, { range: [0, 2] });
    const P = f.plot({ id: 'p', x: [0, 2], y: [0, 4], x_ticks: [0, 1, 2], y_ticks: [0, 2, 4] });
    const curve = P.add(new Path(() => Array.from({ length: 21 }, (_, i) => [i / 10, a.value * (i / 10) ** 2] as [number, number]), { id: 'curve', role: 'noun:plan' }));
    const dot = P.add(new Marker(() => [1, a.value], { id: 'dot', role: 'noun:plan' }));
    f.label('y = a x²', dot, { id: 'dot_word' });
    f.layout(row([P, column([f.caption(t('一条抛物线', 'a parabola'), { id: 'cap' })])]));
    f.script(reveal(curve, dot), set(a, 2));
    return { f, a };
  };
  it('draws only when something changed', () => {
    const { f, a } = small_figure();
    f.build();
    f.layout_for(640, 360);
    f.at(f.duration);
    const g = createCanvas(640, 360).getContext('2d') as unknown as CanvasRenderingContext2D;
    expect(f.draw(g, 1)).toBe(true);
    expect(f.draw(g, 1)).toBe(false);
    a.set(1.5);
    expect(f.draw(g, 1)).toBe(true);
    expect(f.renderer.stats.skipped).toBe(1);
    void now_version;
  });
  it('lints clean wide and on a phone, and describes and explains itself', () => {
    const { f } = small_figure();
    const issues = lint_figure(f).filter((i) => i.severity === 'error');
    expect(issues).toEqual([]);
    expect(f.describe()).toContain('curve: path role=noun:plan');
    expect(f.explain('dot_word')).toContain('attached to dot');
  });
  it('the lint finds text that is too small and words that overlap', () => {
    const f = new Figure();
    const a = new TextBlock('one', { id: 'one' }), b = new TextBlock('two', { id: 'two' });
    f.layout(column([a, b]));
    f.build();
    f.layout_for(300, 200);
    b.box = { ...a.box }; // force an overlap
    const g = createCanvas(300, 200).getContext('2d') as unknown as CanvasRenderingContext2D;
    f.draw(g, 1, { force: true });
    expect(f.lint().map((i) => i.rule)).toContain('overlap');
  });
});

describe('gpu field (the CPU tier)', () => {
  it('computes the same formula as its shader and draws a tint with level lines', () => {
    const k = quadratic([0, 0, 1, 0, 1]);
    expect(k.cpu(3, 4, new Float32Array([0, 0, 1, 0, 1]))).toBeCloseTo(5, 6);
    const f = new Figure();
    const P = f.plot({ id: 'p', x: [-2, 2], y: [-2, 2], aspect: 'equal' });
    const field = P.add(new Field(k, { id: 'bowl', role: 'noun:cost', levels: [1], range: [0, 2], fill: 0.4, line: 1 }));
    f.layout(column([P]));
    const c = render_figure(f, 300, 300);
    expect(field.last.tier).toBe('cpu');
    const d = c.getContext('2d').getImageData(Math.round(P.X(0)), Math.round(P.Y(0)), 1, 1).data;
    // the centre of the bowl is tinted cobalt (more blue than red)
    expect(d[2]).toBeGreaterThan(d[0] + 20);
  });
});

describe('player', () => {
  it('plays on the voice clock: a section waits for its beat', async () => {
    const f = new Figure();
    const x = f.param('x', 0, { range: [0, 10] });
    const P = f.plot({ x: [0, 10], y: [0, 1] });
    P.add(new Marker(() => [x.value, 0.5], { id: 'm' }));
    f.layout(column([P]));
    f.script(set(x, 4, 'travel', 1), beat(), set(x, 9, 'travel', 1));
    const c = createCanvas(320, 180);
    const p = new FigurePlayer(f, c as unknown as OffscreenCanvas, { size: { w: 320, h: 180 }, tex: false });
    await p.load();
    expect(p.duration).toBeCloseTo(2, 1);
    p.wait_for([3], 5);
    // the section after the beat starts when the voice reaches it (3 s), and the picture holds until the voice ends
    expect(p.fig_time(2)).toBeCloseTo(1, 6);
    expect(p.fig_time(3.5)).toBeCloseTo(1.5, 6);
    expect(p.duration).toBeGreaterThanOrEqual(5);
    p.seek_time(3.5);
    expect(x.peek()).toBeGreaterThan(4);
    expect(x.peek()).toBeLessThan(9);
    p.show_end();
    expect(x.peek()).toBeCloseTo(9, 9);
    p.release();
  });
});

describe('nice ticks', () => {
  it('chooses round steps', async () => {
    const { nice_ticks } = await import('../src/index');
    expect(nice_ticks(0, 12, 6)).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(nice_ticks(0, 35, 5)).toEqual([0, 10, 20, 30]);
    expect(nice_ticks(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });
});
