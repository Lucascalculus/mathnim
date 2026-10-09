// manim/mobject/text/text_mobject.py
//
// web: manim renders Text/MarkupText with Pango into an SVG file and loads it
// with SVGMobject. manim-web lays the text out itself (src/ext/text/pango.ts,
// fonts parsed with opentype.js) and builds the same glyph VMobjects directly,
// so Text and MarkupText extend VMobject here. Fonts must be loaded before a
// Text is created (`await load_fonts()` / `register_font(...)`; ScenePlayer.load
// does the former).
import { config } from '../../_config';
import { DEFAULT_FONT_SIZE, NORMAL, RIGHT, START_X, START_Y } from '../../constants';
import { color_gradient, ManimColor, type ParsableManimColor } from '../../utils/color/core';
import { BLACK, WHITE } from '../../utils/color/manim_colors';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { register } from '../../utils/registry';
import { list_fonts, OP_C, OP_L, OP_M, parse_style, parse_weight } from '../../ext/text/fonts';
import { markup2svg, text2svg, type TextSetting, type TextShape } from '../../ext/text/pango';
import { Dot } from '../geometry/arc';
import { VGroup, VMobject } from '../types/vectorized_mobject';

export { register_font } from '../../ext/text/fonts';

export const TEXT_MOB_SCALE_FACTOR = 0.05;
export const DEFAULT_LINE_SPACING_SCALE = 0.3;
export const TEXT2SVG_ADJUSTMENT_FACTOR = 4.8;

/** Drop the zero-radius Dots that stand for spaces (Paragraph / disable_ligatures). */
export function remove_invisible_chars(mobject: VMobject): VMobject {
  const without = new VGroup();
  if (mobject.get(0) instanceof VGroup) {
    for (const submob of mobject) without.add(new VGroup(...[...submob].filter((k: VMobject) => !(k instanceof Dot))));
  } else without.add(...[...mobject].filter((k: VMobject) => !(k instanceof Dot)));
  return without;
}

// ------------------------------------------------------------------ SVG-like construction helpers

/** VMobjectFromSVGPath.handle_commands (cubic mode): path commands -> points. */
function svg_path_points(cmds: readonly number[]): Float64Array {
  const pts: number[] = [];
  let lx = 0, ly = 0, mx = 0, my = 0;
  const cubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    pts.push(lx, ly, 0, x1, y1, 0, x2, y2, 0, x, y, 0);
    lx = x;
    ly = y;
  };
  const line = (x: number, y: number) => cubic((2 * lx + x) / 3, (2 * ly + y) / 3, (lx + 2 * x) / 3, (ly + 2 * y) / 3, x, y);
  for (let i = 0; i < cmds.length;) {
    const op = cmds[i++];
    if (op === OP_M) {
      lx = mx = cmds[i++];
      ly = my = cmds[i++];
    } else if (op === OP_L) {
      line(cmds[i], cmds[i + 1]);
      i += 2;
    } else if (op === OP_C) {
      cubic(cmds[i], cmds[i + 1], cmds[i + 2], cmds[i + 3], cmds[i + 4], cmds[i + 5]);
      i += 6;
    } else if (Math.hypot(lx - mx, ly - my) > 0.0001) line(mx, my);
  }
  return Float64Array.from(pts);
}

/** Text / MarkupText: append a straight segment closing every subpath. */
function close_subpaths(points: Float64Array, nppc: number): Float64Array {
  const n = points.length / 3;
  if (n === 0) return points;
  const out: number[] = [];
  let sx = points[0], sy = points[1], sz = points[2];
  const add_line_to = (ex: number, ey: number, ez: number) => {
    const k = out.length - 3;
    const [x, y, z] = [out[k], out[k + 1], out[k + 2]];
    if (nppc === 3) out.push(x, y, z, (x + ex) / 2, (y + ey) / 2, (z + ez) / 2, ex, ey, ez);
    else out.push(x, y, z, (2 * x + ex) / 3, (2 * y + ey) / 3, (2 * z + ez) / 3, (x + 2 * ex) / 3, (y + 2 * ey) / 3, (z + 2 * ez) / 3, ex, ey, ez);
  };
  for (let i = 0; i < n; i++) {
    const k = 3 * i;
    out.push(points[k], points[k + 1], points[k + 2]);
    if (i !== n - 1 && (i + 1) % nppc === 0 && (points[k] !== points[k + 3] || points[k + 1] !== points[k + 4] || points[k + 2] !== points[k + 5])) {
      add_line_to(sx, sy, sz);
      [sx, sy, sz] = [points[k + 3], points[k + 4], points[k + 5]];
    }
  }
  add_line_to(sx, sy, sz);
  return Float64Array.from(out);
}

