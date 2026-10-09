// Helpers shared by the lessons of parts A and F of the fine-tuning course:
// scenes and worlds from @mathnim/visuals, figures in the learner's language,
// the decision map that closes every lesson, and its "how to choose" card.
import type { Block, CheckpointStep, ExploreStep, L10n, ReadStep, SceneStep } from '@mathnim/core';
import { check_params, get_visual } from '@mathnim/visuals';
import { CARDS, ft_lang, type LessonId } from '@mathnim/visuals/ft/f';
import '@mathnim/visuals/ft/a';
import { AnimationGroup } from 'manim-web';

/** Text in both languages. */
export const T = (en: string, zh: string): L10n => ({ en, zh });

/** A visual's scene with checked parameters ('lang' defaults to the learner's). */
export function vis(name: string, raw: Record<string, unknown> = {}): () => any {
  return () => {
    const v = get_visual(name)!;
    return v.scene(check_params(v, raw).params);
  };
}
/** A world's setup from a visual's explore(); `start` first moves the scene to a neutral position. */
export function hold(name: string, raw: Record<string, unknown> = {}, start?: (scene: any) => void): NonNullable<ExploreStep['setup']> {
  return (scene, ui) => {
    start?.(scene);
    const v = get_visual(name)!;
    v.explore?.(scene, ui, check_params(v, raw).params);
  };
}
/** A figure from public/ft/<part>/<base>.<lang>.svg: the file in the learner's language is chosen when the page is drawn. */
export function figure(base: string, alt: L10n, caption?: L10n, credit?: string): Block {
  const b: any = { type: 'figure', alt, ...(caption ? { caption } : {}), ...(credit ? { credit } : {}) };
  Object.defineProperty(b, 'src', { get: () => `${base}.${ft_lang()}.svg`, enumerable: true });
  return b as Block;
}
/** A visual embedded in a page; its labels follow the learner's language. */
export const visual = (name: string, params: Record<string, unknown> = {}, caption?: L10n, explore = false): Block => ({ type: 'visual', name, params, ...(caption ? { caption } : {}), explore });

/** The decision map as it stands after `lesson`, with that lesson's nodes highlighted and its card shown. */
export function map_scene(id: string, lesson: LessonId, narration: L10n): SceneStep {
  return {
    id, kind: 'scene', chapter: T('How to choose', '怎么选'), title: T('The decision map so far', '决策图（到本课为止）'),
    scene: vis('decision_map', { upto: lesson, card: lesson, highlight: CARDS[lesson].nodes.join(',') }),
    narration,
  };
}
/** The lesson's "how to choose" card: the rule, the tempting mistake it prevents, and where it sits on the map. */
export function card_page(id: string, rule: L10n, counter: L10n, nodes: string, extra: Block[] = []): ReadStep {
  return {
    id, kind: 'read', title: T('The card for this lesson', '本课的"怎么选"卡片'),
    blocks: [
      { type: 'callout', kind: 'note', title: T(`Rule (map nodes ${nodes})`, `规则（决策图节点 ${nodes}）`), body: rule },
      { type: 'callout', kind: 'misconception', title: T('The tempting mistake', '诱人的错误'), body: counter },
      ...extra,
    ],
  };
}
/** A case: several checkpoints that share one brief (CheckpointStep.group). */
export function case_group(id: string, title: L10n, brief: Block[]): NonNullable<CheckpointStep['group']> {
  return { id, title, brief };
}

/**
 * Move trackers to new values: animated when the scene is on a live player,
 * set directly otherwise (headless checks). Always ends at the exact values.
 */
export async function animate_to(scene: any, ui: any, pairs: [any, number][], run_time = 0.9): Promise<void> {
  const p = ui?.player;
  if (p && typeof p.play_now === 'function' && p.scene === scene && pairs.length) {
    try {
      await p.play_now(AnimationGroup(...pairs.map(([t, v]) => t.animate.set_value(v))), { run_time });
    } catch {
      /* fall through to the exact values */
    }
  }
  for (const [t, v] of pairs) t.set_value(v);
  ui?.notify?.();
}
/** Call `f` on every frame while the world is live (a quiet scene-level poll). */
export function watch(scene: any, f: () => void): void {
  scene.add_updater(() => f());
}
