// manim/mobject/matrix.py
import { DOWN, DR, LEFT, MED_SMALL_BUFF, RIGHT } from '../constants';
import type { ParsableManimColor } from '../utils/color/core';
import { KW, pyargs, type Kwargs } from '../utils/pyargs';
import { register, registry } from '../utils/registry';
import { add, mul, type Point3DLike } from '../utils/vector';
import { VGroup, VMobject } from './types/vectorized_mobject';

/** Mark a plain object as Python keyword arguments (for transpiled callees). */
const kw = (o: Kwargs): Kwargs => (Object.defineProperty(o, KW, { value: true, enumerable: false }), o);
const isClass = (f: unknown): boolean => typeof f === 'function' && /^class[\s{]/.test(Function.prototype.toString.call(f));
/** Python `f(*args, **kwargs)` for a class or a function. */
const pycall = (f: any, ...args: unknown[]): any => (isClass(f) ? new f(...args) : f(...args));
const rows = (m: unknown): unknown[][] => Array.from(m as Iterable<unknown>, (r) => Array.from(r as Iterable<unknown>));

/** A LaTeX `array` for a matrix (numbers formatted like numpy's `astype(str)`). */
export function matrix_to_tex_string(matrix: unknown): string {
  let m: unknown[][];
  const arr = Array.from(matrix as Iterable<unknown>);
  if (arr.length && !(Array.isArray(arr[0]) || ArrayBuffer.isView(arr[0]))) m = arr.map((x) => [x]);
  else m = rows(arr);
  // numpy upcasts a numeric array with any fraction to float, printing 1 as "1.0"
  const nums = m.flat().filter((x) => typeof x === 'number') as number[];
  const isFloat = nums.length === m.flat().length && nums.some((x) => !Number.isInteger(x));
  const str = (x: unknown) => (typeof x === 'number' && isFloat && Number.isInteger(x) ? `${x}.0` : String(x));
  const n_cols = m[0]?.length ?? 0;
  const prefix = `\\left[ \\begin{array}{${'c'.repeat(n_cols)}}`;
  const suffix = '\\end{array} \\right]';
  return prefix + m.map((row) => row.map(str).join(' & ')).join(' \\\\ ') + suffix;
}

/** The MathTex of `matrix_to_tex_string(matrix)`. */
export function matrix_to_mobject(matrix: unknown): VMobject {
  return new registry.MathTex(matrix_to_tex_string(matrix));
}

/** A matrix of mobjects (MathTex entries by default) between brackets. */
export class Matrix extends VMobject {
  declare v_buff: number;
  declare h_buff: number;
  declare bracket_h_buff: number;
  declare bracket_v_buff: number;
  declare add_background_rectangles_to_entries: boolean;
  declare include_background_rectangle: boolean;
  declare element_to_mobject: any;
  declare element_to_mobject_config: Kwargs;
  declare element_alignment_corner: Point3DLike;
  declare left_bracket: string;
  declare right_bracket: string;
  declare stretch_brackets: boolean;
  declare elements: VGroup;
  declare brackets: VGroup;
  declare mob_matrix: VMobject[][];

  constructor(...args: unknown[]) {
    const o = pyargs(args, [
      'matrix', 'v_buff', 'h_buff', 'bracket_h_buff', 'bracket_v_buff', 'add_background_rectangles_to_entries', 'include_background_rectangle',
      'element_to_mobject', 'element_to_mobject_config', 'element_alignment_corner', 'left_bracket', 'right_bracket', 'stretch_brackets', 'bracket_config',
    ], {
      v_buff: 0.8, h_buff: 1.3, bracket_h_buff: MED_SMALL_BUFF, bracket_v_buff: MED_SMALL_BUFF, add_background_rectangles_to_entries: false,
      include_background_rectangle: false, element_to_mobject: null, element_to_mobject_config: {}, element_alignment_corner: DR, left_bracket: '[',
      right_bracket: ']', stretch_brackets: true, bracket_config: {},
    });
    const {
      matrix, v_buff, h_buff, bracket_h_buff, bracket_v_buff, add_background_rectangles_to_entries, include_background_rectangle, element_to_mobject,
      element_to_mobject_config, element_alignment_corner, left_bracket, right_bracket, stretch_brackets, bracket_config, ...kwargs
    } = o;
    super(kwargs);
    this.v_buff = v_buff;
    this.h_buff = h_buff;
    this.bracket_h_buff = bracket_h_buff;
    this.bracket_v_buff = bracket_v_buff;
    this.add_background_rectangles_to_entries = add_background_rectangles_to_entries;
    this.include_background_rectangle = include_background_rectangle;
    this.element_to_mobject = element_to_mobject ?? registry.MathTex;
    this.element_to_mobject_config = element_to_mobject_config;
    this.element_alignment_corner = element_alignment_corner;
    this.left_bracket = left_bracket;
    this.right_bracket = right_bracket;
    this.stretch_brackets = stretch_brackets;
    const mob_matrix = this._matrix_to_mob_matrix(matrix);
    this._organize_mob_matrix(mob_matrix);
    this.elements = new VGroup(...mob_matrix.flat());
    this.add(this.elements);
    this._add_brackets(this.left_bracket, this.right_bracket, bracket_config);
    this.center();
    this.mob_matrix = mob_matrix;
    if (this.add_background_rectangles_to_entries) for (const mob of this.elements) mob.add_background_rectangle();
    if (this.include_background_rectangle) this.add_background_rectangle();
  }
  protected _matrix_to_mob_matrix(matrix: unknown): VMobject[][] {
    return rows(matrix).map((row) => row.map((item) => pycall(this.element_to_mobject, item, kw({ ...this.element_to_mobject_config }))));
  }
  protected _organize_mob_matrix(matrix: VMobject[][]): this {
    matrix.forEach((row, i) => row.forEach((mob, j) => mob.move_to(add(mul(i * this.v_buff, DOWN), mul(j * this.h_buff, RIGHT)), this.element_alignment_corner)));
    return this;
  }
  protected _add_brackets(left = '[', right = ']', kwargs: Kwargs = {}): this {
    const BRACKET_HEIGHT = 0.5977;
    const n = Math.trunc(this.height / BRACKET_HEIGHT) + 1;
    const empty_tex_array = ['\\begin{array}{c}', ...new Array(n).fill('\\quad \\\\'), '\\end{array}'].join('');
    const tex_left = ['\\left' + left, empty_tex_array, '\\right.'].join('');
    const tex_right = ['\\left.', empty_tex_array, '\\right' + right].join('');
    const l_bracket: VMobject = new registry.MathTex(tex_left, { ...kwargs });
    const r_bracket: VMobject = new registry.MathTex(tex_right, { ...kwargs });
    const bracket_pair = new VGroup(l_bracket, r_bracket);
    if (this.stretch_brackets) bracket_pair.stretch_to_fit_height(this.height + 2 * this.bracket_v_buff);
    l_bracket.next_to(this, LEFT, this.bracket_h_buff);
    r_bracket.next_to(this, RIGHT, this.bracket_h_buff);
    this.brackets = bracket_pair;
    this.add(l_bracket, r_bracket);
    return this;
  }
  /** The columns, each a VGroup of entries. */
  get_columns(): VGroup {
    return new VGroup(...this.mob_matrix[0].map((_, i) => new VGroup(...this.mob_matrix.map((row) => row[i]))));
  }
  /** Colours column i with colors[i]. */
  set_column_colors(...colors: ParsableManimColor[]): this {
    const columns = this.get_columns().submobjects;
    colors.slice(0, columns.length).forEach((c, i) => columns[i].set_color(c));
    return this;
  }
  /** The rows, each a VGroup of entries. */
  get_rows(): VGroup {
    return new VGroup(...this.mob_matrix.map((row) => new VGroup(...row)));
  }
  /** Colours row i with colors[i]. */
  set_row_colors(...colors: ParsableManimColor[]): this {
    const rs = this.get_rows().submobjects;
    colors.slice(0, rs.length).forEach((c, i) => rs[i].set_color(c));
    return this;
  }
  add_background_to_entries(): this {
    for (const mob of this.get_entries()) mob.add_background_rectangle();
    return this;
  }
  get_mob_matrix(): VMobject[][] {
    return this.mob_matrix;
  }
  get_entries(): VGroup {
    return this.elements;
  }
  get_brackets(): VGroup {
    return this.brackets;
  }
}

/** A matrix of DecimalNumbers (one decimal place by default). */
export class DecimalMatrix extends Matrix {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['matrix', 'element_to_mobject', 'element_to_mobject_config'], { element_to_mobject: null, element_to_mobject_config: { num_decimal_places: 1 } });
    const { matrix, element_to_mobject, element_to_mobject_config, ...rest } = o;
    super(matrix, { ...rest, element_to_mobject: element_to_mobject ?? registry.DecimalNumber, element_to_mobject_config });
  }
}

