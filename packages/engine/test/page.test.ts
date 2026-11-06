// The page (kernel/page.ts): shared values and formulas, bindings both ways, nouns and attention across zones, the
// one light, the tutor's acts routed, reports in one log, snapshot and restore; and a figure as a zone
// (kernel/zone_figure.ts): its anchors, its focus, a formula's symbols as anchors of their own.
import { createCanvas } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import { FigurePlayer, Marker, Page, Path, figure_zone, load_tex, steps_figure, Figure, row, type Attention, type Zone } from '../src/index';
import { use_node_canvas } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A zone that only records what it is told. */
function fake(id: string, kind: string, nouns: [string, string, number][]): Zone & { seen: Attention[] } {
  const seen: Attention[] = [];
  return { id, kind, seen, anchors: () => nouns.map(([noun, aid, size]) => ({ noun, id: aid, size })), attend: (a) => void seen.push(a), act: (a) => (a.op === 'wave' ? { ok: true } : { ok: false, why: 'cannot' }) };
}

describe('a page', () => {
  it('shares values, and formulas follow them (NaN until what they read is on the page)', () => {
    const page = new Page('en');
    const f = page.formula('2.5*n');
    expect(Number.isNaN(f.value)).toBe(true);
    page.value('n', 3, { range: [1, 12], step: 1 });
    expect(f.value).toBe(7.5);
    page.set('n', 4);
    expect(f.value).toBe(10);
    expect(page.depends('2.5*n + k')).toEqual(['n']);
  });
  it('binds a zone\'s param to a shared value, both ways', () => {
    const page = new Page('en'), fig = new Figure();
    const a = fig.param('a', 1, { range: [0, 10] });
    page.value('n', 3);
    const unbind = page.bind('n', a);
    expect(a.peek()).toBe(3);
    a.set(7);
    expect(page.values.get('n')!.peek()).toBe(7);
    page.set('n', 2);
    expect(a.peek()).toBe(2);
    unbind();
    page.set('n', 5);
    expect(a.peek()).toBe(2);
  });
  it('the hand on a noun reaches every zone; the light goes to the most particular drawn thing', () => {
    const page = new Page('en');
    const text = fake('text', 'text', [['ball', 'w1', 900]]), fig = fake('fig', 'figure', [['ball', 'curve', 5000], ['ball', 'dot', 200]]);
    page.attach(text);
    page.attach(fig);
    page.hover('ball', 'text');
    expect(fig.seen.at(-1)!.hover).toBe('ball');
    expect(text.seen.at(-1)!.from).toBe('text');
    expect(page.point({ noun: 'ball' })).toEqual({ zone: 'fig', id: 'dot' });
    expect(page.point({ noun: 'ball' }, { prefer: 'text' })).toEqual({ zone: 'text', id: 'w1' });
    expect(page.point({ noun: 'nothing' })).toBeNull();
    expect(page.find('ball').map((x) => x.id)).toEqual(['dot', 'w1', 'curve']);
  });
  it('routes the tutor\'s acts, sets shared values, and says why when it cannot', () => {
    const page = new Page('en');
    page.attach(fake('fig', 'figure', []));
    page.value('n', 3, { range: [1, 12] });
    expect(page.act({ op: 'set', param: 'n', to: 8 })).toEqual({ ok: true, zone: 'page' });
    expect(page.values.get('n')!.peek()).toBe(8);
    expect(page.act({ op: 'wave' }).ok).toBe(true);
    expect(page.act({ op: 'wave', zone: 'nowhere' }).why).toContain("no zone 'nowhere'");
    expect(page.act({ op: 'point', noun: 'ghost' }).why).toContain("nothing on the page shows 'ghost'");
  });
  it('keeps one log of reports, and can be put back as it was', () => {
    const page = new Page('zh');
    page.tell('fig', { kind: 'answer', item: 'landing', correct: false, response: '3.2' });
    expect(page.log).toHaveLength(1);
    page.value('n', 3);
    page.hover('ball', 'text');
    const snap = page.snapshot();
    page.set('n', 9);
    page.hover(null);
    page.restore(snap);
    expect(page.values.get('n')!.peek()).toBe(3);
    expect(page.attention.hover).toBe('ball');
  });
  it('two zones with one id are both kept; detaching one puts its light out', () => {
    const page = new Page('en');
    const a = fake('figure', 'figure', [['x', 'p', 1]]), b = fake('figure', 'figure', [['y', 'q', 1]]);
    page.attach(a);
    page.attach(b);
    expect([...page.zones.keys()]).toEqual(['figure', 'figure_2']);
    page.point({ noun: 'y' });
    page.detach('figure_2');
    expect(page.attention.light).toBeNull();
  });
});

