// Helpers shared by the part B lessons (SFT).
import type { Block, L10n } from '@mathnim/core';
import { check_params, get_visual } from '@mathnim/visuals';

/** A visual's scene with checked parameters (the visual is registered by its part's index). */
export const vis = (name: string, raw: Record<string, unknown> = {}) => () => {
  const v = get_visual(name);
  if (!v) throw new Error(`visual '${name}' is not registered`);
  return v.scene(check_params(v, raw).params);
};

/** Two-language text. */
export const t = (en: string, zh: string): L10n => ({ en, zh });

/**
 * Run `add` (which adds handles to `ui`), then call `on(i)` whenever the value
 * behind one of the new handles changes (drag or keyboard), with the index of
 * that handle among the new ones.
 */
export function on_handles(ui: any, add: () => void, on: (i: number) => void): void {
  const n0 = ui.handles.length;
  add();
  ui.handles.slice(n0).forEach((h: any, i: number) => {
    const prev = h.spec.on_change;
    let last = JSON.stringify(h.position());
    h.spec.on_change = (p: unknown) => {
      prev?.(p);
      const now = JSON.stringify(h.position());
      if (now !== last) {
        last = now;
        on(i);
      }
    };
  });
}

/** The "how to choose" page of a lesson: the course's decision map, its rule, its counterexample. */
export function choose_card(o: { upto: string; highlight: string; card: string; rule: L10n; counter: L10n; extra?: Block[] }): Block[] {
  return [
    { type: 'visual', name: 'decision_map', params: { upto: o.upto, highlight: o.highlight, card: o.card }, caption: t('The course decision map so far; this lesson adds the highlighted nodes.', '到本课为止的决策图；高亮的是本课新增的节点。') },
    { type: 'callout', kind: 'note', title: t('Rule', '规则'), body: o.rule },
    { type: 'callout', kind: 'misconception', title: t('Tempting but wrong', '诱人但错误'), body: o.counter },
    ...(o.extra ?? []),
  ];
}

/** Attach a visual's own explore() handles to a world, calling `on(i)` when the value behind one changes. */
export function attach_visual(name: string, raw: Record<string, unknown>, scene: any, ui: any, on: (i: number) => void): void {
  const v = get_visual(name);
  if (!v?.explore) return;
  on_handles(ui, () => v.explore!(scene, ui, check_params(v, raw).params), on);
}