/** SVGMobject.__init__ for the laid-out text: glyph mobjects, flip, style, move_into_position. */
function init_from_shapes(mob: VMobject, shapes: readonly TextShape[], o: Kwargs): void {
  for (const s of shapes) {
    const pts = svg_path_points(s.cmds);
    if (pts.length === 0) continue;
    // web: a plain VMobject stands in for VMobjectFromSVGPath (same points and style)
    const g = new VMobject({ fill_color: s.color, fill_opacity: s.alpha, stroke_width: 0 });
    g.points = pts;
    mob.add(g);
  }
  const has_points = mob.submobjects.length > 0;
  if (has_points) mob.flip(RIGHT);
  mob.set_style({ fill_color: o.fill_color ?? null, fill_opacity: o.fill_opacity ?? null, stroke_color: o.stroke_color ?? null, stroke_opacity: o.stroke_opacity ?? null, stroke_width: o.stroke_width ?? null });
  if (!has_points) return;
  if (o.should_center) mob.center();
  if (o.height != null) mob.height = o.height;
  if (o.width != null) mob.width = o.width;
}

/** Text's / MarkupText's post-processing: close subpaths, then scale to manim units. */
function finish_text(mob: Text | MarkupText, height: unknown, width: unknown): void {
  const nppc = mob.n_points_per_curve;
  for (const each of mob) {
    if (each.points.length === 0) continue;
    each.points = close_subpaths(each.points, nppc);
  }
  if (height == null && width == null && mob.submobjects.length) mob.scale(TEXT_MOB_SCALE_FACTOR);
  mob.initial_height = mob.submobjects.length ? mob.height : 0;
}

/** `VMobject().color`: the default VMobject colour (respects VMobject.set_default). */
function default_vmobject_color(): ManimColor {
  const d = (VMobject as any)._defaults?.color ?? WHITE;
  return ManimColor.parse(d);
}
const truthy = (x: unknown) => x !== null && x !== undefined && x !== '' && x !== false && x !== 0;
const isspace = (c: string) => /^\s$/u.test(c);
const SVG_KEYS = ['fill_color', 'stroke_color', 'stroke_opacity', 'opacity', 'svg_default', 'path_string_config', 'file_name'];

/** Pango's handling of font names Text checks against the font list. */
function check_font(font: string, warn: boolean): string {
  if (font && warn) {
    if (font.toLowerCase() === 'sans-serif') font = 'sans';
    // web: resolution is case-insensitive and warns (once) when a family is not loaded
  }
  return font;
}

// ------------------------------------------------------------------ Paragraph

/** Several lines of text, each a VGroup of characters; `alignment` is 'left' | 'center' | 'right'. */
export class Paragraph extends VGroup {
  declare line_spacing: number;
  declare alignment: string | null;
  declare consider_spaces_as_chars: boolean;
  declare lines_text: Text;
  declare chars: VGroup;
  declare lines_chars: VGroup[];
  declare lines_alignments: (string | null)[];
  declare lines_initial_positions: [number, number, number][];

