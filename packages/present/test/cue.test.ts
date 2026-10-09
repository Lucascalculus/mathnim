// One cue at a time: the guide keeps exactly one control "unused" for the affordance layer.
import { describe, expect, it } from 'vitest';
import { CueGuide } from '../src/cue';

const handle = (label: string) => ({ spec: { label }, active: false, focused: false });
const item = (label: string, kind = 'draggable') => ({ kind, label, active: false, focused: false, enabled: true });
function setup() {
  const handles = [handle('bar A'), handle('bar B'), handle('bar C')];
  const items = [item('card')];
  const layer = { used: new WeakSet(), used_items: new WeakSet(), used_kinds: new Set<string>() };
  const ui = { handles, items };
  const fresh = () => [...handles.filter((h) => !layer.used.has(h)), ...items.filter((it) => !layer.used_items.has(it) && !layer.used_kinds.has(it.kind))].map((c: any) => c.spec?.label ?? c.label);
  return { handles, items, layer, ui, fresh };
}

describe('CueGuide', () => {
  it('cues one control at a time, in creation order, moving on when it is used', () => {
    const { handles, items, layer, ui, fresh } = setup();
    const g = new CueGuide(layer as any, ui as any);
    expect(fresh()).toEqual(['bar A']);
    handles[0].active = true;
    g.tick();
    handles[0].active = false;
    g.tick();
    expect(fresh()).toEqual(['bar B']);
    handles[2].focused = true; // used out of order: still counts
    g.tick();
    handles[2].focused = false;
    handles[1].active = true;
    g.tick();
    handles[1].active = false;
    g.tick();
    expect(fresh()).toEqual(['card']);
    expect(g.target()).toBe(items[0]);
  });
  it("follows the world's order (labels in either language) and world.cue moves it", () => {
    const { layer, ui, fresh } = setup();
    const g = new CueGuide(layer as any, ui as any, [{ en: 'bar C', zh: '柱 C' }, 'card']);
    expect(fresh()).toEqual(['bar C']);
    g.set(['card']);
    expect(fresh()).toEqual(['card']);
    g.set(['no such control']); // nothing matches: back to every control
    expect(fresh()).toEqual(['bar A']);
    g.stop();
    expect(fresh()).toEqual([]);
  });
});
