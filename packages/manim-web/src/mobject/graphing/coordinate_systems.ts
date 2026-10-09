// manim/mobject/graphing/coordinate_systems.py
import { config } from '../../_config';
import {
  DEFAULT_DOT_RADIUS, DEGREES, DL, DOWN, DR, IN, LEFT, MED_SMALL_BUFF, ORIGIN, OUT, PI, RIGHT, SMALL_BUFF, TAU, UP, UR,
} from '../../constants';
import { ManimColor, color_gradient, interpolate_color, invert_color, type ParsableManimColor } from '../../utils/color/core';
import { BLACK, BLUE, BLUE_D, GREEN, PURE_YELLOW, WHITE } from '../../utils/color/manim_colors';
import { toComplex, Complex } from '../../utils/complex';
import { merge_dicts_recursively, update_dict_recursively } from '../../utils/config_ops';
import { isKwargs, KW, pyargs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { binary_search } from '../../utils/simple_functions';
import { angle_of_vector } from '../../utils/space_ops';
import { add, mul, neg, sub, to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { Circle, Dot } from '../geometry/arc';
import { Arrow, DashedLine, Line } from '../geometry/line';
import { Polygon, Rectangle, RegularPolygon } from '../geometry/polygram';
import { Mobject } from '../mobject';
import { VDict, VectorizedPoint, VGroup, VMobject } from '../types/vectorized_mobject';
import { ImplicitFunction, ParametricFunction } from './functions';
import { NumberLine, _np_arange, _py_round } from './number_line';
import { LinearBase } from './scale';

const isArrayLike = (v: unknown): v is ArrayLike<any> => Array.isArray(v) || ArrayBuffer.isView(v);
const linspace = (a: number, b: number, n: number): number[] => {
  const div = n - 1;
  const step = div > 0 ? (b - a) / div : 0;
  const out = Array.from({ length: n }, (_, i) => i * step + a);
  if (n > 1) out[n - 1] = b;
  return out;
};
const transpose = <T>(rows: readonly (ArrayLike<T>)[]): T[][] =>
  rows.length ? Array.from({ length: rows[0].length }, (_, j) => rows.map((r) => r[j])) : [];
/** `*args, **kwargs` where the positional values may themselves be dicts: a trailing object is keywords
 *  when tagged by the transpiler or when none of its keys is numeric. */
function starKw(args: readonly unknown[]): [unknown[], Kwargs] {
  const n = args.length;
  const last = args[n - 1] as any;
  if (n && isKwargs(last) && ((last as any)[KW] || Object.keys(last).every((k) => Number.isNaN(Number(k))))) return [args.slice(0, -1), last];
  return [args.slice(), {}];
}
/** Python's round(x, nd) for small nd (float result). */
const pyRoundTo = (x: number, nd: number): number => Number(x.toFixed(nd));
/** Python format(x, 'g'). */
function fmt_g(x: number): string {
  if (x === 0) return Object.is(x, -0) ? '-0' : '0';
  const [m, e] = x.toExponential(5).split('e');
  const ev = Number(e);
  if (ev < -4 || ev >= 6) return `${m.replace(/\.?0+$/, '')}e${ev < 0 ? '-' : '+'}${String(Math.abs(ev)).padStart(2, '0')}`;
  return String(Number(x.toPrecision(6)));
}
const bigAbs = (x: bigint): bigint => (x < 0n ? -x : x);
const bigGcd = (a: bigint, b: bigint): bigint => {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
/** fractions.Fraction(x).limit_denominator(max_denominator) -> [numerator, denominator]. */
function limit_denominator(x: number, max_denominator: number): [number, number] {
  if (!Number.isFinite(x)) throw new Error(`ValueError: cannot convert ${x} to a Fraction`);
  let num: bigint, den = 1n;
  let v = x;
  while (!Number.isInteger(v)) {
    v *= 2;
    den *= 2n;
  }
  num = BigInt(v);
  const g = bigGcd(num, den) || 1n;
  num /= g;
  den /= g;
  const maxd = BigInt(max_denominator);
  if (den <= maxd) return [Number(num), Number(den)];
  let [p0, q0, p1, q1] = [0n, 1n, 1n, 0n];
  let [n, d] = [num, den];
  const fdiv = (a: bigint, b: bigint): bigint => {
    const q = a / b;
    return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q;
  };
  for (;;) {
    const a = fdiv(n, d);
    const q2 = q0 + a * q1;
    if (q2 > maxd) break;
    [p0, q0, p1, q1] = [p1, q1, p0 + a * p1, q2];
    [n, d] = [d, n - a * d];
  }
  const k = fdiv(maxd - q0, q1);
  if (2n * d * (q0 + k * q1) <= den) return [Number(p1), Number(q1)];
  return [Number(p0 + k * p1), Number(q0 + k * q1)];
}

/** Anything with a coordinate function: a ParametricFunction from `plot` & co. */
type Graph = ParametricFunction | VMobject;

/**
 * Abstract base for Axes & co. web: manim mixes CoordinateSystem into Axes(VGroup, CoordinateSystem);
 * here it is the VGroup subclass Axes derives from.
 */
export class CoordinateSystem extends VGroup {
  declare dimension: number;
  declare x_range: ArrayLike<number>;
  declare y_range: ArrayLike<number>;
  declare x_length: number | null;
  declare y_length: number | null;
  declare num_sampled_graph_points_per_tick: number;
  declare x_axis: NumberLine;
  declare y_axis: NumberLine;
  declare z_axis?: NumberLine;
  declare axes: VGroup;
  declare coordinate_labels: VGroup;
  declare axis_labels: VGroup;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['x_range', 'y_range', 'x_length', 'y_length', 'dimension'], { x_range: null, y_range: null, x_length: null, y_length: null, dimension: 2 });
    const { x_range, y_range, x_length, y_length, dimension, ...kwargs } = o;
    super(kwargs);
    this.dimension = dimension;
    const default_step = 1;
    let xr = x_range, yr = y_range;
    if (xr == null) xr = [_py_round(-config.frame_x_radius), _py_round(config.frame_x_radius), default_step];
    else if (xr.length === 2) xr = [...xr, default_step];
    if (yr == null) yr = [_py_round(-config.frame_y_radius), _py_round(config.frame_y_radius), default_step];
    else if (yr.length === 2) yr = [...yr, default_step];
    this.x_range = xr;
    this.y_range = yr;
    this.x_length = x_length;
    this.y_length = y_length;
    this.num_sampled_graph_points_per_tick = 10;
  }

  coords_to_point(..._coords: any[]): any {
    throw new Error('NotImplementedError');
  }
  point_to_coords(_point: any): any {
    throw new Error('NotImplementedError');
  }
  polar_to_point(radius: number, azimuth: number): Point3D {
    return this.coords_to_point(radius * Math.cos(azimuth), radius * Math.sin(azimuth));
  }
  point_to_polar(point: Point3DLike): [number, number] {
    const [x, y] = this.point_to_coords(point);
    return [Math.sqrt(x ** 2 + y ** 2), Math.atan2(y, x)];
  }
  /** Abbreviation of coords_to_point. */
  c2p(...coords: any[]): any {
    return this.coords_to_point(...coords);
  }
  /** Abbreviation of point_to_coords. */
  p2c(point: any): any {
    return this.point_to_coords(point);
  }
  pr2pt(radius: number, azimuth: number): Point3D {
    return this.polar_to_point(radius, azimuth);
  }
  pt2pr(point: Point3DLike): [number, number] {
    return this.point_to_polar(point);
  }
  get_axes(): VGroup {
    throw new Error('NotImplementedError');
  }
  get_axis(index: number): NumberLine {
    return this.get_axes().get(index);
  }
  get_origin(): Point3D {
    return this.coords_to_point(0, 0);
  }
  get_x_axis(): NumberLine {
    return this.get_axis(0);
  }
  get_y_axis(): NumberLine {
    return this.get_axis(1);
  }
  get_z_axis(): NumberLine {
    return this.get_axis(2);
  }
  get_x_unit_size(): number {
    return this.get_x_axis().get_unit_size();
  }
  get_y_unit_size(): number {
    return this.get_y_axis().get_unit_size();
  }
  /** A label placed at the `edge` of the x-axis. */
  get_x_axis_label(...args: unknown[]): Mobject {
    const o = pyargs(args, ['label', 'edge', 'direction', 'buff'], { edge: UR, direction: UR, buff: SMALL_BUFF });
    return this._get_axis_label(o.label, this.get_x_axis(), o.edge, o.direction, o.buff);
  }
  /** A label placed at the `edge` of the y-axis. */
  get_y_axis_label(...args: unknown[]): Mobject {
    const o = pyargs(args, ['label', 'edge', 'direction', 'buff'], { edge: UR, direction: add(mul(UP, 0.5), RIGHT), buff: SMALL_BUFF });
    return this._get_axis_label(o.label, this.get_y_axis(), o.edge, o.direction, o.buff);
  }
  protected _get_axis_label(label: string | number | VMobject, axis: Mobject, edge: Point3DLike, direction: Point3DLike, buff: number = SMALL_BUFF): Mobject {
    const label_mobject: Mobject = this.x_axis._create_label_tex(label);
    label_mobject.next_to(axis.get_edge_center(edge), { direction, buff });
    label_mobject.shift_onto_screen({ buff: MED_SMALL_BUFF });
    return label_mobject;
  }
  get_axis_labels(..._args: unknown[]): VGroup {
    throw new Error('NotImplementedError');
  }
  /** Number labels on each axis: `add_coordinates()`, `add_coordinates(xs, ys)` or `{value: label}` dicts. */
  add_coordinates(...args: unknown[]): this {
    let [axes_numbers, kwargs] = starKw(args);
    this.coordinate_labels = new VGroup();
    if (!axes_numbers.length) axes_numbers = Array.from({ length: this.dimension }, () => null);
    const axes = this.axes.submobjects as NumberLine[];
    for (let i = 0; i < Math.min(axes.length, axes_numbers.length); i++) {
      const axis = axes[i], values: any = axes_numbers[i];
      let labels: VGroup;
      if (values instanceof Map || (isKwargs(values) && !Array.isArray(values))) {
        axis.add_labels(values, kwargs);
        labels = axis.labels;
      } else if (values == null && axis.scaling.custom_labels) {
        const tick_range = axis.get_tick_range();
        const custom = axis.scaling.get_custom_labels(tick_range);
        axis.add_labels(tick_range.map((x, k) => [x, custom[k]] as const));
        labels = axis.labels;
      } else {
        axis.add_numbers(values, kwargs);
        labels = axis.numbers;
      }
      this.coordinate_labels.add(labels);
    }
    return this;
  }
  /** A (dashed by default) line from the axis `index` to `point`. */
  get_line_from_axis_to_point(...args: unknown[]): Line {
    const o = pyargs(args, ['index', 'point', 'line_func', 'line_config', 'color', 'stroke_width'], { line_func: DashedLine, line_config: null, color: null, stroke_width: 2 });
    const line_config: Kwargs = o.line_config ?? {};
    const color = o.color ?? new VMobject().color;
    line_config.color = ManimColor.parse(color);
    line_config.stroke_width = o.stroke_width;
    const axis: NumberLine = this.get_axis(o.index);
    return new o.line_func(axis.get_projection(o.point), o.point, line_config);
  }
  get_vertical_line(point: Point3DLike, kw: Kwargs = {}): Line {
    return this.get_line_from_axis_to_point(0, point, kw);
  }
  get_horizontal_line(point: Point3DLike, kw: Kwargs = {}): Line {
    return this.get_line_from_axis_to_point(1, point, kw);
  }
  get_lines_to_point(point: Point3DLike, kw: Kwargs = {}): VGroup {
    return new VGroup(this.get_horizontal_line(point, kw), this.get_vertical_line(point, kw));
  }

  // ---------------------------------------------------------------- graphing
  /**
   * The graph of `function` in these coordinates. Samples every x_range step (default: the axis
   * step / 10); `use_vectorized` calls `function` once with all inputs.
   */
  plot(...args: unknown[]): ParametricFunction {
    const o = pyargs(args, ['function', 'x_range', 'use_vectorized', 'colorscale', 'colorscale_axis'], { x_range: null, use_vectorized: false, colorscale: null, colorscale_axis: 1 });
    const { function: fn, x_range, use_vectorized, colorscale, colorscale_axis, ...kwargs } = o;
    const t_range = Array.from(this.x_range, Number);
    if (x_range != null) Array.from(x_range as ArrayLike<number>).forEach((v, i) => (t_range[i] = v));
    if (x_range == null || x_range.length < 3) t_range[2] /= this.num_sampled_graph_points_per_tick;
    const graph = new ParametricFunction((t: any) => this.coords_to_point(t, fn(t)), { ...kwargs, t_range, scaling: this.x_axis.scaling, use_vectorized });
    graph.underlying_function = fn;
    if (colorscale && colorscale.length) {
      let new_colors: ParsableManimColor[], pivots: number[];
      const c0 = colorscale[0];
      if (Array.isArray(c0) && c0.length === 2 && typeof c0[1] === 'number' && typeof c0[0] !== 'number') {
        new_colors = colorscale.map((c: any) => c[0]);
        pivots = colorscale.map((c: any) => c[1]);
      } else {
        new_colors = colorscale;
        const ranges = [this.x_range, this.y_range];
        const pivot_min = ranges[colorscale_axis][0], pivot_max = ranges[colorscale_axis][1];
        const pivot_frequency = (pivot_max - pivot_min) / (new_colors.length - 1);
        pivots = _np_arange(pivot_min, pivot_max + pivot_frequency, pivot_frequency);
      }
      // manim reads `x_range` (the argument) here, so colorscale needs an explicit x_range
      const resolution = x_range.length === 2 ? 0.01 : x_range[2];
      const sample_points = _np_arange(x_range[0], x_range[1] + resolution, resolution);
      const color_list: ParsableManimColor[] = [];
      for (const samp_x of sample_points) {
        const axis_value = colorscale_axis === 0 ? samp_x : fn(samp_x);
        if (axis_value <= pivots[0]) color_list.push(new_colors[0]);
        else if (axis_value >= pivots[pivots.length - 1]) color_list.push(new_colors[new_colors.length - 1]);
        else {
          for (let i = 0; i < pivots.length; i++) {
            if (pivots[i] > axis_value) {
              const color_index = Math.min((axis_value - pivots[i - 1]) / (pivots[i] - pivots[i - 1]), 1);
              color_list.push(interpolate_color(new_colors[i - 1], new_colors[i], color_index));
              break;
            }
          }
        }
      }
      graph.set_stroke(color_list);
      graph.set_sheen_direction(RIGHT);
    }
    return graph;
  }
  /** The curve func(x, y) = 0 over the axes' ranges (see ImplicitFunction). */
  plot_implicit_curve(...args: unknown[]): ImplicitFunction {
    const o = pyargs(args, ['func', 'min_depth', 'max_quads'], { min_depth: 5, max_quads: 1500 });
    const { func, min_depth, max_quads, ...kwargs } = o;
    const x_scale = this.get_x_axis().scaling, y_scale = this.get_y_axis().scaling;
    const graph = new ImplicitFunction({
      ...kwargs, func: (x: number, y: number) => func(x_scale.function(x), y_scale.function(y)),
      x_range: Array.from(this.x_range).slice(0, 2), y_range: Array.from(this.y_range).slice(0, 2), min_depth, max_quads,
    });
    graph.stretch(this.get_x_unit_size(), 0, { about_point: ORIGIN }).stretch(this.get_y_unit_size(), 1, { about_point: ORIGIN }).shift(this.get_origin());
    return graph;
  }
  /** A parametric curve t -> function(t) given in these coordinates. */
  plot_parametric_curve(...args: unknown[]): ParametricFunction {
    const o = pyargs(args, ['function', 'use_vectorized'], { use_vectorized: false });
    const { function: fn, use_vectorized, ...kwargs } = o;
    const dim = this.dimension;
    const graph = new ParametricFunction((t: any) => this.coords_to_point(...Array.from(fn(t) as ArrayLike<any>).slice(0, dim)), { ...kwargs, use_vectorized });
    graph.underlying_function = fn;
    return graph;
  }
  /** The polar graph r = r_func(theta) (theta_range default [0, 2 PI]). */
  plot_polar_graph(...args: unknown[]): ParametricFunction {
    const o = pyargs(args, ['r_func', 'theta_range'], { theta_range: null });
    const { r_func, theta_range, ...kwargs } = o;
    const graph = new ParametricFunction({ ...kwargs, function: (th: number) => this.pr2pt(r_func(th), th), t_range: theta_range ?? [0, 2 * PI] });
    graph.underlying_function = r_func;
    return graph;
  }
  /** A Surface z = function(u, v) (needs the 3D module's Surface). */
  plot_surface(...args: unknown[]): VMobject {
    const o = pyargs(args, ['function', 'u_range', 'v_range', 'colorscale', 'colorscale_axis'], { u_range: null, v_range: null, colorscale: null, colorscale_axis: 2 });
    const { function: fn, u_range, v_range, colorscale, colorscale_axis, ...kwargs } = o;
    const surface = new registry.Surface((u: number, v: number) => this.c2p(u, v, fn(u, v)), { ...kwargs, u_range, v_range });
    if (colorscale && colorscale.length) surface.set_fill_by_value({ axes: this.copy(), colorscale, axis: colorscale_axis });
    return surface;
  }
  /** The point of `graph` above the input x. */
  input_to_graph_point(x: number, graph: Graph): Point3D {
    if ((graph as any).underlying_function !== undefined) return (graph as ParametricFunction).function(x);
    const alpha = binary_search((a) => this.point_to_coords(graph.point_from_proportion(a))[0], x, 0, 1);
    if (alpha !== null) return graph.point_from_proportion(alpha);
    throw new Error(`ValueError: x=${x} not located in the range of the graph ([${this.p2c(graph.get_start())[0]}, ${this.p2c(graph.get_end())[0]}])`);
  }
  input_to_graph_coords(x: number, graph: ParametricFunction): [number, number] {
    return [x, graph.underlying_function!(x)];
  }
  i2gc(x: number, graph: ParametricFunction): [number, number] {
    return this.input_to_graph_coords(x, graph);
  }
  i2gp(x: number, graph: Graph): Point3D {
    return this.input_to_graph_point(x, graph);
  }
  /** A label for `graph` (default: near the right end of the visible part), optionally with a dot. */
  get_graph_label(...args: unknown[]): Mobject {
    const o = pyargs(args, ['graph', 'label', 'x_val', 'direction', 'buff', 'color', 'dot', 'dot_config'], {
      label: 'f(x)', x_val: null, direction: RIGHT, buff: MED_SMALL_BUFF, color: null, dot: false, dot_config: null,
    });
    const { graph, label, x_val, direction, buff } = o;
    const dot_config: Kwargs = o.dot_config ?? {};
    const color = o.color ?? graph.get_color();
    const label_object: Mobject = this.x_axis._create_label_tex(label).set_color(color);
    let point: Point3D;
    if (x_val == null) {
      point = [0, 0, 0];
      for (const x of linspace(this.x_range[1], this.x_range[0], 100)) {
        point = this.input_to_graph_point(x, graph);
        if (point[1] < config.frame_y_radius) break;
      }
    } else point = this.input_to_graph_point(x_val, graph);
    label_object.next_to(point, direction, { buff });
    label_object.shift_onto_screen();
    if (o.dot) {
      const dot = new Dot({ ...dot_config, point });
      label_object.add(dot);
      label_object.dot = dot;
    }
    return label_object;
  }
  /** Riemann rectangles under `graph` (or between it and `bounded_graph`). */
  get_riemann_rectangles(...args: unknown[]): VGroup {
    const o = pyargs(args, ['graph', 'x_range', 'dx', 'input_sample_type', 'stroke_width', 'stroke_color', 'fill_opacity', 'color', 'show_signed_area', 'bounded_graph', 'blend', 'width_scale_factor'], {
      x_range: null, dx: 0.1, input_sample_type: 'left', stroke_width: 1, stroke_color: BLACK, fill_opacity: 1, color: [BLUE, GREEN],
      show_signed_area: true, bounded_graph: null, blend: false, width_scale_factor: 1.001,
    });
    const { graph, dx, input_sample_type, stroke_width, fill_opacity, show_signed_area, bounded_graph, blend, width_scale_factor } = o;
    let { x_range, stroke_color } = o;
    if (x_range == null) {
      if (bounded_graph == null) x_range = [graph.t_min, graph.t_max];
      else x_range = [Math.max(graph.t_min, bounded_graph.t_min), Math.min(graph.t_max, bounded_graph.t_max)];
    }
    const rectangles = new VGroup();
    const x_range_array = _np_arange(x_range[0], x_range[1], dx);
    const cs: ManimColor[] = Array.isArray(o.color) && typeof o.color[0] !== 'number' ? o.color.map((c: ParsableManimColor) => new ManimColor(c)) : [new ManimColor(o.color)];
    const colors = color_gradient(cs, x_range_array.length);
    const origin_shift = (this.constructor as typeof CoordinateSystem)._origin_shift;
    x_range_array.forEach((x, i) => {
      let color: ManimColor = colors[i];
      let sample_input: number;
      if (input_sample_type === 'left') sample_input = x;
      else if (input_sample_type === 'right') sample_input = x + dx;
      else if (input_sample_type === 'center') sample_input = x + 0.5 * dx;
      else throw new Error('ValueError: Invalid input sample type');
      const graph_point = this.input_to_graph_point(sample_input, graph);
      const y_point: number = bounded_graph == null ? origin_shift(this.y_range) : bounded_graph.underlying_function(x);
      const points = new VGroup(...[this.coords_to_point(x, y_point), this.coords_to_point(x + width_scale_factor * dx, y_point), graph_point].map((p) => new VectorizedPoint(p)));
      const rect = new Rectangle().replace(points, 0, true);
      rectangles.add(rect);
      if (this.p2c(graph_point)[1] < y_point && show_signed_area) color = invert_color(color);
      if (blend) stroke_color = color;
      rect.set_style({ fill_color: color, fill_opacity, stroke_color, stroke_width });
    });
    return rectangles;
  }
  /** The area under `graph` over x_range (or between `graph` and `bounded_graph`) as a Polygon. */
  get_area(...args: unknown[]): Polygon {
    const o = pyargs(args, ['graph', 'x_range', 'color', 'opacity', 'bounded_graph'], { x_range: null, color: [BLUE, GREEN], opacity: 0.3, bounded_graph: null });
    const { graph, x_range, color, opacity, bounded_graph, ...kwargs } = o;
    let a: number, b: number;
    if (x_range == null) {
      a = graph.t_min;
      b = graph.t_max;
    } else [a, b] = x_range;
    if (bounded_graph != null) {
      if (bounded_graph.t_min > b) throw new Error(`ValueError: Ranges not matching: ${bounded_graph.t_min} < ${b}`);
      if (bounded_graph.t_max < a) throw new Error(`ValueError: Ranges not matching: ${bounded_graph.t_max} > ${a}`);
      a = Math.max(a, bounded_graph.t_min);
      b = Math.min(b, bounded_graph.t_max);
    }
    const inside = (g: ParametricFunction): Point3D[] => {
      const out: Point3D[] = [];
      const p = g.points;
      for (let i = 0; i < p.length; i += 3) {
        const q: Point3D = [p[i], p[i + 1], p[i + 2]];
        const x = this.p2c(q)[0];
        if (a <= x && x <= b) out.push(q);
      }
      return out;
    };
    let points: Point3DLike[];
    if (bounded_graph == null) points = [this.c2p(a), graph.function(a), ...inside(graph), graph.function(b), this.c2p(b)];
    else {
      const [gp, bp] = [graph, bounded_graph].map((g: ParametricFunction) => [g.function(a), ...inside(g), g.function(b)]);
      points = [...gp, ...bp.reverse()];
    }
    return new Polygon(...points, kwargs).set_opacity(opacity).set_color(color);
  }
  angle_of_tangent(x: number, graph: ParametricFunction, dx = 1e-8): number {
    const p0 = this.input_to_graph_coords(x, graph);
    const p1 = this.input_to_graph_coords(x + dx, graph);
    return angle_of_vector([p1[0] - p0[0], p1[1] - p0[1], 0]);
  }
  slope_of_tangent(x: number, graph: ParametricFunction, kw: Kwargs = {}): number {
    return Math.tan(this.angle_of_tangent(x, graph, kw.dx ?? 1e-8));
  }
  /** The graph of the (numerical) derivative of `graph`. */
  plot_derivative_graph(...args: unknown[]): ParametricFunction {
    const o = pyargs(args, ['graph', 'color'], { color: GREEN });
    const { graph, color, ...kwargs } = o;
    return this.plot((x: number) => this.slope_of_tangent(x, graph), { ...kwargs, color });
  }
  /** The graph of an antiderivative of `graph` (trapezoid rule with `samples` points from 0). */
  plot_antiderivative_graph(...args: unknown[]): ParametricFunction {
    const o = pyargs(args, ['graph', 'y_intercept', 'samples', 'use_vectorized'], { y_intercept: 0, samples: 50, use_vectorized: false });
    const { graph, y_intercept, samples, use_vectorized, ...kwargs } = o;
    const f = graph.underlying_function;
    const one = (x: number): number => {
      const xs = linspace(0, x, samples);
      const ys = xs.map((v) => f(v));
      let s = 0;
      for (let i = 1; i < xs.length; i++) s += ((xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1])) / 2.0;
      return s + y_intercept;
    };
    const antideriv = (x: any): any => (isArrayLike(x) ? Array.from(x as ArrayLike<number>, one) : one(x));
    return this.plot(antideriv, { ...kwargs, use_vectorized });
  }
  /** dx / dy lines (and optional labels and secant line) at x on `graph`. */
  get_secant_slope_group(...args: unknown[]): VGroup {
    const o = pyargs(args, ['x', 'graph', 'dx', 'dx_line_color', 'dy_line_color', 'dx_label', 'dy_label', 'include_secant_line', 'secant_line_color', 'secant_line_length'], {
      dx: null, dx_line_color: PURE_YELLOW, dy_line_color: null, dx_label: null, dy_label: null, include_secant_line: true, secant_line_color: GREEN, secant_line_length: 10,
    });
    const { x, graph, dx_line_color, dx_label, dy_label, include_secant_line, secant_line_color, secant_line_length } = o;
    const group: any = new VGroup();
    const dx: number = o.dx || (this.x_range[1] - this.x_range[0]) / 10;
    const dy_line_color = o.dy_line_color || graph.get_color();
    const p1 = this.input_to_graph_point(x, graph);
    const p2 = this.input_to_graph_point(x + dx, graph);
    const interim_point = add(mul(p2[0], RIGHT), mul(p1[1], UP));
    group.dx_line = new Line(p1, interim_point, { color: dx_line_color });
    group.df_line = new Line(interim_point, p2, { color: dy_line_color });
    group.add(group.dx_line, group.df_line);
    const labels = new VGroup();
    if (dx_label != null) {
      group.dx_label = this.x_axis._create_label_tex(dx_label);
      labels.add(group.dx_label);
      group.add(group.dx_label);
    }
    if (dy_label != null) {
      group.df_label = this.x_axis._create_label_tex(dy_label);
      labels.add(group.df_label);
      group.add(group.df_label);
    }
    if (labels.length > 0) {
      const max_width = 0.8 * group.dx_line.width;
      const max_height = 0.8 * group.df_line.height;
      if (labels.width > max_width) labels.width = max_width;
      if (labels.height > max_height) labels.height = max_height;
    }
    if (dx_label != null) {
      group.dx_label.next_to(group.dx_line, mul(Math.sign(dx), DOWN), { buff: group.dx_label.height / 2 });
      group.dx_label.set_color(group.dx_line.get_color());
    }
    if (dy_label != null) {
      group.df_label.next_to(group.df_line, mul(Math.sign(dx), RIGHT), { buff: group.df_label.height / 2 });
      group.df_label.set_color(group.df_line.get_color());
    }
    if (include_secant_line) {
      group.secant_line = new Line(p1, p2, { color: secant_line_color });
      group.secant_line.scale(secant_line_length / group.secant_line.get_length());
      group.add(group.secant_line);
    }
    return group;
  }
  /** `num_lines` vertical lines from the x-axis to `graph`. */
  get_vertical_lines_to_graph(...args: unknown[]): VGroup {
    const o = pyargs(args, ['graph', 'x_range', 'num_lines'], { x_range: null, num_lines: 20 });
    const { graph, num_lines, ...kwargs } = o;
    delete kwargs.x_range;
    const x_range = o.x_range ?? this.x_range;
    return new VGroup(linspace(x_range[0], x_range[1], num_lines).map((x) => this.get_vertical_line(this.i2gp(x, graph), kwargs)));
  }
  /** A triangle marker on the x-axis at x_val with a label and a line up to `graph`. */
  get_T_label(...args: unknown[]): VGroup {
    const o = pyargs(args, ['x_val', 'graph', 'label', 'label_color', 'triangle_size', 'triangle_color', 'line_func', 'line_color'], {
      label: null, label_color: null, triangle_size: MED_SMALL_BUFF, triangle_color: WHITE, line_func: Line, line_color: PURE_YELLOW,
    });
    const T_label_group = new VGroup();
    const triangle = new RegularPolygon({ n: 3, start_angle: Math.PI / 2, stroke_width: 0 }).set_fill({ color: o.triangle_color, opacity: 1 });
    triangle.height = o.triangle_size;
    triangle.move_to(this.coords_to_point(o.x_val, 0), UP);
    if (o.label != null) {
      const t_label = this.x_axis._create_label_tex(o.label, { color: o.label_color });
      t_label.next_to(triangle, DOWN);
      T_label_group.add(t_label);
    }
    const v_line = this.get_vertical_line(this.i2gp(o.x_val, o.graph), { color: o.line_color, line_func: o.line_func });
    T_label_group.add(triangle, v_line);
    return T_label_group;
  }
  /** `axes @ (x, y)` */
  __matmul__(coord: Point3DLike | Mobject): Point3D {
    const c = coord instanceof Mobject ? coord.get_center() : coord;
    return this.coords_to_point(...Array.from(c));
  }
  /** `point @ axes` */
  __rmatmul__(point: Point3DLike): number[] {
    return this.point_to_coords(point);
  }
  /** manim's CoordinateSystem._origin_shift has an empty body (Axes defines it). */
  static _origin_shift(_axis_range: ArrayLike<number>): any {
    return undefined;
  }
}

