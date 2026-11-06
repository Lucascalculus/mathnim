import { describe, expect, it, beforeAll } from 'vitest';
// @ts-ignore (node's fs: the test writes a picture to look at)
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import {
  Column, Field, Figure, FigurePlayer, Marker, Path, Plot, Row, TextBlock, act_now, beat, check_act, column, tex_to_text, derive, load_tex, manifest_of, param, place, place_label, quadratic, read, reveal, row,
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
    f.layout(row([P, column([f.caption(t('a parabola', '一条抛物线'), { id: 'cap' })])]));
    f.script(reveal(curve, dot), set(a, 2));
    return { f, a };
  };
  it('slides a label along the path it names, to where it hides least', () => {
    const build = (along: boolean) => {
      const f = new Figure();
      const P = f.plot({ id: 'p', x: [0, 10], y: [0, 10], x_ticks: [0, 5, 10], y_ticks: [0, 5, 10], priority: 2 });
      const a = P.add(new Path(() => [[0, 10], [10, 0]], { id: 'a', role: 'noun:plan' }));
      const b = P.add(new Path(() => [[0, 0], [10, 10]], { id: 'b', role: 'noun:cost' })); // crosses a in the middle
      const w = f.label('a label about this line', a, { id: 'a_word', along, sides: ['above-right', 'below-left'] });
      f.layout(row([P]));
      f.script(reveal(a, b));
      f.build();
      f.layout_for(640, 400);
      f.at(f.duration);
      const g = createCanvas(640, 400).getContext('2d') as unknown as CanvasRenderingContext2D;
      f.draw(g, 1, { force: true });
      return { f, P, w };
    };
    const slid = build(true), still = build(false);
    // the middle of the line is where the other line crosses it: the label does not stand there, and says where it does
    const cross = slid.P.P([5, 5]);
    const hits = (w: typeof slid.w) => cross[0] >= w.box.x - 6 && cross[0] <= w.box.x + w.box.w + 6 && cross[1] >= w.box.y - 6 && cross[1] <= w.box.y + w.box.h + 6;
    expect(hits(slid.w)).toBe(false);
    expect(slid.w.why[0]).toContain('along its path at');
    expect(slid.f.lint().filter((i) => i.rule === 'label')).toEqual([]);
    expect(still.w.why[0]).not.toContain('along');
  });
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

describe('the tutor acts as the learner can', () => {
  const world = () => {
    const f = new Figure();
    const x = f.param('x', 1, { range: [0, 4], step: 0.5, doc: 'where the dot is' });
    const hidden = f.param('secret', 0, { range: [0, 1] });
    const P = f.plot({ id: 'p', x: [0, 4], y: [0, 1] });
    const dot = P.add(new Marker(() => [x.value, 0.5], { id: 'dot', role: 'noun:plan', says: t('the dot', '点') }));
    f.handle(P, x, null, { id: 'x_handle' });
    f.layout(column([P]));
    f.script(reveal(dot));
    f.build();
    f.layout_for(640, 360);
    f.at(f.duration);
    return { f, x, hidden };
  };
  it('lists what is on screen and only what the hand can move', () => {
    const { f } = world();
    const g = createCanvas(640, 360).getContext('2d') as unknown as CanvasRenderingContext2D;
    f.draw(g, 1, { force: true });
    const m = manifest_of(f);
    expect(m.things.map((x) => x.id)).toContain('dot');
    expect(m.params).toEqual([{ name: 'x', value: 1, range: [0, 4], step: 0.5, doc: 'where the dot is' }]);
  });
  it('refuses what the learner could not do, does the rest, keeps the history, and puts it back', () => {
    const { f, x, hidden } = world();
    const g = createCanvas(640, 360).getContext('2d') as unknown as CanvasRenderingContext2D;
    f.draw(g, 1, { force: true });
    expect(check_act(f, { op: 'set', param: 'secret', to: 1 })).toContain('not something the learner can move');
    expect(check_act(f, { op: 'point', id: 'nothing' })).toContain("no thing 'nothing'");
    expect(act_now(f, { op: 'set', param: 'secret', to: 1 }).ok).toBe(false);
    expect(hidden.peek()).toBe(0);
    expect(act_now(f, { op: 'set', param: 'x', to: 3.2 }).ok).toBe(true);
    expect(x.peek()).toBe(3); // (snapped to the hand's step)
    expect(act_now(f, { op: 'point', id: 'dot' }).ok).toBe(true);
    expect(act_now(f, { op: 'note', id: 'dot', text: 'here' }).ok).toBe(true);
    f.draw(g, 1, { force: true });
    expect(f.hands().light.box.w).toBeGreaterThan(0);
    expect(f.registry.get('tutor_note')!.box.w).toBeGreaterThan(0);
    act_now(f, { op: 'reset' });
    expect(x.peek()).toBe(1);
    expect(f.hands().history.map((r) => [r.act.op, r.ok])).toEqual([['set', false], ['set', true], ['point', true], ['note', true], ['reset', true]]);
  });
});