  constructor(...args: unknown[]) {
    const [text, kw] = starArgs<string>(args);
    const { line_spacing = -1, alignment = null, ...kwargs } = kw;
    super();
    this.line_spacing = line_spacing;
    this.alignment = alignment;
    this.consider_spaces_as_chars = kwargs.disable_ligatures ?? false;
    const lines_str = text.join('\n');
    this.lines_text = new Text(lines_str, { line_spacing, ...kwargs });
    const lines_str_list = lines_str.split('\n');
    this.chars = this._gen_chars(lines_str_list);
    this.lines_chars = [...this.chars] as VGroup[];
    this.lines_alignments = this.lines_chars.map(() => this.alignment);
    this.lines_initial_positions = this.lines_chars.map((line) => line.get_center());
    this.add(...this.lines_chars);
    this.move_to([0, 0, 0]);
    if (this.alignment) this._set_all_lines_alignments(this.alignment);
  }
  protected _gen_chars(lines_str_list: string[]): VGroup {
    let char_index_counter = 0;
    const G = this.get_group_class();
    const chars = new G() as VGroup;
    for (let line_no = 0; line_no < lines_str_list.length; line_no++) {
      const line_str = [...lines_str_list[line_no]];
      const char_count = this.consider_spaces_as_chars ? line_str.length : line_str.filter((c) => !isspace(c)).length;
      chars.add(new G());
      chars.get(line_no).add(...this.lines_text.chars.get_slice(char_index_counter, char_index_counter + char_count).submobjects);
      char_index_counter += char_count;
      if (this.consider_spaces_as_chars) char_index_counter += 1;
    }
    return chars;
  }
  protected _set_all_lines_alignments(alignment: string): this {
    for (let line_no = 0; line_no < this.lines_chars.length; line_no++) this._change_alignment_for_a_line(alignment, line_no);
    return this;
  }
  protected _set_line_alignment(alignment: string, line_no: number): this {
    this._change_alignment_for_a_line(alignment, line_no);
    return this;
  }
  protected _set_all_lines_to_initial_positions(): this {
    this.lines_alignments = this.lines_chars.map(() => null);
    for (let line_no = 0; line_no < this.lines_chars.length; line_no++) {
      const c = this.get_center(), p = this.lines_initial_positions[line_no];
      this.get(line_no).move_to([c[0] + p[0], c[1] + p[1], c[2] + p[2]]);
    }
    return this;
  }
  protected _set_line_to_initial_position(line_no: number): this {
    this.lines_alignments[line_no] = null;
    const c = this.get_center(), p = this.lines_initial_positions[line_no];
    this.get(line_no).move_to([c[0] + p[0], c[1] + p[1], c[2] + p[2]]);
    return this;
  }
  protected _change_alignment_for_a_line(alignment: string, line_no: number): void {
    this.lines_alignments[line_no] = alignment;
    const line = this.get(line_no);
    if (alignment === 'center') line.move_to([this.get_center()[0], line.get_center()[1], 0]);
    else if (alignment === 'right') line.move_to([this.get_right()[0] - line.width / 2, line.get_center()[1], 0]);
    else if (alignment === 'left') line.move_to([this.get_left()[0] + line.width / 2, line.get_center()[1], 0]);
  }
}

// ------------------------------------------------------------------ Text

const TEXT_ARGS = ['text', 'fill_opacity', 'stroke_width', 'color', 'font_size', 'line_spacing', 'font', 'slant', 'weight', 't2c', 't2f', 't2g', 't2s', 't2w', 'gradient', 'tab_width', 'warn_missing_font', 'height', 'width', 'should_center', 'disable_ligatures', 'use_svg_cache'];
const TEXT_DEFAULTS = {
  fill_opacity: 1.0, stroke_width: 0, color: null, font_size: DEFAULT_FONT_SIZE, line_spacing: -1, font: '', slant: NORMAL, weight: NORMAL,
  t2c: null, t2f: null, t2g: null, t2s: null, t2w: null, gradient: null, tab_width: 4, warn_missing_font: true, height: null, width: null,
  should_center: true, disable_ligatures: false, use_svg_cache: false,
};

/** One styled range of a Text (manimpango.TextSetting). */
class Setting implements TextSetting {
  constructor(public start: number, public end: number, public font: string, public slant: string, public weight: string, public line_num = -1, public color: string | null = null) {}
  copy(): Setting {
    return new Setting(this.start, this.end, this.font, this.slant, this.weight, this.line_num, this.color);
  }
}
type SettingArgs = { font: string; slant: string; weight: string; color: string | null };
const mk = (start: number, end: number, a: SettingArgs) => new Setting(start, end, a.font, a.slant, a.weight, -1, a.color);

/**
 * A single-style (or t2c/t2f/t2g/t2s/t2w styled) text, one VMobject per
 * visible glyph. web: laid out by manim-web's Pango emulation (see file header).
 */
export class Text extends VMobject {
  declare text: string;
  declare original_text: string;
  declare line_spacing: number;
  declare font: string;
  declare _font_size: number;
  declare slant: string;
  declare weight: string;
  declare gradient: ParsableManimColor[] | null;
  declare tab_width: number;
  declare t2c: Record<string, string>;
  declare t2f: Record<string, string>;
  declare t2g: Record<string, ParsableManimColor[]>;
  declare t2s: Record<string, string>;
  declare t2w: Record<string, string>;
  declare disable_ligatures: boolean;
  declare chars: VGroup;
  declare initial_height: number;
  declare should_center: boolean;
  declare svg_height: number | null;
  declare svg_width: number | null;

