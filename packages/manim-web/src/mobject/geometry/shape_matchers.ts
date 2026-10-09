// manim/mobject/geometry/shape_matchers.py
import { config } from '../../_config';
import { DOWN, LEFT, RIGHT, SMALL_BUFF, UP } from '../../constants';
import { BLACK, PURE_YELLOW, RED } from '../../utils/color/manim_colors';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { register } from '../../utils/registry';
import { add } from '../../utils/vector';
import { Group, Mobject } from '../mobject';
import { VGroup, type VMobject } from '../types/vectorized_mobject';
import { Line } from './line';
import { RoundedRectangle } from './polygram';

/** A rectangle around one or more mobjects. */
export class SurroundingRectangle extends RoundedRectangle {
  declare buff: number | [number, number];
  constructor(...args: unknown[]) {
    const [mobjects, kw] = starArgs<Mobject>(args);
    const { color = PURE_YELLOW, buff = SMALL_BUFF, corner_radius = 0.0, ...rest } = kw;
    if (!mobjects.every((m) => m instanceof Mobject)) throw new TypeError('Expected all inputs for parameter mobjects to be a Mobjects');
    const [bx, by] = Array.isArray(buff) ? buff : [buff, buff];
    const group = new Group(...mobjects);
    super({ ...rest, color, width: group.width + 2 * bx, height: group.height + 2 * by, corner_radius });
    this.buff = buff;
    this.move_to(group);
  }
}

/** A translucent rectangle (background colour) behind mobjects. */
export class BackgroundRectangle extends SurroundingRectangle {
  declare original_fill_opacity: number;
  constructor(...args: unknown[]) {
    const [mobjects, kw] = starArgs<Mobject>(args);
    const { color = null, stroke_width = 0, stroke_opacity = 0, fill_opacity = 0.75, buff = 0, ...rest } = kw;
    super(...mobjects, { ...rest, color: color ?? config.background_color, stroke_width, stroke_opacity, fill_opacity, buff });
    this.original_fill_opacity = this.fill_opacity;
  }
  override pointwise_become_partial(_mobject: VMobject, _a: number, b: number): this {
    this.set_fill({ opacity: b * this.original_fill_opacity });
    return this;
  }
  override set_style(kw: Kwargs = {}): this {
    super.set_style({ stroke_color: BLACK, stroke_width: 0, fill_color: BLACK, fill_opacity: kw.fill_opacity });
    return this;
  }
}

/** An X over a mobject. */
export class Cross extends VGroup {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['mobject', 'stroke_color', 'stroke_width', 'scale_factor'], { mobject: null, stroke_color: RED, stroke_width: 6.0, scale_factor: 1.0 });
    const { mobject, stroke_color, stroke_width, scale_factor, ...rest } = o;
    super(new Line(add(UP, LEFT), add(DOWN, RIGHT)), new Line(add(UP, RIGHT), add(DOWN, LEFT)), rest);
    if (mobject !== null) this.replace(mobject, 0, true);
    this.scale(scale_factor);
    this.set_stroke({ color: stroke_color, width: stroke_width });
  }
}

/** A line under a mobject. */
export class Underline extends Line {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['mobject', 'buff'], { buff: SMALL_BUFF });
    const { mobject, buff, ...rest } = o;
    super(LEFT, RIGHT, { ...rest, buff });
    this.match_width(mobject);
    this.next_to(mobject, DOWN, { buff: this.buff });
  }
}

register({ SurroundingRectangle, BackgroundRectangle });
