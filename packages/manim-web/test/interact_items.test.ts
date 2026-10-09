// Interaction toolkit (WP1) driven end to end through a fake canvas: pointer
// and keyboard events -> Interaction -> draggables, stamps, scrubbers,
// cutters, token builder, number-line marker. Node has no
// requestAnimationFrame, so every snap/return is immediate.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as M from '../src/index';
import { Interaction } from '../src/ext/interact';
import { vmobject_to_polygon, polygon_area } from '../src/ext/geom';
import type { DropZone } from '../src/ext/dragdrop';

const { Scene, Circle, Square, ValueTracker, NumberLine, DecimalNumber } = M as any;
type P3 = [number, number, number];

class FakeCanvas {
  listeners: Record<string, ((e: any) => void)[]> = {};
  attrs: Record<string, string> = {};
  style: any = { touchAction: 'auto', cursor: '' };
  tabIndex = -1;
  parentElement: any = null;
  width = 1600;
  height = 900;
  w = 800;
  h = 450;
  hasAttribute(k: string) {
    return k in this.attrs;
  }
  setAttribute(k: string, v: unknown) {
    this.attrs[k] = String(v);
  }
  addEventListener(t: string, f: (e: any) => void) {
    (this.listeners[t] ??= []).push(f);
  }
  removeEventListener(t: string, f: (e: any) => void) {
    this.listeners[t] = (this.listeners[t] ?? []).filter((x) => x !== f);
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.w, height: this.h, right: this.w, bottom: this.h, x: 0, y: 0 };
  }
  setPointerCapture() {}
  insertAdjacentElement() {
    return null;
  }
  emit(t: string, e: any) {
    for (const f of this.listeners[t] ?? []) f(e);
  }
}

function rig() {
  const scene = new Scene();
  const canvas = new FakeCanvas();
  const player = { scene, canvas, refresh: () => scene.update_mobjects(0) } as any;
  const ui = new Interaction(player);
  let changes = 0;
  ui.on_change = () => changes++;
  const cam = scene.camera as any;
  const client = (p: number[]) => [((p[0] - cam.frame_center[0]) / cam.frame_width + 0.5) * canvas.w, (0.5 - (p[1] - cam.frame_center[1]) / cam.frame_height) * canvas.h];
  const ptr = (type: string, p: number[], o: { touch?: boolean; dx_px?: number } = {}) => {
    const [x, y] = client(p);
    canvas.emit(type, { type, clientX: x + (o.dx_px ?? 0), clientY: y, pointerId: 1, pointerType: o.touch ? 'touch' : 'mouse', shiftKey: false });
  };
  const drag = (a: number[], b: number[], o: { touch?: boolean } = {}) => {
    ptr('pointerdown', a, o);
    for (let i = 1; i <= 4; i++) ptr('pointermove', [a[0] + ((b[0] - a[0]) * i) / 4, a[1] + ((b[1] - a[1]) * i) / 4, 0], o);
    ptr('pointerup', b, o);
  };
  const tap = (p: number[], o: { touch?: boolean } = {}) => {
    ptr('pointerdown', p, o);
    ptr('pointerup', p, o);
  };
  const key = (k: string, shift = false) => {
    let prevented = false;
    canvas.emit('keydown', { key: k, shiftKey: shift, preventDefault: () => (prevented = true) });
    return prevented;
  };
  const upp = cam.frame_width / canvas.w;
  return { scene, canvas, ui, ptr, drag, tap, key, upp, changes: () => changes };
}
const near = (a: number[], b: number[], tol = 1e-6) => {
  expect(Math.abs(a[0] - b[0]), `x ${a[0]} vs ${b[0]}`).toBeLessThan(tol);
  expect(Math.abs(a[1] - b[1]), `y ${a[1]} vs ${b[1]}`).toBeLessThan(tol);
};

beforeAll(async () => {
  await M.init_tex();
});

