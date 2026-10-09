// manim/mobject/svg/brace.py
import { DEFAULT_MOBJECT_TO_MOBJECT_BUFFER, DOWN, LEFT, ORIGIN, RIGHT, UP } from '../../constants';
import { BLACK } from '../../utils/color/manim_colors';
import { Complex } from '../../utils/complex';
import { getPoint } from '../../utils/points';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { parse_path } from '../../utils/svgelements';
import { add, mul, norm, sub, to3, type Point3D } from '../../utils/vector';
import type { Mobject } from '../mobject';
import { VMobject } from '../types/vectorized_mobject';
import { VMobjectFromSVGPath } from './svg_mobject';

const PATH_STRING_TEMPLATE =
  'm0.01216 0c-0.01152 0-0.01216 6.103e-4 -0.01216 0.01311v0.007762c0.06776 0.122 0.1799 0.1455 0.2307 0.1455h{0}c0.03046 3.899e-4 0.07964 0.00449 0.1246 0.02636 0.0537 0.02695 0.07418 0.05816 0.08648 0.07769 0.001562 0.002538 0.004539 0.002563 0.01098 0.002563 0.006444-2e-8 0.009421-2.47e-5 0.01098-0.002563 0.0123-0.01953 0.03278-0.05074 0.08648-0.07769 0.04491-0.02187 0.09409-0.02597 0.1246-0.02636h{0}c0.05077 0 0.1629-0.02346 0.2307-0.1455v-0.007762c-1.78e-6 -0.0125-6.365e-4 -0.01311-0.01216-0.01311-0.006444-3.919e-8 -0.009348 2.448e-5 -0.01091 0.002563-0.0123 0.01953-0.03278 0.05074-0.08648 0.07769-0.04491 0.02187-0.09416 0.02597-0.1246 0.02636h{1}c-0.04786 0-0.1502 0.02094-0.2185 0.1256-0.06833-0.1046-0.1706-0.1256-0.2185-0.1256h{1}c-0.03046-3.899e-4 -0.07972-0.004491-0.1246-0.02636-0.0537-0.02695-0.07418-0.05816-0.08648-0.07769-0.001562-0.002538-0.004467-0.002563-0.01091-0.002563z';
const DEFAULT_MIN_WIDTH = 0.90552;

/** A curly brace next to a mobject (on the side given by `direction`). */
export class Brace extends VMobjectFromSVGPath {
  declare buff: number;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['mobject', 'direction', 'buff', 'sharpness', 'stroke_width', 'fill_opacity', 'background_stroke_width', 'background_stroke_color'], {
      direction: DOWN, buff: 0.2, sharpness: 2, stroke_width: 0, fill_opacity: 1.0, background_stroke_width: 0, background_stroke_color: BLACK,
    });
    const { mobject, direction, buff, sharpness, ...kwargs } = o as Kwargs & { mobject: Mobject };
    const dir = to3(direction);
    const angle = -Math.atan2(dir[0], dir[1]) + Math.PI;
    mobject.rotate(-angle, { about_point: ORIGIN });
    const left = mobject.get_corner(add(DOWN, LEFT));
    const right = mobject.get_corner(add(DOWN, RIGHT));
    const target_width = right[0] - left[0];
    const linear_section_length = Math.max(0, (target_width * sharpness - DEFAULT_MIN_WIDTH) / 2);
    const path = parse_path(PATH_STRING_TEMPLATE.replaceAll('{0}', String(linear_section_length)).replaceAll('{1}', String(-linear_section_length)));
    super({ ...kwargs, path_obj: path });
    this.buff = buff;
    this.flip(RIGHT);
    this.stretch_to_fit_width(target_width);
    this.shift(add(sub(left, this.get_corner(add(UP, LEFT))), mul(this.buff, DOWN)));
    for (const mob of [mobject, this]) mob.rotate(angle, { about_point: ORIGIN });
  }
  /** Place `mob` at the tip of the brace. */
  put_at_tip(mob: Mobject, ...rest: unknown[]): this {
    const o = pyargs(rest, ['use_next_to'], { use_next_to: true });
    const { use_next_to, ...kwargs } = o;
    if (use_next_to) mob.next_to(this.get_tip(), (this.get_direction() as Point3D).map((x: number) => Math.round(x)) as Point3D, kwargs);
    else {
      mob.move_to(this.get_tip());
      const buff = kwargs.buff ?? DEFAULT_MOBJECT_TO_MOBJECT_BUFFER;
      const shift_distance = mob.width / 2.0 + buff;
      mob.shift(mul(this.get_direction(), shift_distance));
    }
    return this;
  }
  /** A Tex label at the tip. */
  get_text(...args: unknown[]): any {
    const [text, kwargs] = starArgs<string>(args);
    const text_mob = new registry.Tex(...text);
    this.put_at_tip(text_mob, kwargs);
    return text_mob;
  }
  /** A MathTex label at the tip. */
  get_tex(...args: unknown[]): any {
    const [tex, kwargs] = starArgs<string>(args);
    const tex_mob = new registry.MathTex(...tex);
    this.put_at_tip(tex_mob, kwargs);
    return tex_mob;
  }
  get_tip(): Point3D {
    return getPoint(this.points, 28);
  }
  /** The unit vector from the brace's center to its tip (overrides VMobject's CW/CCW get_direction, like manim). */
  override get_direction(): any {
    const vect = sub(this.get_tip(), this.get_center());
    return mul(vect, 1 / norm(vect));
  }
}

