// manim/scene/vector_space_scene.py
import { config } from '../_config';
import { Animation } from '../animation/animation';
import { Create, DrawBorderThenFill, Write } from '../animation/creation';
import { FadeOut } from '../animation/fading';
import { GrowArrow } from '../animation/growing';
import { ApplyFunction, ApplyPointwiseFunction, Transform } from '../animation/transform';
import { DL, DOWN, LARGE_BUFF, LEFT, ORIGIN, RIGHT, SMALL_BUFF, UP } from '../constants';
import { Dot } from '../mobject/geometry/arc';
import { Arrow, Line, Vector } from '../mobject/geometry/line';
import { Rectangle } from '../mobject/geometry/polygram';
import { Group, Mobject } from '../mobject/mobject';
import { VGroup, VMobject } from '../mobject/types/vectorized_mobject';
import { ManimColor, type ParsableManimColor } from '../utils/color/core';
import { BLACK, BLUE_D, GREEN_C, GREY, PURE_YELLOW, RED_C, WHITE } from '../utils/color/manim_colors';
import { update_dict_recursively } from '../utils/config_ops';
import { pyargs, type Kwargs } from '../utils/pyargs';
import { registry } from '../utils/registry';
import { rush_from, rush_into } from '../utils/rate_functions';
import { angle_of_vector } from '../utils/space_ops';
import { add, mul, norm, sub, to3, type Point3D, type Point3DLike } from '../utils/vector';
import { Scene } from './scene';

export const X_COLOR = GREEN_C;
export const Y_COLOR = RED_C;
export const Z_COLOR = BLUE_D;

type Matrix = readonly (readonly number[])[];
const transpose = (m: Matrix): number[][] => m[0].map((_, j) => m.map((row) => row[j]));
/** numpy.linalg.inv for small square matrices (Gauss-Jordan). */
function inv(m: Matrix): number[][] {
  const n = m.length;
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (a[p][c] === 0) throw new Error('Singular matrix');
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = a[r][c];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((r) => r.slice(n));
}
const toMatrix = (m: unknown): number[][] => Array.from(m as ArrayLike<ArrayLike<number>>, (r) => Array.from(r, Number));

/** A scene with helpers for drawing vectors on a coordinate plane. */
export class VectorScene extends Scene {
  declare basis_vector_stroke_width: number;
  declare plane: any;

