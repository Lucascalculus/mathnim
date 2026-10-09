// manim/animation/creation.py
import { config } from '../_config';
import { RIGHT, TAU } from '../constants';
import { Group, Mobject } from '../mobject/mobject';
import { VMobject } from '../mobject/types/vectorized_mobject';
import { integer_interpolate } from '../utils/bezier';
import { pyargs, type Kwargs } from '../utils/pyargs';
import { double_smooth, linear } from '../utils/rate_functions';
import { add, mul, sub, type Point3D } from '../utils/vector';
import { Animation, type SceneLike } from './animation';
import { Succession } from './composition';

/** Draws part of a VMobject, from `_get_bounds(alpha)`. */
export class ShowPartial extends Animation {
  constructor(mobject: Mobject, ...rest: unknown[]) {
    if (typeof (mobject as any)?.pointwise_become_partial !== 'function') throw new TypeError(`${new.target.name} only works for VMobjects.`);
    super(mobject, ...rest);
  }
  override interpolate_submobject(submobject: Mobject, starting: Mobject, alpha: number): void {
    const [a, b] = this._get_bounds(alpha);
    (submobject as VMobject).pointwise_become_partial(starting as VMobject, a, b);
  }
  _get_bounds(_alpha: number): [number, number] {
    throw new Error('Please use Create or ShowPassingFlash');
  }
}

/** Draws a mobject along its outline. */
export class Create extends ShowPartial {
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['lag_ratio', 'introducer'], { lag_ratio: 1.0, introducer: true });
    super(mobject, o);
  }
  override _get_bounds(alpha: number): [number, number] {
    return [0, alpha];
  }
}

export class Uncreate extends Create {
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['reverse_rate_function', 'remover'], { reverse_rate_function: true, remover: true });
    super(mobject, { ...o, introducer: false });
  }
}

/** Draws the outline, then fills it in. */
export class DrawBorderThenFill extends Animation {
  declare stroke_width: number;
  declare stroke_color: any;
  declare outline: Mobject;
  constructor(vmobject: Mobject, ...rest: unknown[]) {
    if (!(vmobject instanceof VMobject)) throw new TypeError(`${new.target.name} only works for vectorized Mobjects`);
    const o = pyargs(rest, ['run_time', 'rate_func', 'stroke_width', 'stroke_color', 'introducer'], {
      run_time: 2, rate_func: double_smooth, stroke_width: 2, stroke_color: null, introducer: true,
    });
    const { stroke_width, stroke_color, ...kw } = o;
    super(vmobject, kw);
    this.stroke_width = stroke_width;
    this.stroke_color = stroke_color;
    this.outline = this.get_outline();
  }
  override begin(): void {
    this.outline = this.get_outline();
    super.begin();
  }
  get_outline(): Mobject {
    const outline = this.mobject.copy() as VMobject;
    outline.set_fill({ opacity: 0 });
    for (const sm of outline.family_members_with_points() as VMobject[]) sm.set_stroke({ color: this.get_stroke_color(sm), width: this.stroke_width });
    return outline;
  }
  get_stroke_color(vm: VMobject): any {
    if (this.stroke_color) return this.stroke_color;
    if (vm.get_stroke_width() > 0) return vm.get_stroke_color();
    return vm.get_color();
  }
  override get_all_mobjects(): Mobject[] {
    return [...super.get_all_mobjects(), this.outline];
  }
  override interpolate_submobject(submobject: Mobject, starting: Mobject, outline: Mobject, alpha: number): void {
    const [index, subalpha] = integer_interpolate(0, 2, alpha);
    const s = submobject as VMobject;
    if (index === 0) {
      s.pointwise_become_partial(outline as VMobject, 0, subalpha);
      s.match_style(outline as VMobject);
    } else s.interpolate(outline, starting, subalpha);
  }
}

