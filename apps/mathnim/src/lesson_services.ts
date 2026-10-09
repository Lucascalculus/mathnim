// What the lesson view gets from the app: visuals for text pages (from
// @mathnim/visuals, parameters checked) and the AI grader for free-text answers.
import { grade_text } from '@mathnim/ai';
import type { TextGrader, VisualResolver } from '@mathnim/present';
import { check_params, get_visual } from '@mathnim/visuals';
import { has_model, language_name, provider } from './settings';

/** A registered visual with checked parameters, or null when the name is unknown. */
export const visual_resolver: VisualResolver = (name, params) => {
  const v = get_visual(name);
  if (!v) return null;
  const p = check_params(v, params ?? {}).params;
  return { scene: () => v.scene(p), explore: v.explore ? (scene, ui) => v.explore!(scene, ui, p) : undefined };
};

/** The AI grader when a model is available (offline: undefined, the learner assesses their own answer). */
export function text_grader(): TextGrader | undefined {
  if (!has_model()) return undefined;
  return (q) => grade_text({ question: q.question, answer: q.answer, key_points: q.key_points, model_answer: q.model_answer, language: language_name(q.lang) }, { provider: provider() });
}
