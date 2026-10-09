// One cue at a time. manim-web's AffordanceLayer gives every unused handle a
// pulsing halo and every kind of item its own lead pulse, so a world with three
// sliders and a card opens with four rings at once: noisy, and it hides the
// order of the task. A CueGuide keeps exactly one control "unused" for the
// layer - the first control of the cue order that the learner has not used
// yet - and marks the others as used, so they show their plain static ring
// (handles) or nothing (items), without pulse or label. When the cued control
// has been used, the cue moves to the next one. The coach demonstration is
// pointed at the cued control.
//
// The order is the world's `cue` (handle or item labels) when it gives one,
// else every control in creation order (handles, then items, like Tab).
// world.cue([...]) moves it later.
//
// (The layer keeps its "used" sets private; they are the switch it already
// reads to decide what pulses, so the guide sets them each frame. When a
// manim-web without those sets is used, the guide does nothing.)
import { tr, type L10n } from '@mathnim/core';
import type { AffordanceLayer } from 'manim-web/ext/affordance';
import type { DragHandle, Interaction, InteractiveItem } from 'manim-web/ext/interact';

type Control = DragHandle | InteractiveItem;
interface LayerSets {
  used: WeakSet<DragHandle>;
  used_items: WeakSet<InteractiveItem>;
  used_kinds: Set<string>;
}
const label_of = (c: Control): string | undefined => ('spec' in c ? c.spec.label : c.label);

export class CueGuide {
  /** The world's order (labels), or null: every control in creation order (controls added later included). */
  private targets: L10n[] | null = null;
  private done = new WeakSet<object>();
  private raf = 0;
  private stopped = false;

  constructor(private layer: AffordanceLayer, private ui: Interaction, targets?: L10n[]) {
    this.set(targets);
    const loop = () => {
      this.tick();
      this.raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(loop) : 0;
    };
    loop();
  }

  /** Cue these controls, in order (labels; both languages of an L10n match); none: every control in creation order. */
  set(targets?: L10n[]): void {
    this.targets = targets?.length ? [...targets] : null;
    this.stopped = false;
    this.tick();
  }
  /** The cue order now (resolved every time: controls may be added later, e.g. unlocked by a goal). */
  private order(): Control[] {
    const all: Control[] = [...this.ui.handles, ...this.ui.items];
    if (!this.targets) return all;
    const picked = new Set<Control>();
    for (const t of this.targets) {
      const want = [tr(t, 'en'), tr(t, 'zh')].map((s) => s.trim()).filter(Boolean);
      const hit = all.find((c) => !picked.has(c) && want.includes((label_of(c) ?? '').trim()));
      if (hit) picked.add(hit);
    }
    // nothing on screen matches (yet): fall back to every control rather than to no cue at all
    return picked.size ? [...picked] : all;
  }
  /** The control being cued now (undefined when all are used). */
  target(): Control | undefined {
    if (this.stopped) return undefined;
    return this.order().find((c) => !this.done.has(c) && (('spec' in c) || c.enabled !== false));
  }
  /** The learner acted some other way (e.g. a number in the prompt): no more cues. */
  stop(): void {
    this.stopped = true;
    this.tick();
  }
  /** Note what was used and hand the layer the one control to cue. */
  tick(): void {
    const L = this.layer as unknown as Partial<LayerSets>;
    for (const c of [...this.ui.handles, ...this.ui.items]) if (c.active || c.focused) this.done.add(c);
    if (!(L.used instanceof WeakSet) || !(L.used_items instanceof WeakSet) || !(L.used_kinds instanceof Set)) return;
    const target = this.target();
    for (const h of this.ui.handles) {
      if (h === target) L.used.delete(h);
      else L.used.add(h);
    }
    for (const it of this.ui.items) {
      if (it === target) {
        L.used_items.delete(it);
        L.used_kinds.delete(it.kind);
      } else L.used_items.add(it);
    }
  }
  dispose(): void {
    if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