  /** Registered font families (manim: manimpango.list_fonts()). */
  static font_list(): string[] {
    return list_fonts();
  }

  constructor(...args: unknown[]) {
    const o = pyargs(args, TEXT_ARGS, TEXT_DEFAULTS);
    const vm: Kwargs = {};
    for (const [k, v] of Object.entries(o)) if (!TEXT_ARGS.includes(k) && !SVG_KEYS.includes(k) && !k.startsWith('text2')) vm[k] = v;
    super({ ...vm, color: BLACK }); // SVGMobject: VMobject(color=None) -> black parent
    let text: string = String(o.text);
    this.line_spacing = o.line_spacing;
    this.font = check_font(o.font ?? '', o.warn_missing_font);
    this._font_size = Number(o.font_size);
    this.slant = o.slant;
    this.weight = o.weight;
    this.gradient = o.gradient;
    this.tab_width = o.tab_width;
    const t2c = o.text2color ?? o.t2c ?? {};
    this.t2c = Object.fromEntries(Object.entries(t2c).map(([k, v]) => [k, ManimColor.parse(v as ParsableManimColor).to_hex()]));
    this.t2f = o.text2font ?? o.t2f ?? {};
    this.t2g = o.text2gradient ?? o.t2g ?? {};
    this.t2s = o.text2slant ?? o.t2s ?? {};
    this.t2w = o.text2weight ?? o.t2w ?? {};
    this.original_text = text;
    this.disable_ligatures = o.disable_ligatures;
    let text_without_tabs = text;
    if (text.includes('\t')) text_without_tabs = text.replace(/\t/g, ' '.repeat(this.tab_width));
    this.text = text_without_tabs;
    if (this.line_spacing === -1) this.line_spacing = this._font_size + this._font_size * DEFAULT_LINE_SPACING_SCALE;
    else this.line_spacing = this._font_size + this._font_size * this.line_spacing;
    const parsed_color = truthy(o.color) ? ManimColor.parse(o.color) : default_vmobject_color();
    const shapes = this._text2svg(parsed_color.to_hex());
    this.should_center = o.should_center;
    this.svg_height = o.height;
    this.svg_width = o.width;
    init_from_shapes(this, shapes, o);
    this.text = text;
    if (this.disable_ligatures) this.submobjects = [...this._gen_chars().submobjects];
    this.chars = new (this.get_group_class())(...this.submobjects);
    this.text = text_without_tabs.replace(/ /g, '').replace(/\n/g, '');
    finish_text(this, o.height, o.width);
  }

  override toString(): string {
    return `Text(${JSON.stringify(this.original_text)})`;
  }

  get font_size(): number {
    return (((this.height / this.initial_height / TEXT_MOB_SCALE_FACTOR) * 2.4 * this._font_size) / DEFAULT_FONT_SIZE);
  }
  set font_size(font_val: number) {
    if (font_val <= 0) throw new Error('font_size must be greater than 0.');
    this.scale(font_val / this.font_size);
  }

  protected _gen_chars(): VGroup {
    const chars = new (this.get_group_class())() as VGroup;
    let k = 0;
    const text = [...this.text];
    for (let char_index = 0; char_index < text.length; char_index++) {
      if (isspace(text[char_index])) {
        const space = new Dot({ radius: 0, fill_opacity: 0, stroke_opacity: 0 });
        if (char_index === 0) space.move_to(this.submobjects[k].get_center());
        else space.move_to(this.submobjects[k - 1].get_center());
        chars.add(space);
      } else {
        if (k >= this.submobjects.length) {
          throw new Error(`Text ${JSON.stringify(this.original_text)} rendered fewer glyph(s) than its non-space characters even with disable_ligatures=True. This usually means the chosen font implements some of its ligatures through an OpenType feature that isn't disabled (e.g. 'calt', used for programming ligatures like '<=' or '->' by fonts such as Fira Code), so characters and glyphs no longer correspond one-to-one. Try a different font to work around this.`);
        }
        chars.add(this.submobjects[k]);
        k++;
      }
    }
    return chars;
  }