/** Two (or three) NumberLines forming a coordinate system. */
export class Axes extends CoordinateSystem {
  declare axis_config: Kwargs;
  declare x_axis_config: Kwargs;
  declare y_axis_config: Kwargs;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['x_range', 'y_range', 'x_length', 'y_length', 'axis_config', 'x_axis_config', 'y_axis_config', 'tips'], {
      x_range: null, y_range: null, x_length: _py_round(config.frame_width) - 2, y_length: _py_round(config.frame_height) - 2,
      axis_config: null, x_axis_config: null, y_axis_config: null, tips: true,
    });
    const { axis_config, x_axis_config, y_axis_config, tips, ...kwargs } = o;
    super(kwargs);
    this.axis_config = { include_tip: tips, numbers_to_exclude: [0] };
    this.x_axis_config = {};
    this.y_axis_config = { rotation: 90 * DEGREES, label_direction: LEFT };
    Axes._update_default_configs([this.axis_config, this.x_axis_config, this.y_axis_config], [axis_config, x_axis_config, y_axis_config]);
    this.x_axis_config = merge_dicts_recursively(this.axis_config, this.x_axis_config);
    this.y_axis_config = merge_dicts_recursively(this.axis_config, this.y_axis_config);
    for (const c of [this.x_axis_config, this.y_axis_config]) c.exclude_origin_tick = c.scaling == null || c.scaling instanceof LinearBase;
    this.x_axis = this._create_axis(this.x_range, this.x_axis_config, this.x_length);
    this.y_axis = this._create_axis(this.y_range, this.y_axis_config, this.y_length);
    this.axes = new VGroup(this.x_axis, this.y_axis);
    this.add(...this.axes.submobjects);
    const lines_center_point = (this.axes.submobjects as NumberLine[]).map((axis) => axis.scaling.function((axis.x_range[1] + axis.x_range[0]) / 2));
    this.shift(neg(this.coords_to_point(...lines_center_point)));
  }
  static _update_default_configs(default_configs: Kwargs[], passed_configs: (Kwargs | null | undefined)[]): void {
    for (let i = 0; i < Math.min(default_configs.length, passed_configs.length); i++) {
      if (passed_configs[i] != null) update_dict_recursively(default_configs[i], passed_configs[i]);
    }
  }
  protected _create_axis(range_terms: ArrayLike<number>, axis_config: Kwargs, length: number | null): NumberLine {
    axis_config.length = length;
    const axis = new NumberLine(range_terms, axis_config);
    axis.shift(neg(axis.number_to_point(Axes._origin_shift([axis.x_min, axis.x_max]))));
    return axis;
  }
  /**
   * Coordinates to a point: `c2p(x, y)`, `c2p([x, y])` -> point; `c2p(xs, ys)` -> [xs', ys', zs']
   * (manim returns the transposed array here); `c2p([[x, y], ...])` -> list of points.
   */
  override coords_to_point(...coords: any[]): any {
    let c: any[] = coords;
    let transposed = false;
    if (c.length === 1 && isArrayLike(c[0])) {
      const inner = Array.from(c[0] as ArrayLike<any>);
      if (inner.length && isArrayLike(inner[0])) {
        if (inner.length === 1) c = Array.from(inner[0] as ArrayLike<any>);
        else {
          c = transpose(inner as ArrayLike<any>[]);
          transposed = true;
        }
      } else c = inner;
    }
    const x_axis = this.x_axis;
    const origin = x_axis.number_to_point(Axes._origin_shift([x_axis.x_min, x_axis.x_max]));
    const others = this.axes.submobjects.slice(1) as NumberLine[];
    const n = Math.min(others.length, c.length - 1);
    const vector = c.findIndex((v) => isArrayLike(v));
    if (vector < 0) {
      let p = x_axis.number_to_point(c[0] as number);
      for (let i = 0; i < n; i++) p = add(p, sub(others[i].number_to_point(c[i + 1] as number), origin));
      return p;
    }
    const len = (c[vector] as ArrayLike<number>).length;
    const col = (v: any): number[] => (isArrayLike(v) ? Array.from(v as ArrayLike<number>) : Array(len).fill(v));
    let pts = x_axis.number_to_point(col(c[0]));
    for (let i = 0; i < n; i++) {
      const q = others[i].number_to_point(col(c[i + 1]));
      pts = pts.map((p, k) => add(p, sub(q[k], origin)));
    }
    if (transposed) return pts;
    return [pts.map((p) => p[0]), pts.map((p) => p[1]), pts.map((p) => p[2])];
  }
  /** A point to its coordinates (a list of points to a list of coordinates). */
  override point_to_coords(point: any): any {
    const result = (this.get_axes().submobjects as NumberLine[]).map((axis) => axis.point_to_number(point));
    if (isArrayLike(point[0])) return transpose(result as unknown as number[][]);
    return result;
  }
  override get_axes(): VGroup {
    return this.axes;
  }
  /** Labels for both axes (strings become MathTex). */
  override get_axis_labels(...args: unknown[]): VGroup {
    const o = pyargs(args, ['x_label', 'y_label'], { x_label: 'x', y_label: 'y' });
    this.axis_labels = new VGroup(this.get_x_axis_label(o.x_label), this.get_y_axis_label(o.y_label));
    return this.axis_labels;
  }
  /** A polyline through the given values (VDict with 'line_graph' and 'vertex_dots'). */
  plot_line_graph(...args: unknown[]): VDict {
    const o = pyargs(args, ['x_values', 'y_values', 'z_values', 'line_color', 'add_vertex_dots', 'vertex_dot_radius', 'vertex_dot_style'], {
      z_values: null, line_color: PURE_YELLOW, add_vertex_dots: true, vertex_dot_radius: DEFAULT_DOT_RADIUS, vertex_dot_style: null,
    });
    const { x_values, y_values, line_color, add_vertex_dots, vertex_dot_radius, ...kwargs } = o;
    delete kwargs.z_values;
    delete kwargs.vertex_dot_style;
    const xs = Array.from(x_values as ArrayLike<number>), ys = Array.from(y_values as ArrayLike<number>);
    const zs = o.z_values != null ? Array.from(o.z_values as ArrayLike<number>) : xs.map(() => 0);
    if (xs.length !== ys.length || xs.length !== zs.length) throw new Error('ValueError: zip() arguments have different lengths');
    const line_graph = new VDict();
    const graph = new VGroup({ ...kwargs, color: line_color });
    const vertices: Point3D[] = xs.map((x, i) => this.coords_to_point(x, ys[i], zs[i]));
    graph.set_points_as_corners(vertices);
    line_graph.set_item('line_graph', graph);
    if (add_vertex_dots) {
      const style: Kwargs = o.vertex_dot_style || {};
      line_graph.set_item('vertex_dots', new VGroup(vertices.map((vertex) => new Dot({ ...style, point: vertex, radius: vertex_dot_radius }))));
    }
    return line_graph;
  }
  static override _origin_shift(axis_range: ArrayLike<number>): number {
    if (axis_range[0] > 0) return axis_range[0];
    if (axis_range[1] < 0) return axis_range[1];
    return 0;
  }
}

