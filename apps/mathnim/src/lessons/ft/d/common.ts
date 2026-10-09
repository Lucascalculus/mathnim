// Helpers shared by the part D lessons (preference optimization).
import type { Block, ExploreStep, L10n, LessonContext, Question } from '@mathnim/core';
import { check_params, get_visual } from '@mathnim/visuals';

/** Canvas words in the learner's language (for handle labels set up when a world starts). */
export const say = (ctx: LessonContext | undefined, en: string, zh: string): string => (ctx?.lang === 'zh' ? zh : en);

/** The visual's parameters, with the learner's language unless the lesson fixed one. */
const params_for = (v: NonNullable<ReturnType<typeof get_visual>>, raw: Record<string, unknown>, ctx?: LessonContext) =>
  check_params(v, 'lang' in v.params && ctx?.lang && raw.lang === undefined ? { ...raw, lang: ctx.lang } : raw).params;

/** Two-language text. */
export const t = (en: string, zh: string): L10n => ({ en, zh });

/** A visual's scene with checked parameters (registered by packages/visuals/src/ft/d/index.ts). */
export const vis = (name: string, raw: Record<string, unknown> = {}) => (ctx?: LessonContext) => {
  const v = get_visual(name);
  if (!v) throw new Error(`visual '${name}' is not registered`);
  return v.scene(params_for(v, raw, ctx));
};

/** A world's setup: route the scene's events to the world, add the visual's handles, then `extra`. */
export const world_setup = (name: string, raw: Record<string, unknown> = {}, extra?: ExploreStep['setup']): ExploreStep['setup'] => (scene: any, ui, ctx, world) => {
  scene.emit = (type: string, data?: Record<string, unknown>) => world.emit(type, data);
  const v = get_visual(name)!;
  v.explore?.(scene, ui, params_for(v, raw, ctx));
  extra?.(scene, ui, ctx, world);
};

/** Run f on every frame while the world is live (a scene-level updater). */
export const watch = (scene: any, f: () => void): void => {
  scene.add_updater(() => f());
};

// ---------------------------------------------------------------- page blocks
export const h = (en: string, zh: string): Block => ({ type: 'h', text: t(en, zh) });
export const p = (en: string, zh: string): Block => ({ type: 'p', text: t(en, zh) });
export const list = (items: [string, string][], ordered = false): Block => ({ type: 'list', items: items.map(([en, zh]) => t(en, zh)), ordered });
export const math = (tex: string, label?: string): Block => ({ type: 'math', tex, label });
export const note = (en: string, zh: string, title?: [string, string]): Block => ({ type: 'callout', kind: 'note', body: t(en, zh), title: title ? t(...title) : undefined });
export const warn = (en: string, zh: string, title?: [string, string]): Block => ({ type: 'callout', kind: 'warning', body: t(en, zh), title: title ? t(...title) : undefined });
export const myth = (en: string, zh: string, title?: [string, string]): Block => ({ type: 'callout', kind: 'misconception', body: t(en, zh), title: title ? t(...title) : undefined });
export const open_q = (en: string, zh: string, title?: [string, string]): Block => ({ type: 'callout', kind: 'open', body: t(en, zh), title: title ? t(...title) : undefined });
export const details = (summary: [string, string], blocks: Block[]): Block => ({ type: 'details', summary: t(...summary), blocks });
/** A figure drawn once per language: public/ft/d/<base>.en.svg and <base>.zh.svg. */
export const fig = (base: string, alt: [string, string], caption: [string, string], credit?: string): Block => ({
  type: 'figure', src: { en: `ft/d/${base}.en.svg`, zh: `ft/d/${base}.zh.svg` }, alt: t(...alt), caption: t(...caption), credit,
});
/** A source for a footnote [^key]: `who` like 'Ouyang et al. 2022', the title as published. */
export const cite = (key: string, who: string, title: string, url: string): Block => ({
  type: 'cite', key, url, text: t(`${who}, ${title}`, `${who.replace(' et al.', ' 等')}：${title}`),
});
export const table = (head: [string, string][], rows: (string | [string, string])[][]): Block => ({
  type: 'table', head: head.map(([en, zh]) => t(en, zh)), rows: rows.map((r) => r.map((c) => (typeof c === 'string' ? c : t(c[0], c[1])))),
});

/** The "how to choose" page of a lesson: the course decision map, its rule and a tempting wrong choice. */
export function choose_card(o: { upto: string; highlight: string; rule: L10n; counter: L10n; extra?: Block[] }): Block[] {
  return [
    { type: 'visual', name: 'decision_map', params: { upto: o.upto, highlight: o.highlight, card: o.upto }, caption: t('The course decision map so far; this lesson adds the highlighted nodes.', '到本课为止的决策图；高亮的是本课新增的节点。') },
    { type: 'callout', kind: 'note', title: t('Rule', '规则'), body: o.rule },
    { type: 'callout', kind: 'misconception', title: t('Tempting but wrong', '诱人但错误'), body: o.counter },
    ...(o.extra ?? []),
  ];
}

/** A free-text question checked against key points. */
export const text_q = (points: [string, string][], model: [string, string], min?: number): Question => ({
  type: 'text', rubric: { key_points: points.map(([en, zh]) => t(en, zh)), model_answer: t(...model), min_points: min },
});