  protected _find_indexes(word: string, text: string): [number, number][] {
    const m = /^\[([0-9-]*):([0-9-]*)\]/.exec(word);
    if (m) {
      let start = m[1] !== '' ? parseInt(m[1], 10) : 0;
      let end = m[2] !== '' ? parseInt(m[2], 10) : text.length;
      start = start < 0 ? text.length + start : start;
      end = end < 0 ? text.length + end : end;
      return [[start, end]];
    }
    const out: [number, number][] = [];
    if (!word) return out;
    let index = text.indexOf(word);
    while (index !== -1) {
      out.push([index, index + word.length]);
      index = text.indexOf(word, index + word.length);
    }
    return out;
  }

  protected _merge_settings(left: Setting, right: Setting, default_args: SettingArgs): Setting {
    const contained = right.end < left.end;
    const new_setting = contained ? left.copy() : right.copy();
    new_setting.start = contained ? right.end : left.end;
    left.end = right.start;
    if (!contained) right.end = new_setting.start;
    for (const arg of Object.keys(default_args) as (keyof SettingArgs)[]) {
      const l = left[arg], r = right[arg], d = default_args[arg];
      if (l !== d && r !== d) throw new Error(`Ambiguous style for text '${this.text.slice(right.start, right.end)}':'${arg}' cannot be both '${l}' and '${r}'.`);
      (right as any)[arg] = l !== d ? l : r;
    }
    return new_setting;
  }

  protected _get_settings_from_t2xs(t2xs: [Record<string, unknown>, keyof SettingArgs][], default_args: SettingArgs): Setting[] {
    const settings: Setting[] = [];
    const words: string[] = [];
    for (const [t2x] of t2xs) for (const k of Object.keys(t2x)) if (!words.includes(k)) words.push(k);
    for (const word of words) {
      const a = { ...default_args };
      for (const [t2x, arg] of t2xs) if (word in t2x) (a as any)[arg] = String(t2x[word]);
      for (const [start, end] of this._find_indexes(word, this.text)) settings.push(mk(start, end, a));
    }
    return settings;
  }

  protected _get_settings_from_gradient(default_args: SettingArgs): Setting[] {
    const settings: Setting[] = [];
    const args = { ...default_args };
    if (this.gradient) {
      const colors = color_gradient(this.gradient, this.text.length);
      for (let i = 0; i < this.text.length; i++) settings.push(mk(i, i + 1, { ...args, color: colors[i].to_hex() }));
    }
    for (const [word, gradient] of Object.entries(this.t2g)) {
      const colors = color_gradient(gradient, word.length);
      for (const [start, end] of this._find_indexes(word, this.text)) {
        for (let i = start; i < end; i++) settings.push(mk(i, i + 1, { ...args, color: colors[i - start].to_hex() }));
      }
    }
    return settings;
  }

  protected _text2settings(color: string): Setting[] {
    const t2xs: [Record<string, unknown>, keyof SettingArgs][] = [[this.t2f, 'font'], [this.t2s, 'slant'], [this.t2w, 'weight'], [this.t2c, 'color']];
    const default_args: SettingArgs = { font: this.font, slant: this.slant, weight: this.weight, color };
    let settings = this._get_settings_from_t2xs(t2xs, default_args);
    settings.push(...this._get_settings_from_gradient(default_args));
    settings.sort((a, b) => a.start - b.start);
    for (let index = 0; index < settings.length; index++) {
      if (index + 1 === settings.length) break;
      const setting = settings[index], next = settings[index + 1];
      if (setting.end > next.start) {
        const new_setting = this._merge_settings(setting, next, default_args);
        let new_index = index + 1;
        while (new_index < settings.length && settings[new_index].start < new_setting.start) new_index++;
        settings.splice(new_index, 0, new_setting);
      }
    }
    const temp = settings.slice();
    let start = 0;
    for (const s of settings) {
      if (s.start !== start) temp.push(mk(start, s.start, default_args));
      start = s.end;
    }
    if (start !== this.text.length) temp.push(mk(start, this.text.length, default_args));
    settings = temp.sort((a, b) => a.start - b.start);
    let line_num = 0;
    if (this.text.includes('\n')) {
      for (const [for_start, for_end] of this._find_indexes('\n', this.text)) {
        for (const s of settings) {
          if (s.line_num === -1) s.line_num = line_num;
          if (for_start < s.end) {
            line_num += 1;
            const ns = s.copy();
            s.end = for_end;
            ns.start = for_end;
            ns.line_num = line_num;
            settings.push(ns);
            settings.sort((a, b) => a.start - b.start);
            break;
          }
        }
      }
    }
    for (const s of settings) if (s.line_num === -1) s.line_num = line_num;
    return settings;
  }

