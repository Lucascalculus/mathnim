// manim/mobject/graphing/probability.py
import { config } from '../../_config';
import { DOWN, LEFT, MED_SMALL_BUFF, RIGHT, SMALL_BUFF, UP } from '../../constants';
import { color_gradient, type ParsableManimColor } from '../../utils/color/core';
import { BLUE_E, DARK_GREY, GREEN_E, LIGHT_GREY, MAROON_B, YELLOW } from '../../utils/color/manim_colors';
import { tuplify } from '../../utils/iterables';
import { pyargs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { neg, type Point3D, type Point3DLike } from '../../utils/vector';
import { Rectangle } from '../geometry/polygram';
import { VGroup, VMobject } from '../types/vectorized_mobject';
import { Axes } from './coordinate_systems';
import { _py_num_str } from './number_line';

const EPSILON = 0.0001;
const toList = (x: any): number[] => (Array.isArray(x) || ArrayBuffer.isView(x) ? Array.from(x as ArrayLike<number>) : tuplify(x));

/** A rectangle that can be divided into parts (probabilities) with braces and labels. */
export class SampleSpace extends Rectangle {
  declare default_label_scale_val: number;
  declare title?: VMobject;
  declare label?: string;
  declare horizontal_parts?: VGroup;
  declare vertical_parts?: VGroup;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['height', 'width', 'fill_color', 'fill_opacity', 'stroke_width', 'stroke_color', 'default_label_scale_val'], {
      height: 3, width: 3, fill_color: DARK_GREY, fill_opacity: 1, stroke_width: 0.5, stroke_color: LIGHT_GREY, default_label_scale_val: 1,
    });
    const { height, width, fill_color, fill_opacity, stroke_width, stroke_color, default_label_scale_val } = o;
    super({ height, width, fill_color, fill_opacity, stroke_width, stroke_color });
    this.default_label_scale_val = default_label_scale_val;
  }
  add_title(title = 'Sample space', buff: number = MED_SMALL_BUFF): this {
    const title_mob: VMobject = new registry.Tex(title);
    if (title_mob.width > this.width) title_mob.width = this.width;
    title_mob.next_to(this, UP, { buff });
    this.title = title_mob;
    this.add(title_mob);
    return this;
  }
  add_label(label: string): this {
    this.label = label;
    return this;
  }
  complete_p_list(p_list: number | ArrayLike<number>): number[] {
    const new_p_list = toList(p_list);
    const remainder = 1.0 - new_p_list.reduce((s, x) => s + x, 0);
    if (Math.abs(remainder) > EPSILON) new_p_list.push(remainder);
    return new_p_list;
  }
  get_division_along_dimension(p_list: number | ArrayLike<number>, dim: number, colors: readonly ParsableManimColor[], vect: Point3DLike): VGroup {
    const p_list_complete = this.complete_p_list(p_list);
    const colors_in_gradient = color_gradient(colors, p_list_complete.length);
    let last_point: Point3D = this.get_edge_center(neg(vect));
    const parts = new VGroup();
    p_list_complete.forEach((factor, i) => {
      const part = new SampleSpace();
      part.set_fill(colors_in_gradient[i], 1);
      part.replace(this, 0, true);
      part.stretch(factor, dim);
      part.move_to(last_point, neg(vect));
      last_point = part.get_edge_center(vect);
      parts.add(part);
    });
    return parts;
  }
  get_horizontal_division(...args: unknown[]): VGroup {
    const o = pyargs(args, ['p_list', 'colors', 'vect'], { colors: [GREEN_E, BLUE_E], vect: DOWN });
    return this.get_division_along_dimension(o.p_list, 1, o.colors, o.vect);
  }
  get_vertical_division(...args: unknown[]): VGroup {
    const o = pyargs(args, ['p_list', 'colors', 'vect'], { colors: [MAROON_B, YELLOW], vect: RIGHT });
    return this.get_division_along_dimension(o.p_list, 0, o.colors, o.vect);
  }
  divide_horizontally(...args: unknown[]): this {
    this.horizontal_parts = this.get_horizontal_division(...args);
    this.add(this.horizontal_parts);
    return this;
  }
  divide_vertically(...args: unknown[]): this {
    this.vertical_parts = this.get_vertical_division(...args);
    this.add(this.vertical_parts);
    return this;
  }
  get_subdivision_braces_and_labels(...args: unknown[]): VGroup {
    const o = pyargs(args, ['parts', 'labels', 'direction', 'buff', 'min_num_quads'], { buff: SMALL_BUFF, min_num_quads: 1 });
    const parts: any = o.parts;
    const { direction, buff, min_num_quads } = o;
    const label_mobs = new VGroup();
    const braces = new VGroup();
    const partList = [...parts];
    const labels = Array.from(o.labels as ArrayLike<string | VMobject>);
    for (let i = 0; i < Math.min(labels.length, partList.length); i++) {
      const label = labels[i], part = partList[i];
      const brace = new registry.Brace(part, direction, { min_num_quads, buff });
      let label_mob: VMobject;
      if (label instanceof VMobject) label_mob = label;
      else {
        label_mob = new registry.MathTex(label);
        label_mob.scale(this.default_label_scale_val);
      }
      label_mob.next_to(brace, direction, buff);
      braces.add(brace);
      label_mobs.add(label_mob);
    }
    parts.braces = braces;
    parts.labels = label_mobs;
    parts.label_kwargs = { labels: label_mobs.copy(), direction, buff };
    return new VGroup(parts.braces, parts.labels);
  }
  get_side_braces_and_labels(labels: (string | VMobject)[], ...args: unknown[]): VGroup {
    const { direction, ...kwargs } = pyargs(args, ['direction'], { direction: LEFT });
    if (!this.horizontal_parts) throw new Error('AssertionError');
    return this.get_subdivision_braces_and_labels(this.horizontal_parts, labels, direction, kwargs);
  }
  get_top_braces_and_labels(labels: (string | VMobject)[], kw: Kwargs = {}): VGroup {
    if (!this.vertical_parts) throw new Error('AssertionError');
    return this.get_subdivision_braces_and_labels(this.vertical_parts, labels, UP, kw);
  }
  get_bottom_braces_and_labels(labels: (string | VMobject)[], kw: Kwargs = {}): VGroup {
    if (!this.vertical_parts) throw new Error('AssertionError');
    return this.get_subdivision_braces_and_labels(this.vertical_parts, labels, DOWN, kw);
  }
  add_braces_and_labels(): this {
    for (const attr of ['horizontal_parts', 'vertical_parts'] as const) {
      const parts: any = this[attr];
      if (!parts) continue;
      for (const subattr of ['braces', 'labels']) if (parts[subattr] !== undefined) this.add(parts[subattr]);
    }
    return this;
  }
  /** `space[i]`: the i-th horizontal (else vertical) part once divided. */
  override get(index: number): any {
    if (this.horizontal_parts) return this.horizontal_parts.get(index);
    if (this.vertical_parts) return this.vertical_parts.get(index);
    return super.get(index);
  }
}