/** Axes with a z-axis (drawn in pieces with 3D shading). */
export class ThreeDAxes extends Axes {
  declare z_range: ArrayLike<number>;
  declare z_length: number | null;
  declare z_axis_config: Kwargs;
  declare z_normal: Point3D;
  declare num_axis_pieces: number;
  declare light_source: Point3D;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['x_range', 'y_range', 'z_range', 'x_length', 'y_length', 'z_length', 'z_axis_config', 'z_normal', 'num_axis_pieces', 'light_source', 'depth', 'gloss'], {
      x_range: [-6, 6, 1], y_range: [-5, 5, 1], z_range: [-4, 4, 1], x_length: config.frame_height + 2.5, y_length: config.frame_height + 2.5,
      z_length: config.frame_height - 1.5, z_axis_config: null, z_normal: DOWN, num_axis_pieces: 20, light_source: add(mul(9, DOWN), mul(7, LEFT), mul(10, OUT)),
      depth: null, gloss: 0.5,
    });
    const { x_range, y_range, z_range, x_length, y_length, z_length, z_axis_config, z_normal, num_axis_pieces, light_source, depth: _d, gloss: _g, ...kwargs } = o;
    super({ ...kwargs, x_range, x_length, y_range, y_length });
    this.z_range = z_range;
    this.z_length = z_length;
    this.z_axis_config = {};
    Axes._update_default_configs([this.z_axis_config], [z_axis_config]);
    this.z_axis_config = merge_dicts_recursively(this.axis_config, this.z_axis_config);
    this.z_normal = to3(z_normal);
    this.num_axis_pieces = num_axis_pieces;
    this.light_source = to3(light_source);
    this.dimension = 3;
    this.z_axis_config.exclude_origin_tick = this.z_axis_config.scaling == null || this.z_axis_config.scaling instanceof LinearBase;
    const z_axis = this._create_axis(this.z_range, this.z_axis_config, this.z_length);
    const z_origin = Axes._origin_shift([z_axis.x_min, z_axis.x_max]);
    z_axis.rotate_about_number(z_origin, -PI / 2, UP);
    z_axis.rotate_about_number(z_origin, angle_of_vector(this.z_normal));
    z_axis.shift(neg(z_axis.number_to_point(z_origin)));
    z_axis.shift(this.x_axis.number_to_point(Axes._origin_shift([this.x_axis.x_min, this.x_axis.x_max])));
    this.axes.add(z_axis);
    this.add(z_axis);
    this.z_axis = z_axis;
    // manim does this for the Cairo renderer (the one manim-web mirrors)
    this._add_3d_pieces();
    this._set_axis_shading();
  }
  protected _add_3d_pieces(): void {
    for (const axis of this.axes.submobjects as NumberLine[]) {
      (axis as any).pieces = new VGroup(...axis.get_pieces(this.num_axis_pieces).submobjects);
      axis.add((axis as any).pieces);
      axis.set_stroke({ width: 0, family: false });
      axis.set_shade_in_3d(true);
    }
  }
  protected _set_axis_shading(): void {
    const make_func = (axis: Mobject) => {
      const vect = this.light_source;
      return (): [Point3D, Point3D] => [axis.get_edge_center(neg(vect)), axis.get_edge_center(vect)];
    };
    for (const axis of this) {
      for (const submob of axis.family_members_with_points() as VMobject[]) {
        (submob as any).get_gradient_start_and_end_points = make_func(axis);
        (submob as any).get_unit_normal = (_a?: unknown): Point3D => [1, 1, 1];
        submob.set_sheen(0.2);
      }
    }
  }
  /** The y-axis label, rotated by `rotation` about `rotation_axis`. */
  override get_y_axis_label(...args: unknown[]): Mobject {
    const o = pyargs(args, ['label', 'edge', 'direction', 'buff', 'rotation', 'rotation_axis'], { edge: UR, direction: UR, buff: SMALL_BUFF, rotation: PI / 2, rotation_axis: OUT });
    const positioned_label = this._get_axis_label(o.label, this.get_y_axis(), o.edge, o.direction, o.buff);
    positioned_label.rotate(o.rotation, { axis: o.rotation_axis });
    return positioned_label;
  }
  /** The z-axis label, rotated by `rotation` about `rotation_axis`. */
  get_z_axis_label(...args: unknown[]): Mobject {
    const o = pyargs(args, ['label', 'edge', 'direction', 'buff', 'rotation', 'rotation_axis'], { edge: OUT, direction: RIGHT, buff: SMALL_BUFF, rotation: PI / 2, rotation_axis: RIGHT });
    const positioned_label = this._get_axis_label(o.label, this.get_z_axis(), o.edge, o.direction, o.buff);
    positioned_label.rotate(o.rotation, { axis: o.rotation_axis });
    return positioned_label;
  }
  override get_axis_labels(...args: unknown[]): VGroup {
    const o = pyargs(args, ['x_label', 'y_label', 'z_label'], { x_label: 'x', y_label: 'y', z_label: 'z' });
    this.axis_labels = new VGroup(this.get_x_axis_label(o.x_label), this.get_y_axis_label(o.y_label), this.get_z_axis_label(o.z_label));
    return this.axis_labels;
  }
}

