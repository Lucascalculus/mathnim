// All visuals by name, and the compact catalog the AI chooses from.
import { describe_param } from './params';
import type { ParamSpec, Params, Visual } from './visual';

const visuals = new Map<string, Visual<any>>();

export function register(...vs: Visual<any>[]): void {
  for (const v of vs) {
    if (!/^[a-z][a-z0-9_]*$/.test(v.name)) throw new Error(`visual name '${v.name}' must be snake_case`);
    visuals.set(v.name, v);
  }
}
export function get_visual(name: string): Visual<Params> | undefined {
  return visuals.get(name);
}
export function list_visuals(topics?: string[]): Visual<Params>[] {
  const all = [...visuals.values()];
  if (!topics?.length) return all;
  const want = topics.map((t) => t.toLowerCase());
  return all.filter((v) => v.topics.some((t) => want.includes(t.toLowerCase())));
}

/**
 * The catalog as compact text (one block per visual), for a model's prompt:
 *
 *   circle_slices - Cut a circle into n slices and rearrange them into a near-rectangle ...
 *     n: integer in [4, 64] =8 - number of slices
 *     ...
 */
export function catalog(topics?: string[]): string {
  return list_visuals(topics)
    .map((v) => [`${v.name} - ${v.summary}`, ...(Object.entries(v.params) as [string, ParamSpec][]).map(([k, s]) => `  ${describe_param(k, s)}`)].join('\n'))
    .join('\n');
}