  constructor(...args: unknown[]) {
    const o = pyargs(args, [], { basis_vector_stroke_width: 6.0 });
    const { basis_vector_stroke_width, ...kw } = o;
    super(kw);
    this.basis_vector_stroke_width = basis_vector_stroke_width;
  }
  /** Adds a NumberPlane (optionally animated). */
  add_plane(animate = false, kw: Kwargs = {}): any {
    const plane = new registry.NumberPlane(kw);
    if (animate) this.play(new Create(plane, { lag_ratio: 0.5 }));
    this.add(plane);
    return plane;
  }
  add_axes(animate = false, color: ParsableManimColor = WHITE): any {
    const axes = new registry.Axes({ color, axis_config: { unit_size: 1 } });
    if (animate) this.play(new Create(axes));
    this.add(axes);
    return axes;
  }
  /** web: manim bakes the faded grid into the camera background; here the grid stays as background mobjects. */
  lock_in_faded_grid(dimness = 0.7, axes_dimness = 0.5): void {
    const plane = this.add_plane();
    const axes = plane.get_axes();
    plane.fade(dimness);
    axes.set_color(WHITE);
    axes.fade(axes_dimness);
    this.add(axes);
    this.clear();
    this.add(plane, axes);
  }
  get_vector(numerical_vector: Point3DLike, kw: Kwargs = {}): Arrow {
    return new Arrow(this.plane.coords_to_point(0, 0), this.plane.coords_to_point(...Array.from(numerical_vector).slice(0, 2)), { buff: 0, ...kw });
  }
  add_vector(...args: unknown[]): Arrow {
    const o = pyargs(args, ['vector', 'color', 'animate'], { color: PURE_YELLOW, animate: true });
    const { vector: v, color, animate, ...kw } = o;
    const vector: Arrow = v instanceof Arrow ? v : new Vector(to3(v), { color, ...kw });
    if (animate) this.play(new GrowArrow(vector));
    this.add(vector);
    return vector;
  }
  write_vector_coordinates(vector: Vector, kw: Kwargs = {}): Mobject {
    const coords = vector.coordinate_label(kw);
    this.play(new Write(coords));
    return coords;
  }
  get_basis_vectors(i_hat_color: ParsableManimColor = X_COLOR, j_hat_color: ParsableManimColor = Y_COLOR): VGroup {
    return new VGroup(...([[[1, 0], i_hat_color], [[0, 1], j_hat_color]] as [number[], ParsableManimColor][]).map(([vect, color]) => new Vector(vect, { color, stroke_width: this.basis_vector_stroke_width })));
  }
  get_basis_vector_labels(kw: Kwargs = {}): VGroup {
    const i_hat = this.get_basis_vectors().submobjects[0] as Vector;
    const j_hat = this.get_basis_vectors().submobjects[1] as Vector;
    return new VGroup(...([[i_hat, '\\hat{\\imath}', X_COLOR], [j_hat, '\\hat{\\jmath}', Y_COLOR]] as [Vector, string, ParsableManimColor][]).map(([vect, label, color]) =>
      this.get_vector_label(vect, label, { color, label_scale_factor: 1, ...kw })));
  }
  get_vector_label(vector: Vector, label: Mobject | string, ...rest: unknown[]): Mobject {
    const o = pyargs(rest, ['at_tip', 'direction', 'rotate', 'color', 'label_scale_factor'], { at_tip: false, direction: 'left', rotate: false, color: null, label_scale_factor: LARGE_BUFF - 0.2 });
    let lab: Mobject;
    if (typeof label === 'string') {
      let tex = label;
      if (tex.length === 1) tex = `\\vec{\\textbf{${tex}}}`;
      lab = new registry.MathTex(tex);
      lab.set_color(o.color ?? vector.get_color());
    } else lab = label;
    lab.scale(o.label_scale_factor);
    lab.add_background_rectangle();
    if (o.at_tip) {
      const vect = vector.get_vector();
      const n = norm(vect);
      lab.next_to(vector.get_end(), [vect[0] / n, vect[1] / n, vect[2] / n], { buff: SMALL_BUFF });
    } else {
      const angle = vector.get_angle();
      if (!o.rotate) lab.rotate(-angle, { about_point: ORIGIN });
      if (o.direction === 'left') lab.shift(add(mul(-1, lab.get_bottom()), mul(0.1, UP)));
      else lab.shift(add(mul(-1, lab.get_top()), mul(0.1, DOWN)));
      lab.rotate(angle, { about_point: ORIGIN });
      lab.shift(mul(0.5, sub(vector.get_end(), vector.get_start())));
    }
    return lab;
  }
  label_vector(vector: Vector, label: Mobject | string, ...rest: unknown[]): Mobject {
    const o = pyargs(rest, ['animate'], { animate: true });
    const { animate, ...kw } = o;
    const mathtex_label = this.get_vector_label(vector, label, kw);
    if (animate) this.play(new Write(mathtex_label, { run_time: 1 }));
    this.add(mathtex_label);
    return mathtex_label;
  }
  position_x_coordinate(x_coord: Mobject, x_line: Line, vector: Point3DLike): Mobject {
    x_coord.next_to(x_line, mul(-Math.sign(vector[1]), UP));
    x_coord.set_color(X_COLOR);
    return x_coord;
  }
  position_y_coordinate(y_coord: Mobject, y_line: Line, vector: Point3DLike): Mobject {
    y_coord.next_to(y_line, mul(Math.sign(vector[0]), RIGHT));
    y_coord.set_color(Y_COLOR);
    return y_coord;
  }
  /** Animates writing the coordinates of `vector`, then drawing it. */
  coords_to_vector(vector: number[], coords_start: Point3DLike = add(mul(2, RIGHT), mul(2, UP)), clean_up = true): void {
    const starting_mobjects = [...this.mobjects];
    const array = new registry.Matrix(vector.map((x) => [x]));
    array.shift(coords_start);
    const arrow = new Vector(vector);
    const x_line = new Line(ORIGIN, mul(vector[0], RIGHT));
    const y_line = new Line(x_line.get_end(), arrow.get_end());
    x_line.set_color(X_COLOR);
    y_line.set_color(Y_COLOR);
    const mob_matrix = array.get_mob_matrix();
    const x_coord = mob_matrix[0][0];
    const y_coord = mob_matrix[1][0];
    this.play(new Write(array, { run_time: 1 }));
    this.wait();
    this.play(new ApplyFunction((x: Mobject) => this.position_x_coordinate(x, x_line, vector), x_coord));
    this.play(new Create(x_line));
    this.play(new ApplyFunction((y: Mobject) => this.position_y_coordinate(y, y_line, vector), y_coord), new FadeOut(array.get_brackets()));
    this.play(new Create(y_line));
    this.play(new Create(arrow));
    this.wait();
    if (clean_up) {
      this.clear();
      this.add(...starting_mobjects);
    }
  }
  /** Animates reading off the coordinates of a vector. */
  vector_to_coords(vector: Arrow | Point3DLike, integer_labels = true, clean_up = true): [Mobject, Line, Line] {
    const starting_mobjects = [...this.mobjects];
    let show_creation = false;
    let arrow: Arrow;
    let v: number[];
    if (vector instanceof Arrow) {
      arrow = vector;
      v = arrow.get_end().slice(0, 2);
    } else {
      v = Array.from(vector);
      arrow = new Vector(v);
      show_creation = true;
    }
    const array = (arrow as Vector).coordinate_label({ integer_labels }) as any;
    const x_line = new Line(ORIGIN, mul(v[0], RIGHT));
    const y_line = new Line(x_line.get_end(), arrow.get_end());
    x_line.set_color(X_COLOR);
    y_line.set_color(Y_COLOR);
    const temp = array.get_entries();
    const x_coord = temp.submobjects[0], y_coord = temp.submobjects[1];
    const x_coord_start = this.position_x_coordinate(x_coord.copy(), x_line, v);
    const y_coord_start = this.position_y_coordinate(y_coord.copy(), y_line, v);
    const brackets = array.get_brackets();
    if (show_creation) this.play(new Create(arrow));
    this.play(new Create(x_line), new Write(x_coord_start), { run_time: 1 });
    this.play(new Create(y_line), new Write(y_coord_start), { run_time: 1 });
    this.wait();
    this.play(new Transform(x_coord_start, x_coord, { lag_ratio: 0 }), new Transform(y_coord_start, y_coord, { lag_ratio: 0 }), new Write(brackets, { run_time: 1 }));
    this.wait();
    this.remove(x_coord_start, y_coord_start, brackets);
    this.add(array);
    if (clean_up) {
      this.clear();
      this.add(...starting_mobjects);
    }
    return [array, x_line, y_line];
  }
  /** Shows a grid of dots moving along `vector`. */
  show_ghost_movement(vector: Arrow | Point3DLike): void {
    const v: Point3D = vector instanceof Arrow ? sub(vector.get_end(), vector.get_start()) : to3(vector);
    const x_max = Math.trunc(config.frame_x_radius + Math.abs(v[0]));
    const y_max = Math.trunc(config.frame_y_radius + Math.abs(v[1]));
    const dots_list: VMobject[] = [];
    for (let x = -x_max; x < x_max; x++) for (let y = -y_max; y < y_max; y++) dots_list.push(new Dot([x, y, 0]));
    const dots = new VMobject();
    dots.add(...dots_list);
    dots.set_fill(BLACK, { opacity: 0 });
    const dots_halfway = dots.copy().shift(mul(0.5, v)).set_fill(WHITE, 1);
    const dots_end = dots.copy().shift(v);
    this.play(new Transform(dots, dots_halfway, { rate_func: rush_into }));
    this.play(new Transform(dots, dots_end, { rate_func: rush_from }));
    this.remove(dots);
  }
}

