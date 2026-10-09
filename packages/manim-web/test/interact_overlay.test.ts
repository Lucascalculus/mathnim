// Overlays of the interaction toolkit with a minimal fake DOM: AffordanceLayer
// cues for every item kind (and labels kept inside the canvas), the coach
// mark, Juice effects and sounds, and animated snapping driven frame by frame.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as M from '../src/index';
import { Interaction } from '../src/ext/interact';
import { AffordanceLayer } from '../src/ext/affordance';
import { Juice, play_sound, set_muted, set_reduced_motion } from '../src/ext/juice';

const { Scene, Circle, Square, ValueTracker, DecimalNumber, NumberLine } = M as any;
const W = 800, H = 450;

// ---------------------------------------------------------------- fake DOM
const calls: any[][] = [];
const ctx = new Proxy({ font: '', globalAlpha: 1 } as any, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return (s: string) => ({ width: String(s).length * 7 });
    return (...a: unknown[]) => calls.push([k, ...a]);
  },
  set(t, k, v) {
    t[k] = v;
    return true;
  },
});
const el = () => ({
  style: { setProperty() {} }, className: '', width: 0, height: 0, removed: false,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
  getContext: () => ctx, setAttribute() {}, insertAdjacentElement() {}, remove() { (this as any).removed = true; },
});
let now = 0;
let frame_id = 0;
const frames = new Map<number, (t: number) => void>();
const flush = (n = 1, dt = 16) => {
  for (let i = 0; i < n; i++) {
    now += dt;
    const fs = [...frames.values()];
    frames.clear();
    for (const f of fs) f(now);
  }
};
const g = globalThis as any;
const saved = { document: g.document, getComputedStyle: g.getComputedStyle, requestAnimationFrame: g.requestAnimationFrame, cancelAnimationFrame: g.cancelAnimationFrame, Path2D: g.Path2D, AudioContext: g.AudioContext };
beforeAll(async () => {
  await M.init_tex();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  g.document = { createElement: () => el() };
  g.getComputedStyle = () => ({ position: 'relative' });
  g.requestAnimationFrame = (f: (t: number) => void) => (frames.set(++frame_id, f), frame_id);
  g.cancelAnimationFrame = (id: number) => frames.delete(id);
  g.Path2D = class {};
});
afterAll(() => {
  vi.restoreAllMocks();
  Object.assign(g, saved);
});