describe('a figure as a zone', () => {
  async function player_of(fig: Figure) {
    const c = createCanvas(480, 300);
    const p = new FigurePlayer(fig, c as unknown as OffscreenCanvas, { size: { w: 480, h: 300 }, tex: false, mirror: false });
    await p.load();
    p.show_end();
    return p;
  }
  function bowl() {
    const fig = new Figure();
    const P = fig.plot({ id: 'plane', x: [-2, 2], y: [0, 4] });
    P.add(new Path(() => Array.from({ length: 21 }, (_, i) => [-2 + i / 5, (-2 + i / 5) ** 2] as [number, number]), { id: 'curve', role: 'noun:cost' }));
    P.add(new Marker(() => [1, 1], { id: 'dot', role: 'noun:value' }));
    fig.layout(row([P]));
    return fig;
  }
  it('shows the nouns of its drawn things, and turns to the noun the hand is on', async () => {
    const fig = bowl(), p = await player_of(fig), page = new Page('en');
    const z = figure_zone(p, { id: 'bowl' });
    page.attach(z);
    expect(z.anchors().map((a) => `${a.noun}:${a.id}`).sort()).toEqual(['cost:curve', 'value:dot']);
    page.hover('value', 'text');
    expect(fig.focus.peek()).toBe('value');
    await sleep(320);
    expect(fig.focus_k.peek()).toBeCloseTo(1, 2);
    // (a noun it does not show: it turns back, rather than fading everything)
    page.hover('wall', 'text');
    await sleep(380);
    expect(fig.focus_k.peek()).toBeCloseTo(0, 2);
    expect(fig.focus.peek()).toBeNull();
  });
  it('knows the noun under a pointer: the point on a curve, not the curve\'s box', async () => {
    const fig = bowl();
    await player_of(fig);
    const P = fig.registry.get('plane') as unknown as { P(p: [number, number]): [number, number] };
    expect(fig.noun_at(P.P([1, 1]))).toBe('value');
    expect(fig.noun_at(P.P([-1.5, 2.25]))).toBe('cost');
    expect(fig.noun_at(P.P([-1.5, 3.8]))).toBeNull();
  });
  it('a formula\'s symbols are anchors of their own, each where it is drawn', async () => {
    const fig = steps_figure('2x + 3 = 11\n2x = 8\nx = 4', { nouns: { x: 'value' } });
    const p = await player_of(fig);
    const z = figure_zone(p);
    const xs = z.anchors().filter((a) => a.noun === 'value');
    expect(xs.length).toBeGreaterThan(0);
    const piece = fig.derivation.noun_pieces()[0];
    expect(fig.noun_at([piece.box.x + piece.box.w / 2, piece.box.y + piece.box.h / 2])).toBe('value');
  });
  it('the tutor acts through the page, by thing or by noun', async () => {
    const fig = bowl(), p = await player_of(fig), page = new Page('en');
    page.attach(figure_zone(p, { id: 'bowl' }));
    expect(page.act({ op: 'point', zone: 'bowl', id: 'dot' }).ok).toBe(true);
    expect(page.act({ op: 'point', noun: 'cost' })).toEqual({ ok: true, zone: 'bowl' });
    expect(page.act({ op: 'point', zone: 'bowl', id: 'ghost' }).why).toContain("no thing 'ghost'");
  });
});

describe('values changed in a batch', () => {
  it('the zones hear of them after the batch, when what is computed from them is current', async () => {
    const { batch_writes } = await import('../src/index');
    const page = new Page('en'), fig = new Figure();
    const a = fig.param('a', 1, { range: [0, 10] });
    page.bind('a', a);
    const f = page.formula('2*a');
    const heard: number[] = [];
    page.on((e) => { if (e.type === 'value') heard.push(f.value); });
    // (a script's seek: the param moves several times within one batch)
    batch_writes(() => { a.set(3, true); a.set(5, true); });
    await Promise.resolve();
    expect(heard).toEqual([10]);
  });
});
