// manim/utils/config_ops.py (dict helpers; DictAsObject and the OpenGL data descriptors are not needed)
import { isKwargs, type Kwargs } from './pyargs';

/** Merge dicts left to right; nested plain objects are merged recursively (new object, inputs untouched). */
export function merge_dicts_recursively(...dicts: (Kwargs | null | undefined)[]): Kwargs {
  const result: Kwargs = {};
  for (const d of dicts) {
    if (!d) continue;
    for (const [key, value] of Object.entries(d)) {
      if (key in result && isKwargs(result[key]) && isKwargs(value)) result[key] = merge_dicts_recursively(result[key], value);
      else result[key] = value;
    }
  }
  return result;
}

/** Recursively update `current_dict` in place with `others`. */
export function update_dict_recursively(current_dict: Kwargs, ...others: (Kwargs | null | undefined)[]): void {
  Object.assign(current_dict, merge_dicts_recursively(current_dict, ...others));
}