/** Handwriting effect for text and formulas. */
export class Write extends DrawBorderThenFill {
  declare reverse: boolean;
  constructor(vmobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['rate_func', 'reverse'], { rate_func: linear, reverse: false });
    const { reverse, run_time, lag_ratio, ...kw } = o;
    const [rt, lr] = Write._set_default_config_from_length(vmobject, run_time ?? null, lag_ratio ?? null);
    if (!('remover' in kw)) kw.remover = reverse;
    super(vmobject, { ...kw, run_time: rt, lag_ratio: lr, introducer: !reverse });
    this.reverse = reverse;
  }
  static _set_default_config_from_length(vm: Mobject, run_time: number | null, lag_ratio: number | null): [number, number] {
    const length = vm.family_members_with_points().length;
    return [run_time ?? (length < 15 ? 1 : 2), lag_ratio ?? Math.min(4.0 / Math.max(1.0, length), 0.2)];
  }
  reverse_submobjects(): void {
    this.mobject.invert(true);
  }
  override begin(): void {
    if (this.reverse) this.reverse_submobjects();
    super.begin();
  }
  override finish(): void {
    super.finish();
    if (this.reverse) this.reverse_submobjects();
  }
}

export class Unwrite extends Write {
  constructor(vmobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['rate_func', 'reverse'], { rate_func: linear, reverse: true });
    const [rt, lr] = Write._set_default_config_from_length(vmobject, o.run_time ?? null, o.lag_ratio ?? null);
    super(vmobject, { ...o, run_time: rt, lag_ratio: lr, reverse_rate_function: true });
  }
}

/** Shapes spiral in from outside, fading in. */
export class SpiralIn extends Animation {
  declare shapes: Mobject;
  declare scale_factor: number;
  declare shape_center: Point3D;
  declare fade_in_fraction: number;
  constructor(shapes: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['scale_factor', 'fade_in_fraction'], { scale_factor: 8, fade_in_fraction: 0.3 });
    const { scale_factor, fade_in_fraction, ...kw } = o;
    const copy = shapes.copy();
    const center = shapes.get_center();
    for (const shape of shapes) {
      shape.final_position = shape.get_center();
      shape.initial_position = add(shape.final_position, mul(sub(shape.final_position, center), scale_factor));
      shape.move_to(shape.initial_position);
      shape.save_state();
    }
    super(shapes, { ...kw, introducer: true });
    this.shapes = copy;
    this.scale_factor = scale_factor;
    this.shape_center = center;
    this.fade_in_fraction = fade_in_fraction;
  }
  override interpolate_mobject(alpha: number): void {
    alpha = this.rate_func(alpha);
    const originals = [...this.shapes], shapes = [...this.mobject];
    originals.forEach((orig: any, i) => {
      const shape: any = shapes[i];
      shape.restore();
      const fo = orig.get_fill_opacity(), so = orig.get_stroke_opacity();
      shape.shift(mul(sub(shape.final_position, shape.initial_position), alpha));
      shape.rotate(TAU * alpha, { about_point: this.shape_center });
      shape.rotate(-TAU * alpha, { about_point: shape.get_center_of_mass() });
      shape.set_fill({ opacity: Math.min(fo, (alpha * fo) / this.fade_in_fraction) });
      shape.set_stroke({ opacity: Math.min(so, (alpha * so) / this.fade_in_fraction) });
    });
  }
}

/** Reveals submobjects one at a time, keeping earlier ones. */
export class ShowIncreasingSubsets extends Animation {
  declare all_submobs: Mobject[];
  declare int_func: (x: number) => number;
  constructor(group: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['suspend_mobject_updating', 'int_func', 'reverse_rate_function'], { suspend_mobject_updating: false, int_func: Math.floor, reverse_rate_function: false });
    const { int_func, ...kw } = o;
    const all = [...group.submobjects];
    for (const m of all) (m as any).set_opacity(0);
    super(group, kw);
    this.all_submobs = all;
    this.int_func = int_func;
  }
  override interpolate_mobject(alpha: number): void {
    const n = this.all_submobs.length;
    const value = this.reverse_rate_function ? 1 - this.rate_func(alpha) : this.rate_func(alpha);
    this.update_submobject_list(Math.trunc(this.int_func(value * n)));
  }
  update_submobject_list(index: number): void {
    this.all_submobs.slice(0, index).forEach((m: any) => m.set_opacity(1));
    this.all_submobs.slice(index).forEach((m: any) => m.set_opacity(0));
  }
}

export class AddTextLetterByLetter extends ShowIncreasingSubsets {
  declare time_per_char: number;
  constructor(text: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['suspend_mobject_updating', 'int_func', 'rate_func', 'time_per_char', 'run_time', 'reverse_rate_function', 'introducer'], {
      suspend_mobject_updating: false, int_func: Math.ceil, rate_func: linear, time_per_char: 0.1, run_time: null, reverse_rate_function: false, introducer: true,
    });
    if (!text.family_members_with_points().length) throw new Error(`The text mobject ${text} does not seem to contain any characters.`);
    const { time_per_char, run_time, ...kw } = o;
    super(text, { ...kw, run_time: run_time ?? Math.max(1 / config.frame_rate, time_per_char) * text.length });
    this.time_per_char = time_per_char;
  }
}

