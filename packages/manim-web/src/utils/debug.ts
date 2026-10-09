// manim/utils/debug.py
import type { Mobject } from '../mobject/mobject';
import { BLACK } from './color/manim_colors';
import type { ParsableManimColor } from './color/core';
import type { Kwargs } from './pyargs';
import { registry } from './registry';

/** Prints the submobject tree of a mobject. */
export function print_family(mobject: Mobject, n_tabs = 0): void {
  console.log('\t'.repeat(n_tabs), String(mobject));
  for (const submob of mobject.submobjects) print_family(submob, n_tabs + 1);
}

/** Integer labels showing the index of each submobject (to find parts of a MathTex, say). */
export function index_labels(mobject: Mobject, label_height = 0.15, background_stroke_width = 5, background_stroke_color: ParsableManimColor = BLACK, kwargs: Kwargs = {}): any {
  const labels = new registry.VGroup();
  let n = 0;
  for (const submob of mobject) {
    const label = new registry.Integer(n++, { ...kwargs });
    label.set_stroke(background_stroke_color, background_stroke_width, { background: true });
    label.height = label_height;
    label.move_to(submob);
    labels.add(label);
  }
  return labels;
}
