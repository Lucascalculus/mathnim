// manim/mobject/graphing/functions.py
import { config } from '../../_config';
import { PURE_YELLOW } from '../../utils/color/manim_colors';
import { plot_isoline } from '../../utils/isosurfaces';
import { pyargs, type Kwargs } from '../../utils/pyargs';
import { register } from '../../utils/registry';
import type { Point3D } from '../../utils/vector';
import { VMobject } from '../types/vectorized_mobject';
import { _np_arange } from './number_line';
import { LinearBase, type _ScaleBase } from './scale';

const isArrayLike = (v: unknown): v is ArrayLike<any> => Array.isArray(v) || ArrayBuffer.isView(v);
/** np.asarray: typed arrays become plain arrays, everything else is kept. */
const asarray = (v: any): any => (ArrayBuffer.isView(v) ? Array.from(v as any) : v);
/** numpy float conversion: a non-number coordinate (e.g. a function) is an error, not NaN. */
const coord = (x: any): number => {
  if (typeof x === 'number') return x;
  if (typeof x === 'boolean') return +x;
  throw new TypeError(`float() argument must be a string or a real number, not '${typeof x === 'function' ? 'function' : typeof x}'`);
};
const toPoint = (p: any): Point3D => [coord(p[0]), coord(p[1]), p.length > 2 ? coord(p[2]) : 0];

/** A curve t -> function(t) sampled every `t_step` over `t_range` (smoothed unless `use_smoothing` is false). */
export class ParametricFunction extends VMobject {
  declare function: (t: any) => any;
  declare scaling: _ScaleBase;
  declare dt: number;
  declare discontinuities: number[] | null;
  declare use_smoothing: boolean;
  declare use_vectorized: boolean;
  declare t_min: number;
  declare t_max: number;
  declare t_step: number;
  /** Set by CoordinateSystem.plot* (the function in axis coordinates). */
  declare underlying_function?: (x: any) => any;

  constructor(...args: unknown[]) {
    super(pyargs(args, ['function', 't_range', 'scaling', 'dt', 'discontinuities', 'use_smoothing', 'use_vectorized'], {
      t_range: [0, 1], scaling: null, dt: 1e-8, discontinuities: null, use_smoothing: true, use_vectorized: false,
    }));
  }
  protected override _init_attrs(kw: Kwargs): void {
    const fn = kw.function;
    this.function = (t: any) => asarray(fn(t));
    let t_range = Array.from(kw.t_range ?? [0, 1]) as number[];
    if (t_range.length === 2) t_range = [...t_range, 0.01];
    this.scaling = kw.scaling ?? new LinearBase();
    this.dt = kw.dt ?? 1e-8;
    this.discontinuities = kw.discontinuities ?? null;
    this.use_smoothing = kw.use_smoothing ?? true;
    this.use_vectorized = kw.use_vectorized ?? false;
    [this.t_min, this.t_max, this.t_step] = t_range;
    super._init_attrs(kw);
  }
  get_function(): (t: any) => any {
    return this.function;
  }
  get_point_from_function(t: number): Point3D {
    return this.function(t);
  }
  override generate_points(): this {
    let boundary_times: number[];
    if (this.discontinuities != null) {
      const d = Array.from(this.discontinuities as ArrayLike<number>).filter((t) => this.t_min <= t && t <= this.t_max);
      boundary_times = [this.t_min, this.t_max, ...d.map((t) => t - this.dt), ...d.map((t) => t + this.dt)];
      boundary_times.sort((a, b) => a - b);
    } else boundary_times = [this.t_min, this.t_max];
    for (let i = 0; i + 1 < boundary_times.length; i += 2) {
      const t1 = boundary_times[i], t2 = boundary_times[i + 1];
      const t_range: number[] = [...this.scaling.function(_np_arange(t1, t2, this.t_step)), this.scaling.function(t2)];
      let points: Point3D[];
      if (this.use_vectorized) {
        const [x, y, zz] = this.function(t_range) as any[];
        const xs = Array.from(x as ArrayLike<number>), ys = Array.from(y as ArrayLike<number>);
        const zs = isArrayLike(zz) ? Array.from(zz as ArrayLike<number>) : xs.map(() => 0);
        points = xs.map((xi, k) => [xi, ys[k], zs[k]]);
      } else points = t_range.map((t) => toPoint(this.function(t)));
      this.start_new_path(points[0]);
      this.add_points_as_corners(points.slice(1));
    }
    if (this.use_smoothing) this.make_smooth();
    return this;
  }
  init_points(): this {
    return this.generate_points();
  }
}

/** The graph of y = function(x) over `x_range` (default: the frame width). */
export class FunctionGraph extends ParametricFunction {
  declare x_range: number[];
  declare parametric_function: (t: number) => Point3D;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['function', 'x_range', 'color'], { x_range: null, color: PURE_YELLOW });
    const { function: fn, color, ...kwargs } = o;
    delete kwargs.x_range;
    const x_range = o.x_range ?? [-config.frame_x_radius, config.frame_x_radius];
    const parametric_function = (t: number): Point3D => [t, fn(t), 0];
    // manim sets self.function = function first, but ParametricFunction then overwrites it
    super(parametric_function, x_range, { ...kwargs, color });
    this.x_range = x_range;
    this.parametric_function = parametric_function;
  }
  override get_function(): (t: any) => any {
    return this.function;
  }
  override get_point_from_function(x: number): Point3D {
    return this.parametric_function(x);
  }
}

/** The curve func(x, y) = 0, traced with a quadtree + marching triangles (isosurfaces.plot_isoline). */
export class ImplicitFunction extends VMobject {
  declare function: (x: number, y: number) => number;
  declare min_depth: number;
  declare max_quads: number;
  declare use_smoothing: boolean;
  declare x_range: number[];
  declare y_range: number[];
  constructor(...args: unknown[]) {
    super(pyargs(args, ['func', 'x_range', 'y_range', 'min_depth', 'max_quads', 'use_smoothing'], {
      x_range: null, y_range: null, min_depth: 5, max_quads: 1500, use_smoothing: true,
    }));
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.function = kw.func;
    this.min_depth = kw.min_depth ?? 5;
    this.max_quads = kw.max_quads ?? 1500;
    this.use_smoothing = kw.use_smoothing ?? true;
    this.x_range = kw.x_range && kw.x_range.length ? Array.from(kw.x_range) : [-config.frame_width / 2, config.frame_width / 2];
    this.y_range = kw.y_range && kw.y_range.length ? Array.from(kw.y_range) : [-config.frame_height / 2, config.frame_height / 2];
    super._init_attrs(kw);
  }
  override generate_points(): this {
    const curves = plot_isoline((u) => this.function(u[0], u[1]), [this.x_range[0], this.y_range[0]], [this.x_range[1], this.y_range[1]], this.min_depth, this.max_quads);
    for (const curve of curves) {
      if (!curve.length) continue;
      const pts: Point3D[] = curve.map((p) => [p[0], p[1], 0]);
      this.start_new_path(pts[0]);
      this.add_points_as_corners(pts.slice(1));
    }
    if (this.use_smoothing) this.make_smooth();
    return this;
  }
  init_points(): this {
    return this.generate_points();
  }
}

register({ ParametricFunction, FunctionGraph, ImplicitFunction });