function faded(style: Kwargs): Kwargs {
  const out: Kwargs = { ...style };
  for (const key of Object.keys(out)) if (typeof out[key] === 'number') out[key] *= 0.5;
  return out;
}

/** Axes with a grid of background lines (and faded lines in between). */
export class NumberPlane extends Axes {
  declare background_line_style: Kwargs;
  declare faded_line_style: Kwargs | null;
  declare faded_line_ratio: number;
  declare background_lines: VGroup;
  declare faded_lines: VGroup;
  declare x_lines: VGroup;
  declare y_lines: VGroup;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['x_range', 'y_range', 'x_length', 'y_length', 'background_line_style', 'faded_line_style', 'faded_line_ratio', 'make_smooth_after_applying_functions'], {
      x_range: [-config.frame_x_radius, config.frame_x_radius, 1], y_range: [-config.frame_y_radius, config.frame_y_radius, 1],
      x_length: null, y_length: null, background_line_style: null, faded_line_style: null, faded_line_ratio: 1, make_smooth_after_applying_functions: true,
    });
    const { x_range, y_range, x_length, y_length, background_line_style, faded_line_style, faded_line_ratio, make_smooth_after_applying_functions: _m, axis_config: ac, y_axis_config: yac, ...kwargs } = o;
    const axis_config: Kwargs = { stroke_width: 2, include_ticks: false, include_tip: false, line_to_number_buff: SMALL_BUFF, label_direction: DR, font_size: 24 };
    const y_axis_config: Kwargs = { label_direction: DR };
    const bls: Kwargs = { stroke_color: BLUE_D, stroke_width: 2, stroke_opacity: 1 };
    Axes._update_default_configs([axis_config, y_axis_config, bls], [ac, yac, background_line_style]);
    // manim's `self.make_smooth_after_applying_functions = ...` is overwritten by VMobject.__init__ (False)
    super({ ...kwargs, x_range, y_range, x_length, y_length, axis_config, y_axis_config });
    this.background_line_style = bls;
    this.faded_line_style = faded_line_style;
    this.faded_line_ratio = faded_line_ratio;
    this._init_background_lines();
  }
  protected _init_background_lines(): void {
    if (this.faded_line_style == null) this.faded_line_style = faded(this.background_line_style);
    [this.background_lines, this.faded_lines] = this._get_lines();
    this.background_lines.set_style(this.background_line_style);
    this.faded_lines.set_style(this.faded_line_style);
    this.add_to_back(this.faded_lines, this.background_lines);
  }
  protected _get_lines(): [VGroup, VGroup] {
    const x_axis = this.get_x_axis(), y_axis = this.get_y_axis();
    const [x_lines1, x_lines2] = this._get_lines_parallel_to_axis(x_axis, y_axis, this.y_axis.x_range[2], this.faded_line_ratio);
    const [y_lines1, y_lines2] = this._get_lines_parallel_to_axis(y_axis, x_axis, this.x_axis.x_range[2], this.faded_line_ratio);
    this.x_lines = x_lines1;
    this.y_lines = y_lines1;
    return [new VGroup(...x_lines1.submobjects, ...y_lines1.submobjects), new VGroup(...x_lines2.submobjects, ...y_lines2.submobjects)];
  }
  protected _get_lines_parallel_to_axis(axis_parallel_to: NumberLine, axis_perpendicular_to: NumberLine, freq: number, ratio_faded_lines: number): [VGroup, VGroup] {
    const line = new Line(axis_parallel_to.get_start(), axis_parallel_to.get_end());
    if (ratio_faded_lines === 0) ratio_faded_lines = 1;
    const step = (1 / ratio_faded_lines) * freq;
    const lines1 = new VGroup(), lines2 = new VGroup();
    const unit_vector_axis_perp_to = axis_perpendicular_to.get_unit_vector();
    let [x_min, x_max] = axis_perpendicular_to.x_range;
    if (axis_perpendicular_to.x_min > 0 && x_min < 0) [x_min, x_max] = [0, Math.abs(x_min) + Math.abs(x_max)];
    const ranges = [[0], _np_arange(step, Math.min(x_max - x_min, x_max), step), _np_arange(-step, Math.max(x_min - x_max, x_min), -step)];
    for (const inputs of ranges) {
      inputs.forEach((x, k) => {
        const new_line = line.copy();
        new_line.shift(mul(unit_vector_axis_perp_to, x));
        if ((k + 1) % ratio_faded_lines === 0) lines1.add(new_line);
        else lines2.add(new_line);
      });
    }
    return [lines1, lines2];
  }
  /** An arrow from the origin to `coords`. */
  get_vector(coords: ArrayLike<number>, kw: Kwargs = {}): Arrow {
    return new Arrow(this.coords_to_point(0, 0), this.coords_to_point(...Array.from(coords)), { ...kw, buff: 0 });
  }
  /** Insert curves so every line has at least `num_inserted_curves` (for smooth nonlinear maps). */
  prepare_for_nonlinear_transform(num_inserted_curves = 50): this {
    for (const mob of this.family_members_with_points() as VMobject[]) {
      const num_curves = mob.get_num_curves();
      if (num_inserted_curves > num_curves) mob.insert_n_curves(num_inserted_curves - num_curves);
    }
    return this;
  }
}