export class RemoveTextLetterByLetter extends AddTextLetterByLetter {
  constructor(text: Mobject, kw: Kwargs = {}) {
    super(text, { reverse_rate_function: true, introducer: false, remover: true, ...kw });
  }
}

/** Shows one submobject at a time, hiding the previous one. */
export class ShowSubmobjectsOneByOne extends ShowIncreasingSubsets {
  constructor(group: Iterable<Mobject>, ...rest: unknown[]) {
    const o = pyargs(rest, ['int_func'], { int_func: Math.ceil });
    super(new Group(...group), o);
  }
  override update_submobject_list(index: number): void {
    const cur = this.all_submobs.slice(0, index);
    cur.slice(0, -1).forEach((m: any) => m.set_opacity(0));
    if (cur.length) (cur[cur.length - 1] as any).set_opacity(1);
  }
}

export class AddTextWordByWord extends Succession {
  declare time_per_char: number;
  constructor(text_mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['run_time', 'time_per_char'], { run_time: null, time_per_char: 0.06 });
    const { run_time, time_per_char, ...kw } = o;
    const anims: Animation[] = [];
    for (const word of text_mobject) {
      anims.push(new ShowIncreasingSubsets(word, { run_time: time_per_char * word.length }));
      anims.push(new Animation(word, { run_time: 0.005 * word.length ** 1.5 }));
    }
    super(...anims, kw);
    this.time_per_char = time_per_char;
  }
}

/** Types text with a cursor mobject following the last letter. */
export class TypeWithCursor extends AddTextLetterByLetter {
  declare cursor: Mobject;
  declare buff: number;
  declare keep_cursor_y: boolean;
  declare leave_cursor_on: boolean;
  declare y_cursor: number;
  constructor(text: Mobject, cursor: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['buff', 'keep_cursor_y', 'leave_cursor_on', 'time_per_char', 'reverse_rate_function', 'introducer'], {
      buff: 0.1, keep_cursor_y: true, leave_cursor_on: true, time_per_char: 0.1, reverse_rate_function: false, introducer: true,
    });
    const { buff, keep_cursor_y, leave_cursor_on, ...kw } = o;
    super(text, kw);
    this.cursor = cursor;
    this.buff = buff;
    this.keep_cursor_y = keep_cursor_y;
    this.leave_cursor_on = leave_cursor_on;
  }
  override begin(): void {
    this.y_cursor = this.cursor.get_y();
    this.cursor.initial_position = this.mobject.get_center();
    if (this.keep_cursor_y) this.cursor.set_y(this.y_cursor);
    (this.cursor as any).set_opacity(0);
    this.mobject.add(this.cursor);
    super.begin();
  }
  override finish(): void {
    if (this.leave_cursor_on) (this.cursor as any).set_opacity(1);
    else {
      (this.cursor as any).set_opacity(0);
      this.mobject.remove(this.cursor);
    }
    super.finish();
  }
  override clean_up_from_scene(scene: SceneLike): void {
    if (!this.leave_cursor_on) scene.remove(this.cursor);
    super.clean_up_from_scene(scene);
  }
  override update_submobject_list(index: number): void {
    this.all_submobs.slice(0, index).forEach((m: any) => m.set_opacity(1));
    this.all_submobs.slice(index).forEach((m: any) => m.set_opacity(0));
    if (index !== 0) this.cursor.next_to(this.all_submobs[index - 1], RIGHT, { buff: this.buff }).set_y(this.cursor.initial_position[1]);
    else this.cursor.move_to(this.all_submobs[0]).set_y(this.cursor.initial_position[1]);
    if (this.keep_cursor_y) this.cursor.set_y(this.y_cursor);
    (this.cursor as any).set_opacity(1);
  }
}

export class UntypeWithCursor extends TypeWithCursor {
  constructor(text: Mobject, cursor: Mobject, kw: Kwargs = {}) {
    super(text, cursor, { time_per_char: 0.1, reverse_rate_function: true, introducer: false, remover: true, ...kw });
  }
}