class FakeCanvas {
  listeners: Record<string, ((e: any) => void)[]> = {};
  attrs: Record<string, string> = {};
  style: any = { touchAction: '', cursor: '' };
  tabIndex = 0;
  parentElement = { style: {} };
  hasAttribute = (k: string) => k in this.attrs;
  setAttribute = (k: string, v: unknown) => void (this.attrs[k] = String(v));
  addEventListener = (t: string, f: (e: any) => void) => void (this.listeners[t] ??= []).push(f);
  removeEventListener = () => {};
  getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H });
  setPointerCapture() {}
  inserted: any[] = [];
  insertAdjacentElement = (_w: string, e: any) => (this.inserted.push(e), e);
  emit(t: string, e: any) {
    for (const f of this.listeners[t] ?? []) f(e);
  }
}
function rig() {
  const scene = new Scene();
  const canvas = new FakeCanvas();
  const player = { scene, canvas, refresh: () => scene.update_mobjects(0) } as any;
  const ui = new Interaction(player);
  const cam = scene.camera as any;
  const client = (p: number[]) => [((p[0] - cam.frame_center[0]) / cam.frame_width + 0.5) * W, (0.5 - (p[1] - cam.frame_center[1]) / cam.frame_height) * H];
  const ptr = (type: string, p: number[]) => {
    const [x, y] = client(p);
    canvas.emit(type, { type, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' });
  };
  return { scene, canvas, ui, ptr };
}
/** Every label drawn (fillText) must lie inside the canvas. */
function labels_inside(): string[] {
  const out: string[] = [];
  for (const c of calls) {
    if (c[0] !== 'fillText') continue;
    const [, text, x, y] = c;
    const w = String(text).length * 7;
    if (x < 4 || x + w > W - 4 || y < 4 || y > H) out.push(`${text} at ${x},${y}`);
  }
  return out;
}

describe('AffordanceLayer with interactive items', () => {
  it('draws cues for every kind without errors, keeping labels inside the canvas', () => {
    const { scene, ui, ptr } = rig();
    const coin = Circle({ radius: 0.3, fill_opacity: 1 }).move_to([6.8, 3.7, 0]); // in a corner: its label must be pushed inside
    scene.add(coin);
    const d = ui.add_draggable(coin, { label: 'the coin with a rather long name', zones: [{ id: 'a', region: { box: [-1, 1, -1, 1] } }] });
    ui.add_stamp(Square({ side_length: 0.5 }), { area: { center: [-4, 0, 0], radius: 1.5 }, grid: 0.5, label: 'tile' });
    const t = ValueTracker(1);
    const num = DecimalNumber(1).move_to([0, 3, 0]);
    scene.add(num);
    ui.add_scrubber(num, t, { label: 'r' });
    ui.add_cutter({ region: { box: [-2, 2, -2, 2] } });
    const nl = NumberLine({ x_range: [0, 5, 1], length: 8 }).move_to([0, -3, 0]);
    scene.add(nl);
    ui.add_marker(nl, ValueTracker(2), { label: 'estimate' });
    const aff = new AffordanceLayer(ui);
    calls.length = 0;
    flush(3);
    expect(calls.some((c) => c[0] === 'fillText')).toBe(true);
    expect(labels_inside()).toEqual([]);
    // drag the coin: zones are outlined and labelled "Drop here"
    ptr('pointerdown', [6.8, 3.7, 0]);
    ptr('pointermove', [0.5, 0.5, 0]);
    expect(d.candidate?.id).toBe('a');
    calls.length = 0;
    flush(1);
    expect(calls.some((c) => c[0] === 'fillText' && c[1] === 'Drop here')).toBe(true);
    expect(labels_inside()).toEqual([]);
    ptr('pointerup', [0.5, 0.5, 0]);
    flush(30);
    expect(d.zone_id).toBe('a');
    // keyboard focus on each item draws too
    for (let i = 0; i < ui.focusables().length; i++) {
      (ui as any).key({ key: 'Tab', shiftKey: false, preventDefault() {} });
      flush(1);
    }
    expect(labels_inside()).toEqual([]);
    aff.dispose();
  });
  it('coach(): demonstrates the first item when there are no handles (a knife swipe with a trail)', () => {
    const { ui } = rig();
    ui.add_cutter({ region: { center: [0, 0, 0], radius: 2 } });
    const aff = new AffordanceLayer(ui);
    aff.coach();
    calls.length = 0;
    flush(40, 20);
    const dashes = calls.filter((c) => c[0] === 'setLineDash' && Array.isArray(c[1]) && c[1][0] === 9);
    expect(dashes.length).toBeGreaterThan(5); // the dashed knife trail, frame after frame
    expect(calls.some((c) => c[0] === 'fill' && c.length === 2)).toBe(true); // the hand (a Path2D fill)
    aff.dispose();
  });
  it('coach() still demonstrates the first handle when there is one', () => {
    const { ui } = rig();
    const t = ValueTracker(0);
    ui.add_handle({ tracker: t, from_value: (v: number) => [v, 0, 0], to_value: (p: number[]) => p[0] });
    ui.add_cutter();
    const aff = new AffordanceLayer(ui);
    aff.coach();
    calls.length = 0;
    flush(20, 20);
    expect(calls.filter((c) => c[0] === 'setLineDash' && Array.isArray(c[1]) && c[1][0] === 9)).toHaveLength(0);
    aff.dispose();
  });
});

describe('animated snapping', () => {
  it('glides into the zone over a few frames, then reports the drop', () => {
    const { scene, ui, ptr } = rig();
    const coin = Circle({ radius: 0.3, fill_opacity: 1 }).move_to([-4, 0, 0]);
    scene.add(coin);
    const drops: (string | null)[] = [];
    ui.add_draggable(coin, { zones: [{ id: 'a', region: { box: [-1, 1, -1, 1] } }], on_drop: (z) => drops.push(z) });
    ptr('pointerdown', [-4, 0, 0]);
    ptr('pointermove', [0.6, 0.5, 0]);
    ptr('pointerup', [0.6, 0.5, 0]);
    expect(drops).toEqual([]); // still moving
    flush(3);
    const mid = coin.get_center();
    expect(Math.hypot(mid[0], mid[1])).toBeGreaterThan(1e-3);
    flush(30);
    return Promise.resolve().then(() => {
      expect(drops).toEqual(['a']);
      expect(Math.hypot(coin.get_center()[0], coin.get_center()[1])).toBeLessThan(1e-9);
    });
  });
  it('reduced motion: snaps at once', () => {
    set_reduced_motion(true);
    try {
      const { scene, ui } = rig();
      const coin = Circle({ radius: 0.3, fill_opacity: 1 }).move_to([-4, 0, 0]);
      scene.add(coin);
      const drops: (string | null)[] = [];
      const d = ui.add_draggable(coin, { zones: [{ id: 'a', region: { box: [-1, 1, -1, 1] } }], on_drop: (z) => drops.push(z) });
      d.send_to('a');
      expect(drops).toEqual(['a']);
    } finally {
      set_reduced_motion(null);
    }
  });
});

describe('Juice', () => {
  it('attaches to the interaction, draws rings and particles, and tweens counters', async () => {
    const { ui, canvas } = rig();
    const juice = new Juice(ui);
    expect(ui.juice).toBe(juice);
    juice.pulse([0, 0, 0]);
    juice.burst([1, 1, 0]);
    expect((juice as any).effects.filter((e: any) => e.kind === 'particle').length).toBeGreaterThan(10);
    expect(canvas.inserted).toContain(juice.overlay);
    calls.length = 0;
    flush(5);
    expect(calls.some((c) => c[0] === 'arc')).toBe(true);
    flush(120);
    expect((juice as any).effects).toHaveLength(0);
    const t = ValueTracker(0);
    const done = juice.count_to(t, 12, { duration: 0.3, round: true });
    flush(5);
    expect(t.get_value()).toBeGreaterThan(0);
    expect(t.get_value()).toBeLessThan(12);
    expect(Number.isInteger(t.get_value())).toBe(true);
    flush(30);
    await done;
    expect(t.get_value()).toBe(12);
    const overlay = juice.overlay as any;
    ui.dispose();
    expect(ui.juice).toBeNull();
    expect(overlay.removed).toBe(true);
  });
  it('reduced motion: no particles, rings do not grow, counters jump', async () => {
    set_reduced_motion(true);
    try {
      const { ui } = rig();
      const juice = new Juice(ui);
      juice.burst([0, 0, 0]);
      const fx = (juice as any).effects;
      expect(fx.every((e: any) => e.kind === 'ring' && e.grow === 0)).toBe(true);
      const t = ValueTracker(0);
      await juice.count_to(t, 5);
      expect(t.get_value()).toBe(5);
    } finally {
      set_reduced_motion(null);
    }
  });
  it('synthesizes blips with WebAudio and respects mute', () => {
    const made: string[] = [];
    const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const node = (kind: string) => ({ kind, connect: (x: any) => x, start() {}, stop() {}, type: '', frequency: param(), gain: param(), Q: param(), buffer: null });
    g.AudioContext = class {
      currentTime = 0;
      state = 'running';
      sampleRate = 8000;
      destination = {};
      createGain = () => (made.push('gain'), node('gain'));
      createOscillator = () => (made.push('osc'), node('osc'));
      createBufferSource = () => (made.push('noise'), node('noise'));
      createBiquadFilter = () => node('filter');
      createBuffer = () => ({ getChannelData: () => new Float32Array(10) });
      resume = () => Promise.resolve();
    };
    now += 1000;
    play_sound('success');
    expect(made.filter((x) => x === 'osc')).toHaveLength(4);
    now += 1000;
    play_sound('swish');
    expect(made).toContain('noise');
    made.length = 0;
    set_muted(true);
    now += 1000;
    play_sound('snap');
    expect(made).toHaveLength(0);
    set_muted(false);
  });
});
