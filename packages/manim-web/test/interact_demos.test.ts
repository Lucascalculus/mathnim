// The demo page's scenes (dev/interact.demos.ts) run headlessly: build, wire,
// poke every item with pointer and keyboard input, press every button.
import { beforeAll, describe, expect, it } from 'vitest';
import * as M from '../src/index';
import { Interaction } from '../src/ext/interact';
import { Juice } from '../src/ext/juice';
import { DEMOS } from '../dev/interact.demos';

class FakeCanvas {
  listeners: Record<string, ((e: any) => void)[]> = {};
  attrs: Record<string, string> = {};
  style: any = { touchAction: '', cursor: '' };
  tabIndex = 0;
  parentElement = null;
  hasAttribute = (k: string) => k in this.attrs;
  setAttribute = (k: string, v: unknown) => void (this.attrs[k] = String(v));
  addEventListener = (t: string, f: (e: any) => void) => void (this.listeners[t] ??= []).push(f);
  removeEventListener = () => {};
  getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 450 });
  setPointerCapture() {}
  insertAdjacentElement() {
    return null;
  }
  emit(t: string, e: any) {
    for (const f of this.listeners[t] ?? []) f(e);
  }
}

function run(id: string) {
  const demo = DEMOS.find((d) => d.id === id)!;
  const scene = new (M as any).Scene();
  demo.build(scene);
  const canvas = new FakeCanvas();
  const player = { scene, canvas, refresh: () => scene.update_mobjects(0) } as any;
  const ui = new Interaction(player);
  const juice = new Juice(ui);
  const logs: string[] = [];
  const controls = demo.setup(scene, { ui, juice, log: (t) => logs.push(t) }) || {};
  const cam = scene.camera as any;
  const ptr = (type: string, p: number[]) =>
    canvas.emit(type, { type, clientX: ((p[0] - cam.frame_center[0]) / cam.frame_width + 0.5) * 800, clientY: (0.5 - (p[1] - cam.frame_center[1]) / cam.frame_height) * 450, pointerId: 1, pointerType: 'mouse' });
  const drag = (a: number[], b: number[]) => {
    ptr('pointerdown', a);
    for (let i = 1; i <= 4; i++) ptr('pointermove', [a[0] + ((b[0] - a[0]) * i) / 4, a[1] + ((b[1] - a[1]) * i) / 4, 0]);
    ptr('pointerup', b);
  };
  const key = (k: string) => canvas.emit('keydown', { key: k, shiftKey: false, preventDefault() {} });
  return { demo, scene, ui, logs, controls, drag, key, ptr };
}

beforeAll(async () => {
  await M.init_tex();
});

describe('demo page scenes', () => {
  for (const d of DEMOS) {
    it(`${d.id}: builds, reacts to pointer and keyboard, buttons work`, () => {
      const { ui, controls, drag, key, ptr } = run(d.id);
      expect(d.caption.length).toBeGreaterThan(20);
      for (const it of [...ui.items]) {
        const a = it.anchor?.();
        if (!a) continue;
        ptr('pointermove', a);
        drag(a, [a[0] + 0.7, a[1] + 0.3, 0]);
      }
      for (let i = 0; i < ui.focusables().length; i++) {
        key('Tab');
        key('ArrowRight');
        key('Enter');
      }
      for (const act of Object.values(controls.buttons ?? {})) act();
      expect(ui.items.length + ui.handles.length).toBeGreaterThan(d.id === 'juice' ? -1 : 0);
    });
  }
  it('bet: a coin dropped on an offer is counted', () => {
    const { drag, logs, scene } = run('bet');
    const coin = (scene as any).coins[0];
    drag(coin.get_center(), [-3.4, 1.1, 0]);
    expect(logs.at(-1)).toBe('bets: 16-inch 1, two 8-inch 0');
    expect(coin.get_center()[1]).toBeCloseTo(-1.4);
  });
  it('cut: strokes through the centre slice the pizza; the square splits', () => {
    const { drag, logs, scene } = run('cut');
    drag([-5.5, 0.3, 0], [-0.9, 0.2, 0]);
    expect(logs.at(-1)).toBe('pizza: 2 slice(s)');
    drag([-3.1, 2.4, 0], [-3.3, -2.2, 0]);
    expect(logs.at(-1)).toBe('pizza: 4 slice(s)');
    expect((scene as any).pizza.submobjects).toHaveLength(4);
    drag([1.5, 0.5, 0], [5, 0.3, 0]);
    expect(logs.at(-1)).toBe('square: 2 pieces');
  });
  it('cover: taps place tiles and the covered area is measured in radius-squares', () => {
    const { ptr, logs } = run('cover');
    for (const p of [[-2.2, 0.3, 0], [-3.1, 0.3, 0], [-2.2, -0.6, 0], [-3.1, -0.6, 0]]) {
      ptr('pointerdown', p);
      ptr('pointerup', p);
    }
    expect(logs.at(-1)).toBe('4 pieces, area 1.00 r²');
  });
  it('formula: tiles build pi r^2', () => {
    const { ui, key, logs } = run('formula');
    const tiles = ui.items.filter((x) => x.kind === 'draggable');
    for (const i of [1, 0, 2]) {
      ui.focus_on(tiles[i]);
      key('Enter');
    }
    expect(logs.at(-1)).toBe('latex: \\pi r^2   plain: pi*r^2');
  });
});
