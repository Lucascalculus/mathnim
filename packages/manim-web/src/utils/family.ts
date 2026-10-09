// manim/utils/family.py
import type { Mobject } from '../mobject/mobject';
import { remove_list_redundancies } from './iterables';

export function extract_mobject_family_members(mobjects: readonly Mobject[], use_z_index = false, only_those_with_points = false): Mobject[] {
  const all: Mobject[] = [];
  for (const m of mobjects) all.push(...(only_those_with_points ? m.family_members_with_points() : m.get_family()));
  const out = remove_list_redundancies(all);
  if (use_z_index) {
    // stable sort, like Python's sorted
    return out.map((m, i) => [m, i] as const).sort((a, b) => a[0].z_index - b[0].z_index || a[1] - b[1]).map((x) => x[0]);
  }
  return out;
}