describe('placement by hand', () => {
  it('puts blocks in the rectangles of a frame, and a design width scales the drawing', () => {
    const f = new Figure();
    const a = new TextBlock('left', { id: 'a' }), b = new TextBlock('right', { id: 'b' });
    f.layout(place([[a, [-7, -1, 3, 3.6]], [b, [1, 7, -3.6, -3]]]), { pad: 0, design_w: 960 });
    f.build();
    // (a phone, below 560 px, gets its own composition: this is a small desktop)
    const size = f.layout_for(720, 405);
    expect(size).toEqual({ w: 720, h: 405 });
    expect(f.view_scale).toBeCloseTo(0.75, 6);
    expect(a.box.x).toBeCloseTo((-7 + 64 / 9) * (960 / (128 / 9)), 3);
    expect(b.box.y).toBeGreaterThan(a.box.y + 300);
  });
});

describe('the DOM mirror reads TeX as words', () => {
  it('turns subscripts, relations, units, colours, matrices and î ĵ into text', () => {
    expect(tex_to_text('a_1 = -0.31')).toBe('a₁ = −0.31');
    expect(tex_to_text('\\mathrm{m/s^2}')).toBe('m/s²');
    expect(tex_to_text('p(2\\,\\mathrm{s}) \\le 10')).toBe('p(2 s) ≤ 10');
    expect(tex_to_text('A = \\begin{bmatrix} \\color{#1F8A5B}1.5 & \\color{#E4572E}0.5 \\\\ \\color{#1F8A5B}0.5 & \\color{#E4572E}1.2 \\end{bmatrix}')).toBe('A = [1.5 0.5; 0.5 1.2]');
    expect(tex_to_text('\\det A = \\color{#1F8A5B}a\\color{#E4572E}d - \\color{#E4572E}b\\color{#1F8A5B}c')).toBe('det A = ad − bc');
    expect(tex_to_text('\\hat\\imath, \\hat{\\jmath}')).toBe('î, ĵ');
    expect(tex_to_text('\\varnothing')).toBe('∅');
  });
});

describe("manim's shapes and motions", () => {
  const gallery = async () => {
    const S = await import('../src/index');
    const f = new S.Figure();
    const st = S.stage({ id: 'st' });
    const r = f.param('r', 1, { range: [0.5, 2] });
    const circle = st.add(new S.Circle([-5, 2], () => r.value, { id: 'circle', role: 'noun:plan', says: t('a circle', '圆') }));
    const square = st.add(new S.Rect([-6, -3], [-4, -1], { id: 'square', role: 'region:plan', corner: 8 }));
    const ellipse = st.add(new S.Ellipse([-1.5, 2], 1.4, 0.7, 0.4, { id: 'ellipse', role: 'noun:cost' }));
    const sector = st.add(new S.Sector([-1.5, -2], 1.3, 0, 1.2, { id: 'sector', role: 'region:goal' }));
    const arc = st.add(new S.Arc([1.5, 2], 1, 0, Math.PI, { id: 'arc', role: 'noun:wall' }));
    const tri = st.add(new S.Polygon([[1, -3], [3, -3], [1, -1]], { id: 'tri', role: 'noun:plan' }));
    const ra = st.add(new S.RightAngle([1, -3], [3, -3], [1, -1], 12, { id: 'ra', role: 'text' }));
    const ang = st.add(new S.Angle([3, -3], [1, -3], [1, -1], 26, { id: 'ang', role: 'noun:speed' }));
    const line = st.add(new S.Line([4, -3], [6.5, -1], { id: 'line', role: 'predicted:plan' }));
    const brace = st.add(new S.Brace([1, -3.3], [3, -3.3], { id: 'brace', depth: 10 }));
    const eq = st.add(new S.TexMark('e^{i\\pi} + 1 = 0', [4.8, 2.4], { id: 'eq' }));
    const words = st.add(new S.TexMark(t('a sector', '扇形'), [-1.5, -3.6], { id: 'words', tex: false }));
    const target = st.add(new S.Circle([5, 0.4], 0.8, { id: 'target', role: 'noun:goal' }));
    const from = st.add(new S.Rect([4, -0.4], [6, 1.2], { id: 'from', role: 'noun:goal' }));
    f.label('2', brace, { id: 'brace_word', tex: true, avoid: false, sides: ['center'], gap: 0 });
    f.layout(column([st]), { pad: 0 });
    f.script(
      S.create(circle, square), S.write(eq), S.grow('left', arc), S.lagged(0.2, reveal(ellipse), reveal(sector), reveal(tri)),
      S.indicate(circle, eq), S.flash(st, [-5, 2]), set(r, 1.6, 'linear', 1), S.transform(from, target), reveal(ra, ang, line, brace, words),
      S.call(0.5, (u) => r.set(1.6 - 0.4 * u, true), [r]),
    );
    return { f, circle, square, eq, from, target, r };
  };
  it('draws them, lints clean at both sizes, and seeks exactly through Create, Write, Grow, Indicate, Flash and Transform', async () => {
    const { f, circle, eq, from, target, r } = await gallery();
    expect(lint_figure(f).filter((i) => i.severity === 'error')).toEqual([]);
    f.layout_for(960, 540);
    f.at(0.4);
    expect(circle.drawn.peek()).toBeGreaterThan(0);
    expect(circle.drawn.peek()).toBeLessThan(1);
    const mid = [circle.drawn.peek(), eq.drawn.peek(), from.morph.peek(), r.peek()];
    f.at(f.duration);
    expect([circle.drawn.peek(), eq.drawn.peek(), from.morph.peek()]).toEqual([1, 1, 1]);
    expect(from.opacity.peek()).toBe(0);
    expect(target.opacity.peek()).toBe(1);
    expect(r.peek()).toBeCloseTo(1.2, 9);
    expect(circle.pulse.peek()).toBe(0);
    f.at(0.4);
    expect([circle.drawn.peek(), eq.drawn.peek(), from.morph.peek(), r.peek()]).toEqual(mid);
    const c = render_figure(f, 960, 540);
    fs.mkdirSync('/tmp/mathnim-engine', { recursive: true });
    fs.writeFileSync('/tmp/mathnim-engine/gallery.png', c.toBuffer('image/png'));
  });
});