  /** web: returns the laid-out shapes instead of writing an SVG file. */
  protected _text2svg(color: string): TextShape[] {
    const size = this._font_size / TEXT2SVG_ADJUSTMENT_FACTOR;
    const line_spacing = this.line_spacing / TEXT2SVG_ADJUSTMENT_FACTOR;
    const settings = this._text2settings(color);
    return text2svg(settings, size, line_spacing, this.disable_ligatures, START_X, START_Y, config.pixel_width, this.text, parse_weight, parse_style);
  }
}

// ------------------------------------------------------------------ MarkupText

const MARKUP_ARGS = ['text', 'fill_opacity', 'stroke_width', 'color', 'font_size', 'line_spacing', 'font', 'slant', 'weight', 'justify', 'gradient', 'tab_width', 'height', 'width', 'should_center', 'disable_ligatures', 'warn_missing_font'];
const MARKUP_DEFAULTS = {
  fill_opacity: 1, stroke_width: 0, color: null, font_size: DEFAULT_FONT_SIZE, line_spacing: -1, font: '', slant: NORMAL, weight: NORMAL,
  justify: false, gradient: null, tab_width: 4, height: null, width: null, should_center: true, disable_ligatures: false, warn_missing_font: true,
};

type TagRange = { start: number; end: number; start_offset: number; end_offset: number };

/** Text with Pango markup (<b>, <i>, <span foreground=...>, <gradient from to>, ...). */
export class MarkupText extends VMobject {
  declare text: string;
  declare original_text: string;
  declare line_spacing: number;
  declare font: string;
  declare _font_size: number;
  declare slant: string;
  declare weight: string;
  declare gradient: ParsableManimColor[] | null;
  declare tab_width: number;
  declare justify: boolean;
  declare disable_ligatures: boolean;
  declare chars: VGroup;
  declare initial_height: number;
  declare should_center: boolean;
  declare svg_height: number | null;
  declare svg_width: number | null;

  /** Registered font families (manim: manimpango.list_fonts()). */
  static font_list(): string[] {
    return list_fonts();
  }

  constructor(...args: unknown[]) {
    const o = pyargs(args, MARKUP_ARGS, MARKUP_DEFAULTS);
    const vm: Kwargs = {};
    for (const [k, v] of Object.entries(o)) if (!MARKUP_ARGS.includes(k) && !SVG_KEYS.includes(k)) vm[k] = v;
    super({ ...vm, color: BLACK });
    const text: string = String(o.text);
    this.text = text;
    this.line_spacing = o.line_spacing;
    this.font = check_font(o.font ?? '', o.warn_missing_font);
    this._font_size = Number(o.font_size);
    this.slant = o.slant;
    this.weight = o.weight;
    this.gradient = o.gradient;
    this.tab_width = o.tab_width;
    this.justify = o.justify;
    this.original_text = text;
    this.disable_ligatures = o.disable_ligatures;
    let text_without_tabs = text;
    if (text.includes('\t')) text_without_tabs = text.replace(/\t/g, ' '.repeat(this.tab_width));
    const colormap = this._extract_color_tags();
    if (colormap.length > 0) console.warn('Using <color> tags in MarkupText is deprecated. Please use <span foreground="..."> instead.');
    const gradientmap = this._extract_gradient_tags();
    if (this.line_spacing === -1) this.line_spacing = this._font_size + this._font_size * DEFAULT_LINE_SPACING_SCALE;
    else this.line_spacing = this._font_size + this._font_size * this.line_spacing;
    const parsed_color = truthy(o.color) ? ManimColor.parse(o.color) : default_vmobject_color();
    const shapes = this._text2svg(parsed_color);
    this.should_center = o.should_center;
    this.svg_height = o.height;
    this.svg_width = o.width;
    init_from_shapes(this, shapes, o);
    this.chars = new (this.get_group_class())(...this.submobjects);
    this.text = text_without_tabs.replace(/ /g, '').replace(/\n/g, '');
    const nppc = this.n_points_per_curve;
    for (const each of this) if (each.points.length) each.points = close_subpaths(each.points, nppc);
    if (this.gradient) this.set_color_by_gradient(...this.gradient);
    for (const col of colormap) {
      this.chars.get_slice(col.start - col.start_offset, col.end - col.start_offset - col.end_offset).set_color(this._parse_color(col.color));
    }
    for (const grad of gradientmap) {
      this.chars.get_slice(grad.start - grad.start_offset, grad.end - grad.start_offset - grad.end_offset).set_color_by_gradient(this._parse_color(grad.from), this._parse_color(grad.to));
    }
    if (o.height == null && o.width == null && this.submobjects.length) this.scale(TEXT_MOB_SCALE_FACTOR);
    this.initial_height = this.submobjects.length ? this.height : 0;
  }