/** A VectorScene showing linear transformations of the plane (apply_matrix, apply_function...). */
export class LinearTransformationScene extends VectorScene {
  declare include_background_plane: boolean;
  declare include_foreground_plane: boolean;
  declare show_coordinates: boolean;
  declare show_basis_vectors: boolean;
  declare i_hat_color: ManimColor;
  declare j_hat_color: ManimColor;
  declare leave_ghost_vectors: boolean;
  declare background_plane_kwargs: Kwargs;
  declare foreground_plane_kwargs: Kwargs;
  declare ghost_vectors: VGroup;
  declare has_already_setup?: boolean;
  declare background_mobjects: Mobject[];
  declare transformable_mobjects: Mobject[];
  declare moving_vectors: Mobject[];
  declare transformable_labels: any[];
  declare moving_mobjects: Mobject[];
  declare background_plane: any;
  declare basis_vectors: VGroup;
  declare i_hat: Vector;
  declare j_hat: Vector;
  declare square: Rectangle;
  declare title: Mobject;

  constructor(...args: unknown[]) {
    const o = pyargs(args, [
      'include_background_plane', 'include_foreground_plane', 'background_plane_kwargs', 'foreground_plane_kwargs', 'show_coordinates', 'show_basis_vectors',
      'basis_vector_stroke_width', 'i_hat_color', 'j_hat_color', 'leave_ghost_vectors',
    ], {
      include_background_plane: true, include_foreground_plane: true, background_plane_kwargs: null, foreground_plane_kwargs: null, show_coordinates: false,
      show_basis_vectors: true, basis_vector_stroke_width: 6, i_hat_color: X_COLOR, j_hat_color: Y_COLOR, leave_ghost_vectors: false,
    });
    const {
      include_background_plane, include_foreground_plane, background_plane_kwargs, foreground_plane_kwargs, show_coordinates, show_basis_vectors,
      basis_vector_stroke_width, i_hat_color, j_hat_color, leave_ghost_vectors, ...kw
    } = o;
    super(kw);
    this.include_background_plane = include_background_plane;
    this.include_foreground_plane = include_foreground_plane;
    this.show_coordinates = show_coordinates;
    this.show_basis_vectors = show_basis_vectors;
    this.basis_vector_stroke_width = basis_vector_stroke_width;
    this.i_hat_color = new ManimColor(i_hat_color);
    this.j_hat_color = new ManimColor(j_hat_color);
    this.leave_ghost_vectors = leave_ghost_vectors;
    this.background_plane_kwargs = { color: GREY, axis_config: { color: GREY }, background_line_style: { stroke_color: GREY, stroke_width: 1 } };
    this.ghost_vectors = new VGroup();
    this.foreground_plane_kwargs = { x_range: [-config.frame_width, config.frame_width, 1.0], y_range: [-config.frame_width, config.frame_width, 1.0], faded_line_ratio: 1 };
    LinearTransformationScene.update_default_configs([this.foreground_plane_kwargs, this.background_plane_kwargs], [foreground_plane_kwargs, background_plane_kwargs]);
  }
  static update_default_configs(default_configs: Kwargs[], passed_configs: (Kwargs | null)[]): void {
    default_configs.forEach((d, i) => {
      const p = passed_configs[i];
      if (p !== null && p !== undefined) update_dict_recursively(d, p);
    });
  }
  override setup(): void {
    if (this.has_already_setup) return;
    this.has_already_setup = true;
    this.background_mobjects = [];
    this.foreground_mobjects = [];
    this.transformable_mobjects = [];
    this.moving_vectors = [];
    this.transformable_labels = [];
    this.moving_mobjects = [];
    this.background_plane = new registry.NumberPlane(this.background_plane_kwargs);
    if (this.show_coordinates) this.background_plane.add_coordinates();
    if (this.include_background_plane) this.add_background_mobject(this.background_plane);
    if (this.include_foreground_plane) {
      this.plane = new registry.NumberPlane(this.foreground_plane_kwargs);
      this.add_transformable_mobject(this.plane);
    }
    if (this.show_basis_vectors) {
      this.basis_vectors = this.get_basis_vectors(this.i_hat_color, this.j_hat_color);
      this.moving_vectors.push(...this.basis_vectors.submobjects);
      [this.i_hat, this.j_hat] = this.basis_vectors.submobjects as Vector[];
      this.add(this.basis_vectors);
    }
  }
  add_special_mobjects(mob_list: Mobject[], ...mobs_to_add: Mobject[]): void {
    for (const mobject of mobs_to_add) {
      if (!mob_list.includes(mobject)) {
        mob_list.push(mobject);
        this.add(mobject);
      }
    }
  }
  add_background_mobject(...mobjects: Mobject[]): void {
    this.add_special_mobjects(this.background_mobjects, ...mobjects);
  }
  // manim overrides Scene.add_foreground_mobject with this list-based version
  override add_foreground_mobject(...mobjects: Mobject[]): this {
    this.add_special_mobjects(this.foreground_mobjects, ...mobjects);
    return this;
  }
  add_transformable_mobject(...mobjects: Mobject[]): void {
    this.add_special_mobjects(this.transformable_mobjects, ...mobjects);
  }
  add_moving_mobject(mobject: Mobject, target_mobject: Mobject | null = null): void {
    mobject.target = target_mobject;
    this.add_special_mobjects(this.moving_mobjects, mobject);
  }
  get_ghost_vectors(): VGroup {
    return this.ghost_vectors;
  }
  get_unit_square(color: ParsableManimColor = PURE_YELLOW, opacity = 0.3, stroke_width = 3): Rectangle {
    const square = new Rectangle({
      color, width: this.plane.get_x_unit_size(), height: this.plane.get_y_unit_size(), stroke_color: color, stroke_width, fill_color: color, fill_opacity: opacity,
    });
    this.square = square;
    square.move_to(this.plane.coords_to_point(0, 0), DL);
    return square;
  }
  add_unit_square(animate = false, kw: Kwargs = {}): this {
    const square = this.get_unit_square(kw.color, kw.opacity, kw.stroke_width);
    if (animate) this.play(new DrawBorderThenFill(square), new Animation(new Group(...this.moving_vectors)));
    this.add_transformable_mobject(square);
    this.bring_to_front(...this.moving_vectors);
    this.square = square;
    return this;
  }
  override add_vector(...args: unknown[]): Arrow {
    const o = pyargs(args, ['vector', 'color', 'animate'], { color: PURE_YELLOW, animate: false });
    const vector = super.add_vector(o);
    this.moving_vectors.push(vector);
    return vector;
  }
  override write_vector_coordinates(vector: Vector, kw: Kwargs = {}): Mobject {
    const coords = super.write_vector_coordinates(vector, kw);
    this.add_foreground_mobject(coords);
    return coords;
  }
  add_transformable_label(vector: Vector, label: Mobject | string, ...rest: unknown[]): Mobject {
    const o = pyargs(rest, ['transformation_name', 'new_label'], { transformation_name: 'L', new_label: null });
    const { transformation_name, new_label, ...kw } = o;
    const label_mob: any = this.label_vector(vector, label, kw);
    label_mob.target_text = new_label ? new_label : `${transformation_name}(${label_mob.get_tex_string()})`;
    label_mob.vector = vector;
    label_mob.kwargs = { ...kw };
    delete label_mob.kwargs.animate;
    this.transformable_labels.push(label_mob);
    return label_mob;
  }
  add_title(title: Mobject | string, scale_factor = 1.5, animate = false): this {
    const t: Mobject = title instanceof Mobject ? title : new registry.Tex(title).scale(scale_factor);
    t.to_edge(UP);
    t.add_background_rectangle();
    if (animate) this.play(new Write(t));
    this.add_foreground_mobject(t);
    this.title = t;
    return this;
  }
  get_matrix_transformation(matrix: unknown): (p: Point3D) => Point3D {
    return this.get_transposed_matrix_transformation(transpose(toMatrix(matrix)));
  }
  get_transposed_matrix_transformation(transposed_matrix: unknown): (p: Point3D) => Point3D {
    let t = toMatrix(transposed_matrix);
    if (t.length === 2 && t[0].length === 2) t = [[t[0][0], t[0][1], 0], [t[1][0], t[1][1], 0], [0, 0, 1]];
    else if (t.length !== 3 || t[0].length !== 3) throw new Error('Matrix has bad dimensions');
    // np.dot(point, transposed_matrix)
    return (p: Point3DLike) => [0, 1, 2].map((j) => p[0] * t[0][j] + p[1] * t[1][j] + (p[2] ?? 0) * t[2][j]) as Point3D;
  }
  get_piece_movement(pieces: Iterable<Mobject>): Transform {
    const v_pieces = [...pieces].filter((p): p is VMobject => p instanceof VMobject);
    const start = new VGroup(...v_pieces);
    const target = new VGroup(...v_pieces.map((mob) => mob.target as VMobject));
    if (this.leave_ghost_vectors && start.submobjects.length) {
      this.ghost_vectors.add(start.copy().fade(0.7));
      this.add(this.ghost_vectors.submobjects[this.ghost_vectors.submobjects.length - 1]);
    }
    return new Transform(start, target, { lag_ratio: 0 });
  }
  get_moving_mobject_movement(func: (p: Point3D) => Point3DLike): Transform {
    for (const m of this.moving_mobjects) {
      if (m.target === null || m.target === undefined) m.target = m.copy();
      m.target.move_to(func(m.get_center()));
    }
    return this.get_piece_movement(this.moving_mobjects);
  }
  get_vector_movement(func: (p: Point3D) => Point3DLike): Transform {
    for (const v of this.moving_vectors) {
      const target = new Vector(func(v.get_end()), { color: v.get_color() });
      v.target = target;
      const n = norm(target.get_end());
      if (n < 0.1) target.get_tip().scale(n);
    }
    return this.get_piece_movement(this.moving_vectors);
  }
  get_transformable_label_movement(): Transform {
    for (const label of this.transformable_labels) label.target = this.get_vector_label(label.vector.target, label.target_text, label.kwargs);
    return this.get_piece_movement(this.transformable_labels);
  }
  /** Applies `matrix` to the plane, the vectors and the other transformable mobjects. */
  apply_matrix(matrix: unknown, kw: Kwargs = {}): void {
    this.apply_transposed_matrix(transpose(toMatrix(matrix)), kw);
  }
  apply_inverse(matrix: unknown, kw: Kwargs = {}): void {
    this.apply_matrix(inv(toMatrix(matrix)), kw);
  }
  apply_transposed_matrix(transposed_matrix: unknown, kw: Kwargs = {}): void {
    const func = this.get_transposed_matrix_transformation(transposed_matrix);
    kw = { ...kw };
    if (!('path_arc' in kw)) kw.path_arc = (angle_of_vector(func(RIGHT)) + (angle_of_vector(func(UP)) - Math.PI / 2)) / 2;
    this.apply_function(func, kw);
  }
  apply_inverse_transpose(t_matrix: unknown, kw: Kwargs = {}): void {
    const t_inv = transpose(inv(transpose(toMatrix(t_matrix))));
    this.apply_transposed_matrix(t_inv, kw);
  }
  apply_nonlinear_transformation(fn: (p: Point3D) => Point3DLike, kw: Kwargs = {}): void {
    this.plane.prepare_for_nonlinear_transform();
    this.apply_function(fn, kw);
  }
  apply_function(fn: (p: Point3D) => Point3DLike, ...rest: unknown[]): void {
    const o = pyargs(rest, ['added_anims'], { added_anims: [] });
    const { added_anims, ...kw } = o;
    if (!('run_time' in kw)) kw.run_time = 3;
    const anims: Animation[] = [
      ...this.transformable_mobjects.map((t_mob) => new ApplyPointwiseFunction(fn, t_mob)),
      this.get_vector_movement(fn), this.get_transformable_label_movement(), this.get_moving_mobject_movement(fn),
      ...this.foreground_mobjects.map((f_mob) => new Animation(f_mob)),
      ...added_anims,
    ];
    this.play(...anims, kw);
  }
}