/** A brace together with a label. */
export class BraceLabel extends VMobject {
  declare label_constructor: any;
  declare brace_direction: Point3D;
  declare brace: Brace;
  declare label: VMobject;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['obj', 'text', 'brace_direction', 'label_constructor', 'font_size', 'buff', 'brace_config'], {
      brace_direction: DOWN, label_constructor: null, font_size: 48, buff: 0.2, brace_config: null,
    });
    const { obj, text, brace_direction, label_constructor, font_size, buff, brace_config, ...kwargs } = o;
    super(kwargs);
    this.label_constructor = label_constructor ?? registry.MathTex;
    this.brace_direction = to3(brace_direction);
    this.brace = new Brace(obj, brace_direction, buff, brace_config ?? {});
    if (Array.isArray(text)) this.label = new this.label_constructor(...text, { font_size, ...kwargs });
    else this.label = new this.label_constructor(String(text), { font_size });
    this.brace.put_at_tip(this.label);
    this.add(this.brace, this.label);
  }
  creation_anim(label_anim: any = null, brace_anim: any = null): any {
    const LA = label_anim ?? registry.FadeIn, BA = brace_anim ?? registry.GrowFromCenter;
    return new registry.AnimationGroup(new BA(this.brace), new LA(this.label));
  }
  shift_brace(obj: Mobject | Mobject[], kwargs: Kwargs = {}): this {
    if (Array.isArray(obj)) obj = new (this.get_group_class())(...obj);
    this.brace = new Brace(obj, this.brace_direction, kwargs);
    this.brace.put_at_tip(this.label);
    return this;
  }
  change_label(...args: unknown[]): this {
    const [text, kwargs] = starArgs<string>(args);
    this.remove(this.label);
    this.label = new this.label_constructor(...text, kwargs);
    this.brace.put_at_tip(this.label);
    this.add(this.label);
    return this;
  }
  change_brace_label(obj: Mobject, ...args: unknown[]): this {
    this.shift_brace(obj);
    this.change_label(...args);
    return this;
  }
}

/** A brace with a Text label. */
export class BraceText extends BraceLabel {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['obj', 'text', 'label_constructor'], { label_constructor: null });
    super({ ...o, label_constructor: o.label_constructor ?? registry.Text });
  }
}

/** A brace between two points (on the right of the direction point_1 -> point_2 by default). */
export class BraceBetweenPoints extends Brace {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['point_1', 'point_2', 'direction'], { direction: ORIGIN });
    const { point_1, point_2, ...rest } = o;
    let direction = to3(o.direction);
    if (direction.every((x) => x === 0)) {
      const line_vector = sub(point_2, point_1);
      direction = [line_vector[1], -line_vector[0], 0];
    }
    super(new registry.Line(point_1, point_2), { ...rest, direction });
  }
}

/** A brace bent along an arc. */
export class ArcBrace extends Brace {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['arc', 'direction'], { arc: null, direction: RIGHT });
    let { arc, direction, ...kwargs } = o;
    if (arc === null || arc === undefined) arc = new registry.Arc({ start_angle: -1, angle: 2, radius: 1 });
    const arc_end_angle = arc.start_angle + arc.angle;
    const line = new registry.Line(mul(UP, arc.start_angle), mul(UP, arc_end_angle));
    const scale_shift = mul(RIGHT, Math.log(arc.radius));
    if (arc.radius >= 1) {
      line.scale(arc.radius, { about_point: ORIGIN });
      super(line, { ...kwargs, direction });
      this.scale(1 / arc.radius, { about_point: ORIGIN });
    } else super(line, { ...kwargs, direction });
    if (arc.radius >= 0.3) this.shift(scale_shift);
    else this.shift(mul(RIGHT, Math.log(0.3)));
    this.apply_complex_function((z: Complex) => z.exp());
    this.shift(arc.get_arc_center());
  }
}

register({ Brace, BraceLabel, BraceText, BraceBetweenPoints, ArcBrace });