  get font_size(): number {
    return (((this.height / this.initial_height / TEXT_MOB_SCALE_FACTOR) * 2.4 * this._font_size) / DEFAULT_FONT_SIZE);
  }
  set font_size(font_val: number) {
    if (font_val <= 0) throw new Error('font_size must be greater than 0.');
    this.scale(font_val / this.font_size);
  }

  /** web: returns the laid-out shapes instead of writing an SVG file. */
  protected _text2svg(color: ManimColor): TextShape[] {
    const size = this._font_size / TEXT2SVG_ADJUSTMENT_FACTOR;
    const final_text = `<span foreground="${color.to_hex()}">${this.text}</span>`;
    return markup2svg(final_text, { family: this.font, weight: parse_weight(this.weight), style: parse_style(this.slant), size }, this.disable_ligatures, START_X, START_Y, 500, this.justify);
  }

  protected _count_real_chars(s: string): number {
    let count = 0, level = 0;
    s = s.replace(/&[^;]+;/g, 'x');
    for (const c of s) {
      if (c === '<') level += 1;
      if (c === '>' && level > 0) level -= 1;
      else if (c !== ' ' && c !== '\t' && level === 0) count += 1;
    }
    return count;
  }

  protected _extract_gradient_tags(): (TagRange & { from: string; to: string })[] {
    const out: (TagRange & { from: string; to: string })[] = [];
    for (const tag of this.original_text.matchAll(/<gradient\s+from="([^"]+)"\s+to="([^"]+)"(\s+offset="([^"]+)")?>([\s\S]+?)<\/gradient>/g)) {
      const start = this._count_real_chars(this.original_text.slice(0, tag.index));
      const end = start + this._count_real_chars(tag[5]);
      const offsets = tag[4] ? tag[4].split(',') : ['0'];
      out.push({
        start, end, from: tag[1], to: tag[2],
        start_offset: offsets[0] ? parseInt(offsets[0], 10) : 0,
        end_offset: offsets.length === 2 && offsets[1] ? parseInt(offsets[1], 10) : 0,
      });
    }
    this.text = this.text.replace(/<gradient[^>]+>([\s\S]+?)<\/gradient>/g, '$1');
    return out;
  }

  protected _parse_color(col: string): string {
    if (/^#[0-9a-f]{6}/.test(col)) return col;
    return ManimColor.parse(col as ParsableManimColor).to_hex();
  }

  protected _extract_color_tags(): (TagRange & { color: string })[] {
    const out: (TagRange & { color: string })[] = [];
    for (const tag of this.original_text.matchAll(/<color\s+col="([^"]+)"(\s+offset="([^"]+)")?>([\s\S]+?)<\/color>/g)) {
      const start = this._count_real_chars(this.original_text.slice(0, tag.index));
      const end = start + this._count_real_chars(tag[4]);
      const offsets = tag[3] ? tag[3].split(',') : ['0'];
      out.push({
        start, end, color: tag[1],
        start_offset: offsets[0] ? parseInt(offsets[0], 10) : 0,
        end_offset: offsets.length === 2 && offsets[1] ? parseInt(offsets[1], 10) : 0,
      });
    }
    this.text = this.text.replace(/<color[^>]+>([\s\S]+?)<\/color>/g, '$1');
    return out;
  }

  override toString(): string {
    return `MarkupText(${JSON.stringify(this.original_text)})`;
  }
}

register({ Text, MarkupText, Paragraph });