/** A bar chart on Axes (bars coloured by a gradient of `bar_colors`). */
export class BarChart extends Axes {
  declare values: number[];
  declare bar_names: string[] | null;
  declare bar_colors: ParsableManimColor[];
  declare bar_width: number;
  declare bar_fill_opacity: number;
  declare bar_stroke_width: number;
  declare bars: VGroup;
  declare x_labels: VGroup | null;
  declare bar_labels: VGroup | null;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['values', 'bar_names', 'y_range', 'x_length', 'y_length', 'bar_colors', 'bar_width', 'bar_fill_opacity', 'bar_stroke_width'], {
      bar_names: null, y_range: null, x_length: null, y_length: null, bar_colors: ['#003f5c', '#58508d', '#bc5090', '#ff6361', '#ffa600'],
      bar_width: 0.6, bar_fill_opacity: 0.7, bar_stroke_width: 3,
    });
    const { values, bar_names, bar_width, bar_fill_opacity, bar_stroke_width, x_axis_config: xac, tips, ...kwargs } = o;
    delete kwargs.y_range;
    delete kwargs.x_length;
    delete kwargs.y_length;
    delete kwargs.bar_colors;
    let { y_range, x_length, y_length, bar_colors } = o;
    if (typeof bar_colors === 'string') {
      console.warn('Passing a string to `bar_colors` has been deprecated since v0.15.2 and will be removed after v0.17.0, the parameter must be a list.  ');
      bar_colors = [...bar_colors];
    }
    y_length = y_length ?? config.frame_height - 4;
    const vals = Array.from(values as ArrayLike<number>);
    const x_range = [0, vals.length, 1];
    // web: Float64Array marks the step as a Python float (round() returns one), like manim's labels
    const step = Number((Math.max(...vals) / y_length).toFixed(2));
    if (y_range == null) y_range = Float64Array.of(Math.min(0, Math.min(...vals)), Math.max(0, Math.max(...vals)), step);
    else if (y_range.length === 2) y_range = Float64Array.of(y_range[0], y_range[1], step);
    if (x_length == null) x_length = Math.min(vals.length, config.frame_width - 2);
    const x_axis_config: Kwargs = { font_size: 24, label_constructor: registry.Tex };
    Axes._update_default_configs([x_axis_config], [xac]);
    super({ ...kwargs, x_range, y_range, x_length, y_length, x_axis_config, tips: tips ?? false });
    this.values = values;
    this.bar_names = bar_names;
    this.bar_colors = bar_colors;
    this.bar_width = bar_width;
    this.bar_fill_opacity = bar_fill_opacity;
    this.bar_stroke_width = bar_stroke_width;
    this.bars = new VGroup();
    this.x_labels = null;
    this.bar_labels = null;
    this._add_bars();
    if (this.bar_names != null) this._add_x_axis_labels();
    this.y_axis.add_numbers();
  }
  protected _update_colors(): void {
    this.bars.set_color_by_gradient(...this.bar_colors);
  }
  protected _add_x_axis_labels(): void {
    const names = Array.from(this.bar_names!);
    const val_range = Array.from({ length: Math.max(0, Math.ceil(names.length - 0.5)) }, (_, i) => 0.5 + i);
    if (val_range.length !== names.length) throw new Error('ValueError: zip() arguments have different lengths');
    const labels = new VGroup();
    val_range.forEach((value, i) => {
      const direction = this.values[i] < 0 ? UP : DOWN;
      const bar_name_label: VMobject = new this.x_axis.label_constructor(names[i]);
      bar_name_label.font_size = this.x_axis.font_size;
      bar_name_label.next_to(this.x_axis.number_to_point(value), { direction, buff: this.x_axis.line_to_number_buff });
      labels.add(bar_name_label);
    });
    this.x_axis.labels = labels;
    this.x_axis.add(labels);
  }
  protected _create_bar(bar_number: number, value: number): Rectangle {
    const bar_h = Math.abs(this.c2p(0, value)[1] - this.c2p(0, 0)[1]);
    const bar_w = this.c2p(this.bar_width, 0)[0] - this.c2p(0, 0)[0];
    const bar = new Rectangle({ height: bar_h, width: bar_w, stroke_width: this.bar_stroke_width, fill_opacity: this.bar_fill_opacity });
    const pos = value >= 0 ? UP : DOWN;
    bar.next_to(this.c2p(bar_number + 0.5, 0), pos, { buff: 0 });
    return bar;
  }
  protected _add_bars(): void {
    Array.from(this.values).forEach((value, i) => this.bars.add(this._create_bar(i, value)));
    this._update_colors();
    this.add_to_back(this.bars);
  }
  /** Value labels above (or below) each bar. */
  get_bar_labels(...args: unknown[]): VGroup {
    const o = pyargs(args, ['color', 'font_size', 'buff', 'label_constructor'], { color: null, font_size: 24, buff: MED_SMALL_BUFF, label_constructor: null });
    const label_constructor = o.label_constructor ?? registry.Tex;
    const bar_labels = new VGroup();
    const bars = [...this.bars];
    const vals = Array.from(this.values);
    for (let i = 0; i < Math.min(bars.length, vals.length); i++) {
      const bar = bars[i], value = vals[i];
      const bar_lbl: VMobject = new label_constructor(_py_num_str(value));
      if (o.color == null) bar_lbl.set_color(bar.get_fill_color());
      else bar_lbl.set_color(o.color);
      bar_lbl.font_size = o.font_size;
      const pos = value >= 0 ? UP : DOWN;
      bar_lbl.next_to(bar, pos, { buff: o.buff });
      bar_labels.add(bar_lbl);
    }
    return bar_labels;
  }
  /** Stretch the bars to new values (use with `.animate`). */
  change_bar_values(values: ArrayLike<number>, update_colors = true): this {
    const vals = Array.from(values);
    const bars = [...this.bars];
    for (let i = 0; i < Math.min(bars.length, vals.length); i++) {
      const bar = bars[i], value = vals[i];
      const chart_val = this.values[i];
      let bar_lim: Point3D, aligned_edge: Point3D;
      if (chart_val > 0) {
        bar_lim = bar.get_bottom();
        aligned_edge = DOWN;
      } else {
        bar_lim = bar.get_top();
        aligned_edge = UP;
      }
      if (chart_val !== 0) {
        const quotient = value / chart_val;
        if (quotient < 0) aligned_edge = chart_val > 0 ? UP : DOWN;
        bar.stretch_to_fit_height(Math.abs(quotient) * bar.height);
      } else {
        const temp_bar = this._create_bar(i, value);
        this.bars.remove(bar);
        this.bars.insert(i, temp_bar);
      }
      bar.move_to(bar_lim, aligned_edge);
    }
    if (update_colors) this._update_colors();
    this.values.splice(0, vals.length, ...vals);
    return this;
  }
}

register({ SampleSpace, BarChart });