describe('Interaction registry', () => {
  it('keeps handles first in the Tab order and nudges them as before', () => {
    const { ui, key, canvas, scene } = rig();
    const t = ValueTracker(1);
    ui.add_handle({ tracker: t, label: 'the dot', from_value: (v: number) => [v, 0, 0], to_value: (p: number[]) => p[0], step: 0.5 });
    const coin = Circle({ radius: 0.3, fill_opacity: 1 }).shift([-4, 0, 0]);
    scene.add(coin);
    const d = ui.add_draggable(coin, { label: 'coin' });
    expect(canvas.attrs['aria-label']).toContain('the dot, coin');
    expect(key('Tab')).toBe(true);
    expect(ui.focused()).toBe(ui.handles[0]);
    key('ArrowRight');
    expect(t.get_value()).toBeCloseTo(1.5);
    expect(canvas.attrs['aria-valuetext']).toBe('the dot: 1.5');
    key('Tab');
    expect(ui.focused()).toBe(d);
    expect(canvas.attrs['aria-valuetext']).toMatch(/^coin/);
    expect(key('Tab')).toBe(false); // focus leaves the canvas
    expect(ui.focused()).toBeNull();
  });
  it('restores touch-action and disposes items and hooks', () => {
    const { ui, canvas } = rig();
    expect(canvas.style.touchAction).toBe('none');
    let disposed = 0;
    ui.on_dispose(() => disposed++);
    ui.add_item({ kind: 'test', dispose: () => disposed++ });
    ui.dispose();
    expect(disposed).toBe(2);
    expect(canvas.style.touchAction).toBe('auto');
    expect(canvas.listeners.pointerdown).toHaveLength(0);
  });
});

describe('draggables and drop zones', () => {
  function bet() {
    const r = rig();
    const A: DropZone = { id: 'A', region: { box: [-1, 1, -1, 1] }, label: 'the big pizza' };
    const B: DropZone = { id: 'B', region: { center: [3, 0, 0], radius: 1 }, capacity: 1 };
    const drops: (string | null)[] = [];
    const coins = [-5, -4, -3].map((x) => {
      const c = Circle({ radius: 0.3, fill_opacity: 1 }).move_to([x, -2, 0]);
      r.scene.add(c);
      return r.ui.add_draggable(c, { zones: [A, B], return_if_missed: true, label: `coin ${x}`, on_drop: (z: string | null) => drops.push(z) });
    });
    return { ...r, A, B, coins, drops };
  }
  it('drops into a zone and snaps to its centre', () => {
    const { drag, coins, drops, changes } = bet();
    drag([-5, -2, 0], [0.3, 0.4, 0]);
    expect(drops).toEqual(['A']);
    expect(coins[0].zone_id).toBe('A');
    near(coins[0].mobject.get_center(), [0, 0, 0]);
    expect(coins[0].mobject.width).toBeCloseTo(0.6); // lift undone
    expect(changes()).toBeGreaterThan(0);
  });
  it('respects capacity and returns a missed drop', () => {
    const { drag, coins, drops } = bet();
    drag([-4, -2, 0], [3.2, 0.1, 0]);
    drag([-3, -2, 0], [3.1, 0, 0]); // B is full
    expect(drops).toEqual(['B', null]);
    near(coins[2].mobject.get_center(), [-3, -2, 0]);
    expect(coins[2].zone).toBeNull();
    drag([-3, -2, 0], [5.5, 3, 0]); // nowhere
    near(coins[2].mobject.get_center(), [-3, -2, 0]);
  });
  it('near misses within snap_radius still count', () => {
    const { drag, coins } = bet();
    drag([-5, -2, 0], [1.2, 0, 0]); // 0.2 outside A
    expect(coins[0].zone_id).toBe('A');
  });
  it('keyboard: arrows move, Enter drops into the nearest allowed zone, Escape puts back', () => {
    const { ui, key, coins, drops } = bet();
    ui.focus_on(coins[1]);
    key('ArrowRight', true); // 5 x 0.25
    near(coins[1].mobject.get_center(), [-2.75, -2, 0]);
    key('Escape');
    near(coins[1].mobject.get_center(), [-4, -2, 0]);
    key('Enter');
    expect(drops).toEqual(['A']);
    coins[0].send_to('B');
    ui.focus_on(coins[2]);
    key('Enter'); // B is full now: A
    expect(coins[2].zone_id).toBe('A');
  });
  it('a cancelled pointer puts the item back', () => {
    const { ptr, coins } = bet();
    ptr('pointerdown', [-5, -2, 0]);
    ptr('pointermove', [0, 0, 0]);
    ptr('pointercancel', [0, 0, 0]);
    near(coins[0].mobject.get_center(), [-5, -2, 0]);
  });
  it('touch gets a larger hit tolerance', () => {
    const { ptr, coins, upp } = bet();
    const edge = [-5 - 0.3 - 12 * upp, -2, 0]; // left of coin 0, far from coin 1
    ptr('pointerdown', edge);
    ptr('pointerup', edge);
    expect(coins[0].active).toBe(false);
    let picked = 0;
    coins[0].o.on_pick = () => picked++;
    ptr('pointerdown', edge);
    ptr('pointerup', edge);
    expect(picked).toBe(0); // mouse: 12 px away is a miss
    ptr('pointerdown', edge, { touch: true });
    ptr('pointerup', edge, { touch: true });
    expect(picked).toBe(1);
  });
  it('grid snapping while dragging and constraints', () => {
    const r = rig();
    const sq = Square({ side_length: 1, fill_opacity: 1 }).move_to([0.5, 0.5, 0]);
    r.scene.add(sq);
    r.ui.add_draggable(sq, { snap: 1, snap_origin: [0.5, 0.5, 0], constrain: (p: P3) => [Math.min(p[0], 2.5), p[1], 0] });
    r.drag([0.5, 0.5, 0], [1.8, 1.3, 0]);
    near(sq.get_center(), [1.5, 1.5, 0]);
    r.drag([1.5, 1.5, 0], [6, 1.5, 0]);
    near(sq.get_center(), [2.5, 1.5, 0]);
  });
});