/** A polar grid: concentric circles and radial lines, with azimuth labels. */
export class PolarPlane extends Axes {
  declare azimuth_units: string | null;
  declare azimuth_direction: string;
  declare radius_config: Kwargs;
  declare background_line_style: Kwargs;
  declare azimuth_step: number;
  declare faded_line_style: Kwargs | null;
  declare faded_line_ratio: number;
  declare azimuth_offset: number;
  declare azimuth_label_buff: number;
  declare azimuth_label_font_size: number;
  declare azimuth_compact_fraction: boolean;
  declare background_lines: VGroup;
  declare faded_lines: VGroup;

  constructor(...args: unknown[]) {
    const o = pyargs(args, [
      'radius_max', 'size', 'radius_step', 'azimuth_step', 'azimuth_units', 'azimuth_compact_fraction', 'azimuth_offset', 'azimuth_direction',
      'azimuth_label_buff', 'azimuth_label_font_size', 'radius_config', 'background_line_style', 'faded_line_style', 'faded_line_ratio',
      'make_smooth_after_applying_functions',
    ], {
      radius_max: config.frame_y_radius, size: null, radius_step: 1, azimuth_step: null, azimuth_units: 'PI radians', azimuth_compact_fraction: true,
      azimuth_offset: 0, azimuth_direction: 'CCW', azimuth_label_buff: SMALL_BUFF, azimuth_label_font_size: 24, radius_config: null,
      background_line_style: null, faded_line_style: null, faded_line_ratio: 1, make_smooth_after_applying_functions: true,
    });
    const {
      radius_max, size, radius_step, azimuth_step, azimuth_units, azimuth_compact_fraction, azimuth_offset, azimuth_direction, azimuth_label_buff,
      azimuth_label_font_size, radius_config, background_line_style, faded_line_style, faded_line_ratio, make_smooth_after_applying_functions: _m, ...kwargs
    } = o;
    if (!['PI radians', 'TAU radians', 'degrees', 'gradians', null].includes(azimuth_units)) throw new Error('ValueError: Invalid azimuth units. Expected one of: PI radians, TAU radians, degrees, gradians or None.');
    if (!['CW', 'CCW'].includes(azimuth_direction)) throw new Error('ValueError: Invalid azimuth units. Expected one of: CW, CCW.');
    const rc: Kwargs = { stroke_width: 2, include_ticks: false, include_tip: false, line_to_number_buff: SMALL_BUFF, label_direction: DL, font_size: 24 };
    const bls: Kwargs = { stroke_color: BLUE_D, stroke_width: 2, stroke_opacity: 1 };
    const steps: Record<string, number> = { 'PI radians': 20, 'TAU radians': 20, degrees: 36, gradians: 40, null: 1 };
    Axes._update_default_configs([rc, bls], [radius_config, background_line_style]);
    // web: Float64Array ranges = manim's np.array(...) (float steps, so radius labels get decimals)
    const r = Float64Array.of(-radius_max, radius_max, radius_step);
    super({ ...kwargs, x_range: r, y_range: r.slice(), x_length: size, y_length: size, axis_config: rc });
    this.azimuth_units = azimuth_units;
    this.azimuth_direction = azimuth_direction;
    this.radius_config = rc;
    this.background_line_style = bls;
    this.azimuth_step = azimuth_step ?? steps[String(azimuth_units)];
    this.faded_line_style = faded_line_style;
    this.faded_line_ratio = faded_line_ratio;
    this.azimuth_offset = azimuth_offset;
    this.azimuth_label_buff = azimuth_label_buff;
    this.azimuth_label_font_size = azimuth_label_font_size;
    this.azimuth_compact_fraction = azimuth_compact_fraction;
    this._init_background_lines();
  }
  protected _init_background_lines(): void {
    if (this.faded_line_style == null) this.faded_line_style = faded(this.background_line_style);
    [this.background_lines, this.faded_lines] = this._get_lines();
    this.background_lines.set_style(this.background_line_style);
    this.faded_lines.set_style(this.faded_line_style);
    this.add_to_back(this.faded_lines, this.background_lines);
  }
  protected _get_lines(): [VGroup, VGroup] {
    const center = this.get_origin();
    let ratio_faded_lines = this.faded_line_ratio;
    const offset = this.azimuth_offset;
    if (ratio_faded_lines === 0) ratio_faded_lines = 1;
    const rstep = (1 / ratio_faded_lines) * this.x_axis.x_range[2];
    const astep = (1 / ratio_faded_lines) * (TAU * (1 / this.azimuth_step));
    const rlines1 = new VGroup(), rlines2 = new VGroup(), alines1 = new VGroup(), alines2 = new VGroup();
    const rinput = _np_arange(0, this.x_axis.x_range[1] + rstep, rstep);
    const ainput = _np_arange(0, TAU, astep);
    const unit_vector = this.x_axis.get_unit_vector()[0];
    rinput.forEach((x, k) => {
      const new_circle = new Circle({ radius: x * unit_vector });
      if (k % ratio_faded_lines === 0) alines1.add(new_circle);
      else alines2.add(new_circle);
    });
    const line = new Line(center, this.get_x_axis().get_end());
    ainput.forEach((x, k) => {
      const new_line = line.copy();
      new_line.rotate(x + offset, { about_point: center });
      if (k % ratio_faded_lines === 0) rlines1.add(new_line);
      else rlines2.add(new_line);
    });
    return [new VGroup(...rlines1.submobjects, ...alines1.submobjects), new VGroup(...rlines2.submobjects, ...alines2.submobjects)];
  }
  override get_axes(): VGroup {
    return this.axes;
  }
  get_vector(coords: ArrayLike<number>, kw: Kwargs = {}): Arrow {
    return new Arrow(this.coords_to_point(0, 0), this.coords_to_point(...Array.from(coords)), { ...kw, buff: 0 });
  }
  prepare_for_nonlinear_transform(num_inserted_curves = 50): this {
    for (const mob of this.family_members_with_points() as VMobject[]) {
      const num_curves = mob.get_num_curves();
      if (num_inserted_curves > num_curves) mob.insert_n_curves(num_inserted_curves - num_curves);
    }
    return this;
  }
  /** Radius numbers on the x-axis and azimuth labels around the plane. */
  get_coordinate_labels(...args: unknown[]): VGroup {
    const o = pyargs(args, ['r_values', 'a_values'], { r_values: null, a_values: null });
    const r_values = o.r_values ?? this.get_x_axis().get_tick_range().filter((r) => r >= 0);
    const a_values: number[] = o.a_values ?? _np_arange(0, 1, 1 / this.azimuth_step);
    const r_mobs = this.get_x_axis().add_numbers(r_values);
    let d: number;
    if (this.azimuth_direction === 'CCW') d = 1;
    else if (this.azimuth_direction === 'CW') d = -1;
    else throw new Error('ValueError: Invalid azimuth direction. Expected one of: CW, CCW');
    const right = this.get_right()[0];
    const a_points = Array.from(a_values, (i) => ({
      label: i,
      point: [right * Math.cos(d * (i * TAU) + this.azimuth_offset), right * Math.sin(d * (i * TAU) + this.azimuth_offset), 0] as Point3D,
    }));
    const place = (m: Mobject, p: Point3D) => m.next_to(p, { direction: p, aligned_edge: p, buff: this.azimuth_label_buff });
    const MathTex = registry.MathTex;
    const fs = this.azimuth_label_font_size;
    let a_tex: Mobject[] = [];
    if (this.azimuth_units === 'PI radians' || this.azimuth_units === 'TAU radians') a_tex = a_points.map((i) => place(this.get_radian_label(i.label, { font_size: fs }), i.point));
    else if (this.azimuth_units === 'degrees') a_tex = a_points.map((i) => place(new MathTex(fmt_g(360 * i.label) + '^{\\circ}', { font_size: fs }), i.point));
    else if (this.azimuth_units === 'gradians') a_tex = a_points.map((i) => place(new MathTex(fmt_g(400 * i.label) + '^{g}', { font_size: fs }), i.point));
    else if (this.azimuth_units == null) a_tex = a_points.map((i) => place(new MathTex(fmt_g(i.label), { font_size: fs }), i.point));
    const a_mobs = new VGroup(...(a_tex as VMobject[]));
    this.coordinate_labels = new VGroup(r_mobs, a_mobs);
    return this.coordinate_labels;
  }
  override add_coordinates(...args: unknown[]): this {
    const o = pyargs(args, ['r_values', 'a_values'], { r_values: null, a_values: null });
    this.add(this.get_coordinate_labels(o.r_values, o.a_values));
    return this;
  }
  /** A MathTex like \tfrac{\pi}{4} for a fraction of a turn. */
  get_radian_label(number: number, ...args: unknown[]): VMobject {
    const { font_size, ...kwargs } = pyargs(args, ['font_size'], { font_size: 24 });
    const constant_label = ({ 'PI radians': '\\pi', 'TAU radians': '\\tau' } as Record<string, string>)[this.azimuth_units!];
    const division = number * ({ 'PI radians': 2, 'TAU radians': 1 } as Record<string, number>)[this.azimuth_units!];
    const [num, den] = limit_denominator(division, 100);
    let string: string;
    if (num === 0) string = '0';
    else if (num === 1 && den === 1) string = constant_label;
    else if (num === 1) string = this.azimuth_compact_fraction ? `\\tfrac{${constant_label}}{${den}}` : `\\tfrac{1}{${den}}${constant_label}`;
    else if (den === 1) string = `${num}${constant_label}`;
    else if (this.azimuth_compact_fraction) string = `\\tfrac{${num}${constant_label}}{${den}}`;
    else string = `\\tfrac{${num}}{${den}}${constant_label}`;
    return new registry.MathTex(string, { ...kwargs, font_size });
  }
}