/** A matrix of Integers. */
export class IntegerMatrix extends Matrix {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['matrix', 'element_to_mobject'], { element_to_mobject: null });
    const { matrix, element_to_mobject, ...rest } = o;
    super(matrix, { ...rest, element_to_mobject: element_to_mobject ?? registry.Integer });
  }
}

/** A matrix whose entries are given mobjects. */
export class MobjectMatrix extends Matrix {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['matrix', 'element_to_mobject'], { element_to_mobject: (m: VMobject) => m });
    const { matrix, element_to_mobject, ...rest } = o;
    super(matrix, { ...rest, element_to_mobject });
  }
}

/** "det( ... ) = determinant" around a matrix. */
export function get_det_text(matrix: VMobject, determinant: number | string | null = null, background_rect = false, initial_scale_factor = 2): VGroup {
  const parens: VMobject = new registry.MathTex('(', ')');
  parens.scale(initial_scale_factor);
  parens.stretch_to_fit_height(matrix.height);
  const [l_paren, r_paren] = [...parens] as VMobject[];
  l_paren.next_to(matrix, LEFT, { buff: 0.1 });
  r_paren.next_to(matrix, RIGHT, { buff: 0.1 });
  const det: VMobject = new registry.Tex('det');
  det.scale(initial_scale_factor);
  det.next_to(l_paren, LEFT, { buff: 0.1 });
  if (background_rect) det.add_background_rectangle();
  const det_text = new VGroup(det, l_paren, r_paren);
  if (determinant !== null && determinant !== undefined) {
    const eq: VMobject = new registry.MathTex('=');
    eq.next_to(r_paren, RIGHT, { buff: 0.1 });
    const result: VMobject = new registry.MathTex(String(determinant));
    result.next_to(eq, RIGHT, { buff: 0.2 });
    det_text.add(eq, result);
  }
  return det_text;
}

register({ Matrix, DecimalMatrix, IntegerMatrix, MobjectMatrix });
