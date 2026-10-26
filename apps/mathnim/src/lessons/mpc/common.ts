// Helpers shared by the MPC lessons (docs/lessons/mpc). Every MPC visual is
// registered by the one pack '@mathnim/visuals/mpc' (packages/visuals/src/mpc/index.ts).
import type { L10n, LessonContext } from '@mathnim/core';
import { check_params, get_visual } from '@mathnim/visuals';

/** Two-language text. */
export const t = (en: string, zh: string): L10n => ({ en, zh });

/** A visual's scene with checked parameters, drawn in the learner's language unless the lesson fixed one. */
export const vis = (name: string, raw: Record<string, unknown> = {}) => (ctx?: LessonContext) => {
  const v = get_visual(name);
  if (!v) throw new Error(`visual '${name}' is not registered`);
  const p = 'lang' in v.params && ctx?.lang && raw.lang === undefined ? { ...raw, lang: ctx.lang } : raw;
  return v.scene(check_params(v, p).params);
};

/**
 * A world's setup for an MPC visual: the visual reports what the learner does
 * through `scene.listen((type, data) => ...)` (kit's listen/emit); here every
 * report becomes a world event. Then the visual's own handles are attached
 * (its `explore()`, with the same parameters as the scene).
 */
export function attach(name: string, raw: Record<string, unknown> = {}) {
  return (scene: any, ui: any, ctx: LessonContext, world: { emit(type: string, data?: Record<string, unknown>): void }) => {
    const v = get_visual(name);
    if (!v) throw new Error(`visual '${name}' is not registered`);
    scene.listen?.((type: string, data: Record<string, unknown>) => world.emit(type, data));
    const p = 'lang' in v.params && ctx?.lang && raw.lang === undefined ? { ...raw, lang: ctx.lang } : raw;
    v.explore?.(scene, ui, check_params(v, p).params);
  };
}
