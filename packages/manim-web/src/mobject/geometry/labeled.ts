// manim/mobject/geometry/labeled.py
import { DEFAULT_FONT_SIZE } from '../../constants';
import { WHITE } from '../../utils/color/manim_colors';
import { polylabel } from '../../utils/polylabel';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { registry } from '../../utils/registry';
import { add, mul, sub, to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { VGroup, type VMobject } from '../types/vectorized_mobject';
import { Arrow, Line } from './line';
import { Polygram } from './polygram';
import { BackgroundRectangle, SurroundingRectangle } from './shape_matchers';

/** A text label (MathTex for strings) on a background box with a frame. */
export class Label extends VGroup {
  declare rendered_label: VMobject;
  declare background_rect: BackgroundRectangle;
  declare frame: SurroundingRectangle;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['label', 'label_config', 'box_config', 'frame_config'], { label_config: null, box_config: null, frame_config: null });
    const { label, label_config, box_config, frame_config, ...kwargs } = o;
    super(kwargs);
    const lc = { color: WHITE, font_size: DEFAULT_FONT_SIZE, ...(label_config ?? {}) };
    const bc = { color: null, buff: 0.05, fill_opacity: 1, stroke_width: 0.5, ...(box_config ?? {}) };
    const fc = { color: WHITE, buff: 0.05, stroke_width: 0.5, ...(frame_config ?? {}) };
    if (typeof label === 'string') this.rendered_label = new registry.MathTex(label, lc);
    else if (label instanceof registry.MathTex || label instanceof registry.Text || (registry.Typst && label instanceof registry.Typst)) this.rendered_label = label;
    else throw new TypeError('Unsupported label type. Must be MathTex, Tex, Text, Typst, or MathTypst.');
    this.background_rect = new BackgroundRectangle(this.rendered_label, bc);
    this.frame = new SurroundingRectangle(this.rendered_label, fc);
    this.add(this.background_rect, this.rendered_label, this.frame);
  }
}

/** LabeledLine's labelling step (shared with LabeledArrow, which inherits from both in manim). */
function attachLabel(line: Line, o: Kwargs): Label {
  const label = new Label({ label: o.label, label_config: o.label_config, box_config: o.box_config, frame_config: o.frame_config });
  const [line_start, line_end] = line.get_start_and_end();
  const new_vec = mul(sub(line_end, line_start), o.label_position);
  label.move_to(add(line_start, new_vec));
  line.add(label);
  return label;
}
const LABEL_ARGS = ['label', 'label_position', 'label_config', 'box_config', 'frame_config', '*args'];
const LABEL_DEFAULTS = { label_position: 0.5, label_config: null, box_config: null, frame_config: null };

/** A Line with a boxed label at `label_position` along it. */
export class LabeledLine extends Line {
  declare label: Label;
  constructor(...args: unknown[]) {
    const o = pyargs(args, LABEL_ARGS, LABEL_DEFAULTS);
    const { label, label_position, label_config, box_config, frame_config, args: rest = [], ...kwargs } = o;
    super(...rest, kwargs);
    this.label = attachLabel(this, o);
  }
}

/** An Arrow with a boxed label at `label_position` along it. */
export class LabeledArrow extends Arrow {
  declare label: Label;
  constructor(...args: unknown[]) {
    const o = pyargs(args, LABEL_ARGS, LABEL_DEFAULTS);
    const { label, label_position, label_config, box_config, frame_config, args: rest = [], ...kwargs } = o;
    super(...rest, kwargs);
    this.label = attachLabel(this, o);
  }
}

/** A Polygram with a label at its pole of inaccessibility (the inside point farthest from the edges). */
export class LabeledPolygram extends Polygram {
  declare label: Label;
  declare pole: Point3D;
  declare radius: number;
  constructor(...args: unknown[]) {
    const [vertex_groups, kw] = starArgs<readonly Point3DLike[]>(args);
    const { label, precision = 0.01, label_config = null, box_config = null, frame_config = null, ...kwargs } = kw;
    super(...vertex_groups, kwargs);
    this.label = new Label({ label, label_config, box_config, frame_config });
    const rings = vertex_groups.map((group) => {
      const g = Array.from(group, to3);
      const [first, last] = [g[0], g[g.length - 1]];
      return first.every((x, i) => x === last[i]) ? g : [...g, first];
    });
    const cell = polylabel(rings, precision);
    this.pole = [cell.c[0], cell.c[1], 0];
    this.radius = cell.d;
    this.label.move_to(this.pole);
    this.add(this.label);
  }
}
