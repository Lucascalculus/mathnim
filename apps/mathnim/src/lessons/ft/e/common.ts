// Helpers shared by the part E lessons (reasoning: GRPO, the R1 recipe,
// distillation). The visuals are registered by packages/visuals/src/ft/e.
import type { Block, ExploreStep, L10n } from '@mathnim/core';
import { check_params, get_visual } from '@mathnim/visuals';

/** Two-language text. */
export const t = (en: string, zh: string): L10n => ({ en, zh });

/** A visual's scene with checked parameters. */
export const vis = (name: string, raw: Record<string, unknown> = {}) => () => {
  const v = get_visual(name);
  if (!v) throw new Error(`visual '${name}' is not registered`);
  return v.scene(check_params(v, raw).params);
};

/**
 * A world's setup for a part E visual: the visual reports what the learner
 * does through `scene.on(type, data)`; here that becomes a world event, then
 * the visual's own handles are attached.
 */
export const world_setup = (extra?: (scene: any, world: any) => void): ExploreStep['setup'] => (scene: any, ui, _ctx, world) => {
  scene.on = (type: string, data?: Record<string, unknown>) => world.emit(type, data);
  extra?.(scene, world);
  scene.attach(ui);
};

/** A text page block that embeds a part E diagram. */
export const fig = (which: string, caption: L10n): Block => ({ type: 'visual', name: 'e_figure', params: { which }, caption });

/** The "how to choose" page of a lesson: the course's decision map, the rules this lesson adds, the tempting mistakes. */
export function choose_card(o: { upto: string; highlight: string; card: string; rules: L10n[]; counter: L10n[] }): Block[] {
  return [
    { type: 'visual', name: 'decision_map', params: { upto: o.upto, highlight: o.highlight, card: o.card }, caption: t('The course decision map so far; this lesson adds the highlighted nodes.', '到本课为止的决策图；高亮的是本课新增的节点。') },
    { type: 'h', level: 3, text: t('Rules', '规则') },
    { type: 'list', ordered: true, items: o.rules },
    ...o.counter.map((body): Block => ({ type: 'callout', kind: 'misconception', title: t('Tempting but wrong', '诱人但错误'), body })),
  ];
}
