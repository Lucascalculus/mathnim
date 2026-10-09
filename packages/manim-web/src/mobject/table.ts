// manim/mobject/table.py
import { AnimationGroup } from '../animation/composition';
import { Create, Write } from '../animation/creation';
import { FadeIn } from '../animation/fading';
import { BLACK, PURE_YELLOW } from '../utils/color/manim_colors';
import { ManimColor, type ParsableManimColor } from '../utils/color/core';
import { KW, pyargs, type Kwargs } from '../utils/pyargs';
import { register, registry } from '../utils/registry';
import type { Point3D } from '../utils/vector';
import { Line } from './geometry/line';
import { Polygon } from './geometry/polygram';
import { BackgroundRectangle } from './geometry/shape_matchers';
import type { Mobject } from './mobject';
import { VGroup, VMobject } from './types/vectorized_mobject';

/** Mark a plain object as Python keyword arguments (for transpiled callees). */
const kw = (o: Kwargs): Kwargs => (Object.defineProperty(o, KW, { value: true, enumerable: false }), o);
const isClass = (f: unknown): boolean => typeof f === 'function' && /^class[\s{]/.test(Function.prototype.toString.call(f));
/** Python `f(*args, **kwargs)` for a class or a function. */
const pycall = (f: any, ...args: unknown[]): any => (isClass(f) ? new f(...args) : f(...args));

/** A table of mobjects (Paragraph entries by default) with optional labels and grid lines. */
export class Table extends VGroup {
  declare row_labels: VMobject[] | null;
  declare col_labels: VMobject[] | null;
  declare top_left_entry: VMobject | null;
  declare row_dim: number;
  declare col_dim: number;
  declare v_buff: number;
  declare h_buff: number;
  declare include_outer_lines: boolean;
  declare include_inner_lines: boolean;
  declare add_background_rectangles_to_entries: boolean;
  declare entries_background_color: ManimColor;
  declare include_background_rectangle: boolean;
  declare background_rectangle_color: ManimColor;
  declare element_to_mobject: any;
  declare element_to_mobject_config: Kwargs;
  declare arrange_in_grid_config: Kwargs;
  declare line_config: Kwargs;
  declare elements_without_labels: VGroup;
  declare elements: VGroup;
  declare mob_table: VMobject[][];
  declare horizontal_lines: VGroup;
  declare vertical_lines: VGroup;

  constructor(...args: unknown[]) {
    const o = pyargs(args, [
      'table', 'row_labels', 'col_labels', 'top_left_entry', 'v_buff', 'h_buff', 'include_outer_lines', 'include_inner_lines',
      'add_background_rectangles_to_entries', 'entries_background_color', 'include_background_rectangle', 'background_rectangle_color',
      'element_to_mobject', 'element_to_mobject_config', 'arrange_in_grid_config', 'line_config',
    ], {
      row_labels: null, col_labels: null, top_left_entry: null, v_buff: 0.8, h_buff: 1.3, include_outer_lines: false, include_inner_lines: true,
      add_background_rectangles_to_entries: false, entries_background_color: BLACK, include_background_rectangle: false, background_rectangle_color: BLACK,
      element_to_mobject: null, element_to_mobject_config: {}, arrange_in_grid_config: {}, line_config: {},
    });
    const {
      table, row_labels, col_labels, top_left_entry, v_buff, h_buff, include_outer_lines, include_inner_lines, add_background_rectangles_to_entries,
      entries_background_color, include_background_rectangle, background_rectangle_color, element_to_mobject, element_to_mobject_config,
      arrange_in_grid_config, line_config, ...kwargs
    } = o;
    const table_data: unknown[][] = Array.from(table as Iterable<unknown>, (row) => Array.from(row as Iterable<unknown>));
    const row_label_data: VMobject[] = row_labels !== null ? Array.from(row_labels as Iterable<VMobject>) : [];
    const col_label_data: VMobject[] = col_labels !== null ? Array.from(col_labels as Iterable<VMobject>) : [];
    for (const row of table_data) if (row.length !== table_data[0].length) throw new Error('ValueError: Not all rows in table have the same length.');
    super(kwargs);
    this.row_labels = row_label_data.length ? row_label_data : null;
    this.col_labels = col_label_data.length ? col_label_data : null;
    this.top_left_entry = top_left_entry;
    this.row_dim = table_data.length;
    this.col_dim = table_data[0].length;
    this.v_buff = v_buff;
    this.h_buff = h_buff;
    this.include_outer_lines = include_outer_lines;
    this.include_inner_lines = include_inner_lines;
    this.add_background_rectangles_to_entries = add_background_rectangles_to_entries;
    this.entries_background_color = new ManimColor(entries_background_color);
    this.include_background_rectangle = include_background_rectangle;
    this.background_rectangle_color = new ManimColor(background_rectangle_color);
    this.element_to_mobject = element_to_mobject ?? registry.Paragraph;
    this.element_to_mobject_config = element_to_mobject_config;
    this.arrange_in_grid_config = arrange_in_grid_config;
    this.line_config = line_config;
    let mob_table = this._table_to_mob_table(table_data);
    this.elements_without_labels = new VGroup(...mob_table.flat());
    mob_table = this._add_labels(mob_table);
    this._organize_mob_table(mob_table);
    this.elements = new VGroup(...mob_table.flat());
    if (this.elements.get(0).get_all_points().length === 0) this.elements.remove(this.elements.get(0));
    this.add(this.elements);
    this.center();
    this.mob_table = mob_table;
    this._add_horizontal_lines();
    this._add_vertical_lines();
    if (this.add_background_rectangles_to_entries) this.add_background_to_entries(this.entries_background_color);
    if (this.include_background_rectangle) this.add_background_rectangle({ color: this.background_rectangle_color });
  }
  protected _table_to_mob_table(table: unknown[][]): VMobject[][] {
    return table.map((row) => row.map((item) => pycall(this.element_to_mobject, item, kw({ ...this.element_to_mobject_config }))));
  }
  protected _organize_mob_table(table: VMobject[][]): VGroup {
    const help_table = new VGroup();
    for (const row of table) for (const mob of row) help_table.add(mob);
    help_table.arrange_in_grid({ rows: table.length, cols: table[0].length, buff: [this.h_buff, this.v_buff], ...this.arrange_in_grid_config });
    return help_table;
  }
  protected _add_labels(mob_table: VMobject[][]): VMobject[][] {
    if (this.row_labels !== null) for (let k = 0; k < this.row_labels.length; k++) mob_table[k] = [this.row_labels[k], ...mob_table[k]];
    if (this.col_labels !== null) {
      if (this.row_labels !== null) {
        if (this.top_left_entry !== null) mob_table.unshift([this.top_left_entry, ...this.col_labels]);
        else mob_table.unshift([new VMobject(), ...this.col_labels]);
      } else mob_table.unshift(this.col_labels);
    }
    return mob_table;
  }
  protected _add_horizontal_lines(): this {
    const anchor_left = this.get_left()[0] - 0.5 * this.h_buff;
    const anchor_right = this.get_right()[0] + 0.5 * this.h_buff;
    const line_group = new VGroup();
    const hline = (y: number) => {
      const line = new Line([anchor_left, y, 0], [anchor_right, y, 0], { ...this.line_config });
      line_group.add(line);
      this.add(line);
    };
    if (this.include_outer_lines) {
      hline(this.get_rows().get(0).get_top()[1] + 0.5 * this.v_buff);
      hline(this.get_rows().get(-1).get_bottom()[1] - 0.5 * this.v_buff);
    }
    if (this.include_inner_lines) {
      for (let k = 0; k < this.mob_table.length - 1; k++) {
        const r = this.get_rows();
        hline(r.get(k + 1).get_top()[1] + 0.5 * (r.get(k).get_bottom()[1] - r.get(k + 1).get_top()[1]));
      }
    }
    this.horizontal_lines = line_group;
    return this;
  }
  protected _add_vertical_lines(): this {
    const anchor_top = this.get_rows().get_top()[1] + 0.5 * this.v_buff;
    const anchor_bottom = this.get_rows().get_bottom()[1] - 0.5 * this.v_buff;
    const line_group = new VGroup();
    const vline = (x: number, y0: number, y1: number) => {
      const line = new Line([x, y0, 0], [x, y1, 0], { ...this.line_config });
      line_group.add(line);
      this.add(line);
    };
    if (this.include_outer_lines) {
      vline(this.get_columns().get(0).get_left()[0] - 0.5 * this.h_buff, anchor_top, anchor_bottom);
      vline(this.get_columns().get(-1).get_right()[0] + 0.5 * this.h_buff, anchor_top, anchor_bottom);
    }
    if (this.include_inner_lines) {
      for (let k = 0; k < this.mob_table[0].length - 1; k++) {
        const c = this.get_columns();
        vline(c.get(k + 1).get_left()[0] + 0.5 * (c.get(k).get_right()[0] - c.get(k + 1).get_left()[0]), anchor_bottom, anchor_top);
      }
    }
    this.vertical_lines = line_group;
    return this;
  }
  get_horizontal_lines(): VGroup {
    return this.horizontal_lines;
  }
  get_vertical_lines(): VGroup {
    return this.vertical_lines;
  }
  /** The columns (labels included), each a VGroup. */
  get_columns(): VGroup {
    return new VGroup(...this.mob_table[0].map((_, i) => new VGroup(...this.mob_table.map((row) => row[i]))));
  }
  /** The rows (labels included), each a VGroup. */
  get_rows(): VGroup {
    return new VGroup(...this.mob_table.map((row) => new VGroup(...row)));
  }
  /** Colours column i with colors[i]. */
  set_column_colors(...colors: ParsableManimColor[]): this {
    const columns = this.get_columns().submobjects;
    colors.slice(0, columns.length).forEach((c, i) => columns[i].set_color(c));
    return this;
  }
  /** Colours row i with colors[i]. */
  set_row_colors(...colors: ParsableManimColor[]): this {
    const rs = this.get_rows().submobjects;
    colors.slice(0, rs.length).forEach((c, i) => rs[i].set_color(c));
    return this;
  }
  /** All entries (labels included), or the entry at (row, col), 1-indexed. */
  get_entries(pos: number[] | null = null): any {
    if (pos !== null && pos !== undefined) {
      const p = Array.from(pos);
      const shift = this.row_labels !== null && this.col_labels !== null && this.top_left_entry === null ? 2 : 1;
      return this.elements.get(this.mob_table[0].length * (p[0] - 1) + p[1] - shift);
    }
    return this.elements;
  }
  /** All entries without labels, or the one at (row, col), 1-indexed. */
  get_entries_without_labels(pos: number[] | null = null): any {
    if (pos !== null && pos !== undefined) {
      const p = Array.from(pos);
      return this.elements_without_labels.get(this.col_dim * (p[0] - 1) + p[1] - 1);
    }
    return this.elements_without_labels;
  }
  get_row_labels(): VGroup {
    return this.row_labels !== null ? new VGroup(...this.row_labels) : new VGroup();
  }
  get_col_labels(): VGroup {
    return this.col_labels !== null ? new VGroup(...this.col_labels) : new VGroup();
  }
  /** The top-left entry, the column labels and the row labels. */
  get_labels(): VGroup {
    const label_group = new VGroup();
    if (this.top_left_entry !== null) label_group.add(this.top_left_entry);
    for (const label of [this.col_labels, this.row_labels]) if (label !== null) label_group.add(...label);
    return label_group;
  }
  add_background_to_entries(color: ParsableManimColor = BLACK): this {
    for (const mob of this.get_entries()) mob.add_background_rectangle({ color: new ManimColor(color) });
    return this;
  }
  /** A Polygon around the cell at (row, col), 1-indexed. */
  get_cell(...args: unknown[]): Polygon {
    const { pos, ...kwargs } = pyargs(args, ['pos'], { pos: [1, 1] });
    const p = Array.from(pos as Iterable<number>);
    const row = this.get_rows().get(p[0] - 1), col = this.get_columns().get(p[1] - 1);
    const edge_UL: Point3D = [col.get_left()[0] - this.h_buff / 2, row.get_top()[1] + this.v_buff / 2, 0];
    const edge_UR: Point3D = [col.get_right()[0] + this.h_buff / 2, row.get_top()[1] + this.v_buff / 2, 0];
    const edge_DL: Point3D = [col.get_left()[0] - this.h_buff / 2, row.get_bottom()[1] - this.v_buff / 2, 0];
    const edge_DR: Point3D = [col.get_right()[0] + this.h_buff / 2, row.get_bottom()[1] - this.v_buff / 2, 0];
    return new Polygon(edge_UL, edge_UR, edge_DR, edge_DL, kwargs);
  }
  /** A BackgroundRectangle covering the cell at (row, col). */
  get_highlighted_cell(...args: unknown[]): BackgroundRectangle {
    const { pos, color, ...kwargs } = pyargs(args, ['pos', 'color'], { pos: [1, 1], color: PURE_YELLOW });
    const cell = this.get_cell(pos);
    return new BackgroundRectangle(cell, { ...kwargs, color: new ManimColor(color) });
  }
  /** Highlights the cell at (row, col) with a BackgroundRectangle behind the table. */
  add_highlighted_cell(...args: unknown[]): this {
    const { pos, color, ...kwargs } = pyargs(args, ['pos', 'color'], { pos: [1, 1], color: PURE_YELLOW });
    const bg_cell = this.get_highlighted_cell(pos, { ...kwargs, color: new ManimColor(color) });
    this.add_to_back(bg_cell);
    const entry = this.get_entries(pos);
    entry.background_rectangle = bg_cell;
    return this;
  }
  /** Draws the lines, then the entries and labels (and highlighted cells). */
  create(...args: unknown[]): AnimationGroup {
    const o = pyargs(args, ['lag_ratio', 'line_animation', 'label_animation', 'element_animation', 'entry_animation'], {
      lag_ratio: 1, line_animation: Create, label_animation: Write, element_animation: Create, entry_animation: FadeIn,
    });
    const { lag_ratio, line_animation, label_animation, element_animation, entry_animation, ...kwargs } = o;
    const animations = [
      pycall(line_animation, new VGroup(this.vertical_lines, this.horizontal_lines), kw({ ...kwargs })),
      pycall(element_animation, this.elements_without_labels.set_z_index(2), kw({ ...kwargs })),
    ];
    if (this.get_labels().length) animations.push(pycall(label_animation, this.get_labels(), kw({ ...kwargs })));
    if (this.get_entries().length) {
      for (const entry of this.elements_without_labels) {
        if (entry.background_rectangle === undefined) continue;
        animations.push(pycall(entry_animation, entry.background_rectangle, kw({ ...kwargs })));
      }
    }
    return new AnimationGroup(...animations, { lag_ratio });
  }
  /** Scales the table and its cell spacing. */
  override scale(scale_factor: number, ...rest: unknown[]): this {
    const { scale_stroke, ...kwargs } = pyargs(rest, ['scale_stroke'], { scale_stroke: false });
    this.h_buff *= scale_factor;
    this.v_buff *= scale_factor;
    super.scale(scale_factor, { ...kwargs, scale_stroke });
    return this;
  }
}

/** A table of MathTex entries. */
export class MathTable extends Table {
  constructor(...args: unknown[]) {
    const { table, element_to_mobject, ...rest } = pyargs(args, ['table', 'element_to_mobject'], { element_to_mobject: null });
    super(table, { ...rest, element_to_mobject: element_to_mobject ?? registry.MathTex });
  }
}

/** A table whose entries are given mobjects. */
export class MobjectTable extends Table {
  constructor(...args: unknown[]) {
    const { table, element_to_mobject, ...rest } = pyargs(args, ['table', 'element_to_mobject'], { element_to_mobject: (m: Mobject) => m });
    super(table, { ...rest, element_to_mobject });
  }
}

/** A table of Integers. */
export class IntegerTable extends Table {
  constructor(...args: unknown[]) {
    const { table, element_to_mobject, ...rest } = pyargs(args, ['table', 'element_to_mobject'], { element_to_mobject: null });
    super(table, { ...rest, element_to_mobject: element_to_mobject ?? registry.Integer });
  }
}

/** A table of DecimalNumbers (one decimal place by default). */
export class DecimalTable extends Table {
  constructor(...args: unknown[]) {
    const { table, element_to_mobject, element_to_mobject_config, ...rest } = pyargs(args, ['table', 'element_to_mobject', 'element_to_mobject_config'], {
      element_to_mobject: null, element_to_mobject_config: { num_decimal_places: 1 },
    });
    super(table, { ...rest, element_to_mobject: element_to_mobject ?? registry.DecimalNumber, element_to_mobject_config });
  }
}

register({ Table, MathTable, MobjectTable, IntegerTable, DecimalTable });