describe('a slider', () => {
  it('moves its param by hand, keyboard and tutor, and lints clean', async () => {
    const S = await import('../src/index');
    const f = new S.Figure();
    const k = f.param('k', 1, { range: [0, 4], step: 0.5, says: t('the gain k', '增益 k') });
    const P = f.plot({ id: 'p', x: [0, 4], y: [0, 16] });
    P.add(new Path(() => Array.from({ length: 21 }, (_, i) => [i / 5, k.value * (i / 5) ** 2] as [number, number]), { id: 'curve', role: 'noun:plan' }));
    const sl = S.slider(f, k, { label: 'k', tex: true, decimals: 1 });
    f.layout(column([P, sl]));
    f.build();
    expect(lint_figure(f).filter((i) => i.severity === 'error')).toEqual([]);
    expect(S.manifest_of(f).params.map((p) => [p.name, p.doc])).toEqual([['k', 'the gain k']]);
    f.handles[0].nudge(1, 0);
    expect(k.peek()).toBe(1.5);
    expect(S.act_now(f, { op: 'set', param: 'k', to: 3.3 }).ok).toBe(true);
    expect(k.peek()).toBe(3.5);
  });
});

describe('a minimal 3D view', () => {
  it('projects with manim camera angles, draws far to near, and turns with an orbit', async () => {
    const S = await import('../src/index');
    const f = new S.Figure();
    const phi = f.param('phi', (70 * Math.PI) / 180, { range: [0, Math.PI / 2], tutor: true }), theta = f.param('theta', -0.9, { range: [-Math.PI, Math.PI], tutor: true });
    const st = S.stage({ id: 'st3' });
    const v = st.add(new S.View3D({ phi, theta }, { id: 'v', size: 2, radius: 3.5 }));
    v.arrow([0, 0, 0], [1.5, 0, 0], { role: 'noun:i-hat' }).arrow([0, 0, 0], [0, 1.5, 0], { role: 'noun:j-hat' }).arrow([0, 0, 0], [0, 0, 1.5], { role: 'text' });
    v.face([[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], { role: 'region:plan' });
    v.dots(Array.from({ length: 40 }, (_, i) => [Math.cos(i) * 1.2, Math.sin(i * 1.7) * 0.5, Math.sin(i) * 0.3] as [number, number, number]), { role: 'noun:data' });
    const h = S.orbit(f, st, v);
    f.layout(column([st]), { pad: 0 });
    f.build();
    expect(lint_figure(f).filter((i) => i.severity === 'error')).toEqual([]);
    // looking straight down (phi = 0), +x points right and +y up on the plot; the depth of a point is its height
    phi.set(0, true);
    theta.set(-Math.PI / 2, true);
    const [x1, y1] = v.project([1, 0, 0]), [x2, y2, d2] = v.project([0, 1, 0.5]);
    expect(x1).toBeGreaterThan(0);
    expect(Math.abs(y1)).toBeLessThan(1e-9);
    expect(y2).toBeGreaterThan(0);
    expect(Math.abs(x2)).toBeLessThan(1e-9);
    expect(d2).toBeCloseTo(0.5, 9);
    h.drag_by(100, 0);
    expect(theta.peek()).toBeCloseTo(-Math.PI / 2 - 1, 9);
    phi.set(1.2, true);
    theta.set(-0.9, true);
    const c = render_figure(f, 960, 540);
    fs.mkdirSync('/tmp/mathnim-engine', { recursive: true });
    fs.writeFileSync('/tmp/mathnim-engine/view3d.png', c.toBuffer('image/png'));
  });
});