describe('stamps', () => {
  function tiles() {
    const r = rig();
    const tmpl = Square({ side_length: 1, fill_opacity: 0.8 });
    const counts: number[] = [];
    let full = 0, moved = 0, removed = 0;
    const s = r.ui.add_stamp(tmpl, {
      area: { box: [-2, 2, -2, 2] }, grid: 1, origin: [0.5, 0.5, 0], max: 3, label: 'tile',
      on_count: (n: number) => counts.push(n), on_full: () => full++, on_move: () => moved++, on_remove: () => removed++,
    });
    return { ...r, s, counts, full: () => full, moved: () => moved, removed: () => removed };
  }
  it('tap places a snapped copy; tapping a stamp does not add one', () => {
    const { tap, s, counts, scene } = tiles();
    tap([0.4, 0.3, 0]);
    expect(s.count).toBe(1);
    near(s.stamps[0].get_center(), [0.5, 0.5, 0]);
    expect(scene.mobjects).toContain(s.stamps[0]);
    tap([0.7, 0.8, 0]); // on the stamp
    expect(s.count).toBe(1);
    tap([-1.2, 0.4, 0]);
    expect(counts).toEqual([1, 2]);
  });
  it('drag moves a stamp (snapped); dragging it out of the area removes it', () => {
    const { tap, drag, s, moved, removed, scene } = tiles();
    tap([0.4, 0.3, 0]);
    const m = s.stamps[0];
    drag([0.5, 0.5, 0], [1.4, -0.6, 0]);
    near(m.get_center(), [1.5, -0.5, 0]);
    expect(moved()).toBe(1);
    drag([1.5, -0.5, 0], [5, 0, 0]);
    expect(s.count).toBe(0);
    expect(removed()).toBe(1);
    expect(scene.mobjects).not.toContain(m);
  });
  it('refuses more than max, and taken cells', () => {
    const { tap, drag, s, full } = tiles();
    tap([0.5, 0.5, 0]);
    tap([-0.5, 0.5, 0]);
    drag([-0.5, 0.5, 0], [0.5, 0.5, 0]); // onto a taken cell: goes back
    near(s.stamps[1].get_center(), [-0.5, 0.5, 0]);
    tap([-0.5, -0.5, 0]);
    tap([0.5, -0.5, 0]);
    expect(s.count).toBe(3);
    expect(full()).toBe(1);
  });
  it('double click removes a stamp (but a quick double tap on empty space places one)', () => {
    const { tap, s } = tiles();
    let now = 1000;
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      tap([0.5, 0.5, 0]);
      now += 100;
      tap([0.5, 0.5, 0]);
      expect(s.count).toBe(1);
      now += 1000;
      tap([0.5, 0.5, 0]);
      now += 150;
      tap([0.5, 0.5, 0]);
      expect(s.count).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
  it('keyboard: arrows move a cursor, Enter places, Delete removes', () => {
    const { ui, key, s } = tiles();
    ui.focus_on(s);
    key('Enter');
    near(s.stamps[0].get_center(), [0.5, 0.5, 0]);
    key('ArrowLeft');
    key('Enter');
    near(s.stamps[1].get_center(), [-0.5, 0.5, 0]);
    key('Delete');
    expect(s.count).toBe(1);
    expect(s.describe()).toMatch(/tiles placed: 1 of 3\. Cursor at -0\.50, 0\.50/);
    key('ArrowLeft');
    key('ArrowLeft'); // would leave the area: the cursor stays
    expect(s.describe()).toMatch(/Cursor at -1\.50, 0\.50/);
  });
  it('adopted pieces are managed but not snapped', () => {
    const { ui, s, drag, scene } = tiles();
    const piece = Square({ side_length: 0.5, fill_opacity: 1 }).move_to([1, 1, 0]);
    scene.add(piece);
    s.adopt(piece);
    expect(s.count).toBe(1);
    drag([1, 1, 0], [0.3, -0.2, 0]);
    near(piece.get_center(), [0.3, -0.2, 0]);
    s.forget(piece);
    expect(s.count).toBe(0);
    void ui;
  });
});

describe('scrubbable numbers', () => {
  it('drag sideways changes the tracker (and the DecimalNumber); keys step', () => {
    const r = rig();
    const t = ValueTracker(2);
    const num = DecimalNumber(2, { num_decimal_places: 1 }).move_to([0, 2, 0]);
    r.scene.add(num);
    const seen: number[] = [];
    const sc = r.ui.add_scrubber(num, t, { step: 0.5, min: 0, max: 4, px_per_step: 10, label: 'radius', on_change: (v: number) => seen.push(v) });
    r.ptr('pointermove', [0, 2, 0]);
    expect(r.canvas.style.cursor).toBe('ew-resize');
    r.ptr('pointerdown', [0, 2, 0]);
    r.ptr('pointermove', [0, 2, 0], { dx_px: 12 });
    r.ptr('pointermove', [0, 2, 0], { dx_px: 25 });
    r.ptr('pointerup', [0, 2, 0], { dx_px: 25 });
    expect(t.get_value()).toBe(3);
    expect(num.get_value()).toBe(3);
    expect(seen).toEqual([2.5, 3]);
    r.ui.focus_on(sc);
    r.key('ArrowLeft');
    expect(t.get_value()).toBe(2.5);
    r.key('End');
    expect(t.get_value()).toBe(4);
    r.key('Home');
    expect(t.get_value()).toBe(0);
    expect(sc.describe()).toBe('radius: 0.0 (from 0.0 to 4.0). Arrow keys change it.');
  });
});

describe('cutting', () => {
  it('a stroke across a target splits it in the scene', () => {
    const r = rig();
    const sq = Square({ side_length: 2, fill_opacity: 1 });
    r.scene.add(sq);
    let pieces: any[] = [];
    const cuts: number[][][] = [];
    const cutter = r.ui.add_cutter({ targets: () => r.scene.mobjects.filter((m: any) => m !== cutter_stroke()), on_cut: (a: P3, b: P3) => cuts.push([a, b]), on_split: (_o: any, p: any[]) => (pieces = p) });
    const cutter_stroke = () => (cutter as any).stroke;
    r.drag([-3, 0.5, 0], [3, 0.5, 0]);
    expect(cuts).toHaveLength(1);
    expect(pieces).toHaveLength(2);
    expect(r.scene.mobjects).not.toContain(sq);
    for (const p of pieces) expect(r.scene.mobjects).toContain(p);
    const areas = pieces.map((p) => Math.abs(polygon_area(vmobject_to_polygon(p)))).sort();
    expect(areas[0]).toBeCloseTo(1);
    expect(areas[1]).toBeCloseTo(3);
    r.drag([-0.1, -3, 0], [0.1, -2.9, 0]); // too short: ignored
    expect(cuts).toHaveLength(1);
  });
  it('strokes that start inside a target do not split it (through: true); adjust can snap them', () => {
    const r = rig();
    const sq = Square({ side_length: 2, fill_opacity: 1 });
    r.scene.add(sq);
    let split = 0;
    r.ui.add_cutter({ targets: [sq], on_split: () => split++, adjust: (a: P3, b: P3) => [[a[0], 0, 0], [b[0], 0, 0]] });
    r.drag([0, 0.3, 0], [3, 0.3, 0]);
    expect(split).toBe(0);
    r.drag([-3, 0.3, 0], [3, 0.4, 0]);
    expect(split).toBe(1);
  });
  it('keyboard: Enter cuts along the aimed line', () => {
    const r = rig();
    const sq = Square({ side_length: 2, fill_opacity: 1 });
    r.scene.add(sq);
    const cuts: P3[][] = [];
    const c = r.ui.add_cutter({ region: { box: [-2, 2, -2, 2] }, targets: [sq], on_cut: (a: P3, b: P3) => cuts.push([a, b]) });
    r.ui.focus_on(c);
    r.key('ArrowLeft', true); // turn 45 degrees from vertical
    r.key('Enter');
    expect(cuts).toHaveLength(1);
    const [a, b] = cuts[0];
    expect(Math.atan2(b[1] - a[1], b[0] - a[0])).toBeCloseTo((3 * Math.PI) / 4);
    expect(r.scene.mobjects).not.toContain(sq);
  });
});

describe('token builder', () => {
  it('builds a sequence with keyboard and pointer, swapping and bumping tiles', () => {
    const r = rig();
    const values: string[] = [];
    const b = r.ui.add_tokens({ tokens: ['r', '\\pi', '^2', '\\times'], slots: 3, on_change: (v: string) => values.push(v) });
    const [tr, tpi, tsq, ttimes] = b.tiles;
    expect(b.complete).toBe(false);
    for (const t of [tpi, tr, tsq]) {
      r.ui.focus_on(t);
      r.key('Enter'); // into the first empty slot
    }
    expect(b.value()).toBe('\\pi r^2');
    expect(b.value('plain')).toBe('pi*r^2');
    expect(b.complete).toBe(true);
    expect(values[values.length - 1]).toBe('\\pi r^2');
    near(tpi.mobject.get_center(), b.slot_points[0]);
    // drag r (slot 2) onto slot 1: pi moves to slot 2 (swap)
    r.drag(b.slot_points[1], b.slot_points[0]);
    expect(b.sequence().map((s: any) => s?.tex)).toEqual(['r', '\\pi', '^2']);
    near(tpi.mobject.get_center(), b.slot_points[1]);
    // × from the tray onto slot 3: ^2 goes back to the tray
    r.drag(ttimes.mobject.get_center(), b.slot_points[2]);
    expect(b.sequence().map((s: any) => s?.tex)).toEqual(['r', '\\pi', '\\times']);
    near(tsq.mobject.get_center(), tsq.home);
    // Enter on a tile in a slot sends it home
    r.ui.focus_on(tr);
    r.key('Enter');
    expect(b.sequence()[0]).toBeNull();
    expect(b.value('latex', '\\square')).toBe('\\square \\pi \\times');
    b.set_sequence(['\\pi', 'r', '^2']);
    expect(b.value('plain')).toBe('pi*r^2');
    b.reset();
    expect(b.sequence()).toEqual([null, null, null]);
  });
});

describe('number-line marker', () => {
  it('drags along the line, clamps, snaps and steps with keys', () => {
    const r = rig();
    const nl = NumberLine({ x_range: [0, 5, 1], length: 10 });
    r.scene.add(nl);
    const t = ValueTracker(1);
    const seen: number[] = [];
    const m = r.ui.add_marker(nl, t, { snap: 0.01, decimals: 2, label: 'estimate', on_change: (v: number) => seen.push(v) });
    r.drag(nl.n2p(1), nl.n2p(3.14));
    expect(t.get_value()).toBeCloseTo(3.14, 6);
    expect(seen.length).toBeGreaterThan(0);
    expect((m.readout as any).get_value()).toBeCloseTo(3.14, 6);
    // the pin's tip sits just above the line at the value
    const tip = m.pin.get_bottom();
    expect(tip[0]).toBeCloseTo(nl.n2p(3.14)[0], 6);
    r.drag(nl.n2p(3.14), [9, 0, 0]);
    expect(t.get_value()).toBe(5);
    r.ui.focus_on(m.handle);
    r.key('ArrowLeft');
    expect(t.get_value()).toBeCloseTo(4.9);
    m.show_value(false);
    expect((m.readout as any).get_fill_opacity()).toBe(0);
    m.set_value(2);
    near(m.handle.position(), nl.n2p(2));
  });
});