/** A NumberPlane for complex numbers: `n2p(z)` / `p2n(point)`. */
export class ComplexPlane extends NumberPlane {
  constructor(...args: unknown[]) {
    super(...args);
  }
  /** Accepts a number, a Complex or [re, im]. */
  number_to_point(number: number | Complex | readonly number[]): Point3D {
    const z = toComplex(number);
    return this.coords_to_point(z.re, z.im);
  }
  n2p(number: number | Complex | readonly number[]): Point3D {
    return this.number_to_point(number);
  }
  point_to_number(point: Point3DLike): Complex {
    const [x, y] = this.point_to_coords(point);
    return new Complex(x, y);
  }
  p2n(point: Point3DLike): Complex {
    return this.point_to_number(point);
  }
  protected _get_default_coordinate_values(): (number | Complex)[] {
    const x_numbers = this.get_x_axis().get_tick_range();
    const y_numbers = this.get_y_axis().get_tick_range().filter((y) => y !== 0).map((y) => new Complex(0, y));
    return [...x_numbers, ...y_numbers];
  }
  /** DecimalNumber labels for real and imaginary (unit "i") values. */
  get_coordinate_labels(...args: unknown[]): VGroup {
    const [nums, kw] = starKw(args);
    const kwargs: Kwargs = { ...kw };
    const numbers = nums.length === 0 ? this._get_default_coordinate_values() : nums;
    this.coordinate_labels = new VGroup();
    for (const number of numbers) {
      const z = toComplex(number);
      let axis: NumberLine, value: number;
      if (Math.abs(z.im) > Math.abs(z.re)) {
        axis = this.get_y_axis();
        value = z.im;
        kwargs.unit = 'i';
      } else {
        axis = this.get_x_axis();
        value = z.re;
      }
      this.coordinate_labels.add(axis.get_number_mobject(value, kwargs));
    }
    return this.coordinate_labels;
  }
  override add_coordinates(...args: unknown[]): this {
    this.add(this.get_coordinate_labels(...args));
    return this;
  }
}

register({ CoordinateSystem, Axes, ThreeDAxes, NumberPlane, PolarPlane, ComplexPlane });
