// manim/mobject/text/tex_mobject.py
//
// web: TeX is typeset by MathJax (utils/tex/mathjax.ts) into an SVG with
// dvisvgm's conventions, so sizes (font_size), part grouping (the
// \special{dvisvgm:raw <g id=...>} markers) and colouring work like manim's.
// In a browser, `await init_tex()` (ScenePlayer.load does it) before creating
// TeX mobjects.
import { config } from '../../_config';
import { DEFAULT_FONT_SIZE, DOWN, LEFT, MED_LARGE_BUFF, MED_SMALL_BUFF, RIGHT, SCALE_FACTOR_PER_FONT_POINT, SMALL_BUFF, UP } from '../../constants';
import type { ParsableManimColor } from '../../utils/color/core';
import { BLACK, WHITE } from '../../utils/color/manim_colors';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { default_tex_template, TexTemplate } from '../../utils/tex';
import { tex_to_svg } from '../../utils/tex/mathjax';
import { SVGMobject } from '../svg/svg_mobject';
import { VGroup, VMobject } from '../types/vectorized_mobject';

export const MATHTEX_SUBSTRING = 'substring';

const template_of = (t: TexTemplate | null | undefined): TexTemplate => t ?? (config as any).tex_template ?? default_tex_template();

function _remove_stray_braces(tex: string): string {
  const count = (s: string) => tex.split(s).length - 1;
  let num_lefts = count('{') - count('\\{') + count('\\\\{');
  let num_rights = count('}') - count('\\}') + count('\\\\}');
  while (num_rights > num_lefts) {
    tex = '{' + tex;
    num_lefts += 1;
  }
  while (num_lefts > num_rights) {
    tex = tex + '}';
    num_rights += 1;
  }
  return tex;
}
function _modify_special_strings(tex: string): string {
  tex = tex.trim();
  const should_add_filler = tex === '\\over' || tex === '\\overline' || tex === '\\sqrt' || tex === '\\sqrt{' || tex.endsWith('_') || tex.endsWith('^') || tex.endsWith('dot');
  if (should_add_filler) tex += '{\\quad}';
  if (tex === '\\substack') tex = '\\quad';
  if (tex === '') tex = '\\quad';
  if (tex.startsWith('\\\\')) tex = tex.replaceAll('\\\\', '\\quad\\\\');
  const [num_lefts, num_rights] = ['\\left', '\\right'].map((substr) => tex.split(substr).slice(1).filter((s) => s && '(){}[]|.\\'.includes(s[0])).length);
  if (num_lefts !== num_rights) {
    tex = tex.replaceAll('\\left', '\\big');
    tex = tex.replaceAll('\\right', '\\big');
  }
  tex = _remove_stray_braces(tex);
  for (const context of ['array']) {
    const begin_in = tex.includes(`\\begin{${context}}`);
    const end_in = tex.includes(`\\end{${context}}`);
    if (begin_in !== end_in) tex = '';
  }
  return tex;
}
const _get_modified_expression = (tex_string: string) => _modify_special_strings(tex_string.trim());

/** Elementary building block for rendering text with LaTeX (MathJax in manim-web). */
export class SingleStringMathTex extends SVGMobject {
  declare _font_size: number;
  declare organize_left_to_right: boolean;
  declare tex_environment: string | null;
  declare tex_template: TexTemplate;
  declare tex_string: string;
  declare initial_height: number;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['tex_string', 'stroke_width', 'should_center', 'height', 'organize_left_to_right', 'tex_environment', 'tex_template', 'font_size', 'color'], {
      stroke_width: 0, should_center: true, height: null, organize_left_to_right: false, tex_environment: 'align*', tex_template: null,
      font_size: DEFAULT_FONT_SIZE, color: null,
    });
    const { tex_string, stroke_width, should_center, height, organize_left_to_right, tex_environment, font_size, ...kwargs } = o;
    let { color, tex_template } = o;
    delete kwargs.color;
    delete kwargs.tex_template;
    if (color === null || color === undefined) color = (VMobject as any)._defaults?.color ?? WHITE;
    tex_template = template_of(tex_template);
    const svg_string = tex_to_svg(_get_modified_expression(String(tex_string)), tex_environment, tex_template.body);
    super({
      ...kwargs, svg_string, should_center, stroke_width, height, color,
      path_string_config: { should_subdivide_sharp_curves: true, should_remove_null_curves: true },
    });
    this._font_size = font_size;
    this.organize_left_to_right = organize_left_to_right;
    this.tex_environment = tex_environment;
    this.tex_template = tex_template;
    this.tex_string = tex_string;
    this.init_colors();
    this.initial_height = this.height;
    if (height === null || height === undefined) this.font_size = this._font_size;
    if (this.organize_left_to_right) this._organize_submobjects_left_to_right();
  }
  override toString(): string {
    return `${this.constructor.name}(${JSON.stringify(this.tex_string)})`;
  }
  /** The font size (manim's font_size property; 48 by default). */
  get font_size(): number {
    return this.height / this.initial_height / SCALE_FACTOR_PER_FONT_POINT;
  }
  set font_size(font_val: number) {
    if (font_val <= 0) throw new Error('font_size must be greater than 0.');
    else if (this.height > 0) this.scale(font_val / this.font_size);
  }
  _get_modified_expression(tex_string: string): string {
    return _get_modified_expression(tex_string);
  }
  _modify_special_strings(tex: string): string {
    return _modify_special_strings(tex);
  }
  _remove_stray_braces(tex: string): string {
    return _remove_stray_braces(tex);
  }
  _organize_submobjects_left_to_right(): this {
    this.sort((p) => p[0]);
    return this;
  }
  get_tex_string(): string {
    return this.tex_string;
  }
  override init_colors(propagate_colors = true): this {
    if (!this.submobjects) return this;
    for (const submobject of this.submobjects) {
      if (!submobject.color.equals(BLACK)) continue;
      submobject.color = this.color;
      submobject.init_colors(propagate_colors);
    }
    return this;
  }
}

/** A string compiled with LaTeX in math mode (split into parts at the given strings). */
export class MathTex extends SingleStringMathTex {
  declare arg_separator: string;
  declare substrings_to_isolate: string[];
  declare tex_to_color_map: Record<string, ParsableManimColor>;
  declare brace_notation_split_occurred: boolean;
  declare tex_strings: string[];
  declare matched_strings_and_ids: [string, string][];

  constructor(...args: unknown[]) {
    const [strings, kw] = starArgs<unknown>(args);
    const { arg_separator = ' ', substrings_to_isolate = null, tex_to_color_map = null, tex_environment = 'align*', tex_template = null, ...kwargs } = kw;
    const template = template_of(tex_template);
    const isolate: string[] = substrings_to_isolate === null ? [] : Array.from(substrings_to_isolate as Iterable<string>);
    const color_map: Record<string, ParsableManimColor> = tex_to_color_map === null ? {} : tex_to_color_map instanceof Map ? Object.fromEntries(tex_to_color_map) : tex_to_color_map;
    isolate.push(...Object.keys(color_map));
    const [tex_strings, split_occurred] = MathTex._prepare(strings);
    const matched: [string, string][] = [];
    const joined = MathTex._join(tex_strings, isolate, arg_separator, matched);
    try {
      super(joined, { ...kwargs, tex_environment, tex_template: template });
    } catch (compilation_error) {
      if (split_occurred) {
        console.error(
          'A group of double braces, {{ ... }}, was detected in your string. Manim splits TeX strings at the double braces, which might have caused the current compilation error. If you didn\'t use the double brace split intentionally, add spaces between the braces to avoid the automatic splitting: {{ ... }} --> { { ... } }.',
        );
      }
      throw compilation_error;
    }
    this.tex_template = template;
    this.arg_separator = arg_separator;
    this.substrings_to_isolate = isolate;
    this.tex_to_color_map = color_map;
    this.tex_environment = tex_environment;
    this.brace_notation_split_occurred = split_occurred;
    this.tex_strings = tex_strings;
    this.matched_strings_and_ids = matched;
    this.tex_string = tex_strings.join(this.arg_separator);
    this._break_up_by_substrings();
    this.set_color_by_tex_to_color_map(this.tex_to_color_map);
    if (this.organize_left_to_right) this._organize_submobjects_left_to_right();
  }

  private static _prepare(tex_strings: unknown[]): [string[], boolean] {
    const validated = tex_strings.map((s) => (typeof s === 'string' ? s : String(s)));
    const two: string[] = [];
    for (const s of validated) two.push(...MathTex._split_double_braces(s));
    return [two.filter((s) => s.length > 0), two.length > validated.length];
  }
  _prepare_tex_strings(tex_strings: unknown[]): string[] {
    const [out, split] = MathTex._prepare(tex_strings);
    if (split) this.brace_notation_split_occurred = true;
    return out;
  }
  /** Split `{{ ... }}` groups (preceded by the string start or whitespace) into separate parts. */
  static _split_double_braces(tex_string: string): string[] {
    const segments: string[] = [];
    let current = '';
    let i = 0;
    let inside_manim = false;
    let inner_depth = 0;
    const n = tex_string.length;
    while (i < n) {
      if (tex_string[i] === '\\' && i + 1 < n) {
        const next_ch = tex_string[i + 1];
        if (next_ch === '\\' || '{}'.includes(next_ch)) {
          current += tex_string.slice(i, i + 2);
          i += 2;
          continue;
        }
      }
      if (!inside_manim) {
        if (tex_string.slice(i, i + 2) === '{{' && (i === 0 || /\s/.test(tex_string[i - 1]))) {
          segments.push(current);
          current = '';
          inside_manim = true;
          inner_depth = 0;
          i += 2;
        } else {
          current += tex_string[i];
          i += 1;
        }
      } else if (tex_string[i] === '{') {
        inner_depth += 1;
        current += tex_string[i];
        i += 1;
      } else if (tex_string[i] === '}' && inner_depth === 0 && tex_string.slice(i, i + 2) === '}}') {
        segments.push(current);
        current = '';
        inside_manim = false;
        i += 2;
      } else if (tex_string[i] === '}') {
        inner_depth -= 1;
        current += tex_string[i];
        i += 1;
      } else {
        current += tex_string[i];
        i += 1;
      }
    }
    segments.push(current);
    return segments;
  }
  private static _join(tex_strings: string[], substrings_to_isolate: string[], arg_separator: string, matched: [string, string][]): string {
    let joined_string = '';
    let ssIdx = 0;
    const pad = (k: number) => String(k).padStart(3, '0');
    tex_strings.forEach((tex_string, idx) => {
      let string_part = `\\special{dvisvgm:raw <g id='unique${pad(idx)}'>}`;
      matched.push([tex_string, `unique${pad(idx)}`]);
      let unprocessed_string = String(tex_string);
      let processed_string = '';
      while (unprocessed_string.length > 0) {
        const first_match = MathTex._locate_first_match_static(substrings_to_isolate, unprocessed_string);
        if (first_match) {
          const [pre_match, matched_string, post_match] = first_match;
          const pre_string = `\\special{dvisvgm:raw <g id='unique${pad(ssIdx)}${MATHTEX_SUBSTRING}'>}`;
          const post_string = '\\special{dvisvgm:raw </g>}';
          matched.push([matched_string, `unique${pad(ssIdx)}${MATHTEX_SUBSTRING}`]);
          processed_string = processed_string + pre_match + pre_string + matched_string + post_string;
          unprocessed_string = post_match;
          ssIdx += 1;
        } else {
          processed_string = processed_string + unprocessed_string;
          unprocessed_string = '';
        }
      }
      string_part += processed_string;
      if (idx < tex_strings.length - 1) string_part += arg_separator;
      string_part += '\\special{dvisvgm:raw </g>}';
      joined_string = joined_string + string_part;
    });
    return joined_string;
  }
  _join_tex_strings_with_unique_deliminters(tex_strings: string[], substrings_to_isolate: string[]): string {
    return MathTex._join(tex_strings, substrings_to_isolate, this.arg_separator, this.matched_strings_and_ids);
  }
  private static _locate_first_match_static(substrings_to_isolate: string[], unprocessed_string: string): [string, string, string] | null {
    let first_match_start = unprocessed_string.length;
    let first_match_length = 0;
    let first_match: [string, string, string] | null = null;
    for (const substring of substrings_to_isolate) {
      const k = unprocessed_string.indexOf(substring);
      if (k < 0) continue;
      const match: [string, string, string] = [unprocessed_string.slice(0, k), substring, unprocessed_string.slice(k + substring.length)];
      if (k < first_match_start) {
        first_match = match;
        first_match_start = k;
        first_match_length = substring.length;
      } else if (k === first_match_start && first_match_length < substring.length) {
        first_match = match;
        first_match_start = k;
        first_match_length = substring.length;
      }
    }
    return first_match;
  }
  /** [text before, matched substring, text after] for the earliest (then longest) match. */
  _locate_first_match(substrings_to_isolate: string[], unprocessed_string: string): [string, string, string] | null {
    return MathTex._locate_first_match_static(substrings_to_isolate, unprocessed_string);
  }
  get _substring_matches(): [string, string][] {
    return this.matched_strings_and_ids.filter(([, id]) => id.endsWith(MATHTEX_SUBSTRING));
  }
  get _main_matches(): [string, string][] {
    return this.matched_strings_and_ids.filter(([, id]) => !id.endsWith(MATHTEX_SUBSTRING));
  }
  _break_up_by_substrings(): this {
    const new_submobjects: VMobject[] = [];
    let tex_string = '', tex_string_id = '';
    try {
      for ([tex_string, tex_string_id] of this._main_matches) {
        const group = this.id_to_vgroup_dict[tex_string_id];
        if (!group) throw new RangeError(tex_string_id);
        const mtp = new MathTexPart();
        mtp.tex_string = tex_string;
        mtp.add(...group.submobjects);
        new_submobjects.push(mtp);
      }
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
      console.error(`MathTex: Could not find SVG group for tex part '${tex_string}' (id: ${tex_string_id}). Using fallback to root group.`);
      new_submobjects.push(this.id_to_vgroup_dict.root);
    }
    this.submobjects = new_submobjects;
    return this;
  }
  /** The (first) part whose TeX is exactly `tex`, or null. */
  get_part_by_tex(tex: string, _kwargs: Kwargs = {}): VGroup | null {
    for (const [tex_str, match_id] of this.matched_strings_and_ids) if (tex_str === tex) return this.id_to_vgroup_dict[match_id];
    return null;
  }
  set_color_by_tex(tex: string, color: ParsableManimColor, _kwargs: Kwargs = {}): this {
    for (const [tex_str, match_id] of this.matched_strings_and_ids) if (tex_str === tex) this.id_to_vgroup_dict[match_id].set_color(color);
    return this;
  }
  set_opacity_by_tex(tex: string, opacity = 0.5, remaining_opacity: number | null = null, _kwargs: Kwargs = {}): this {
    if (remaining_opacity !== null && remaining_opacity !== undefined) this.set_opacity(remaining_opacity);
    for (const [tex_str, match_id] of this.matched_strings_and_ids) if (tex_str === tex) this.id_to_vgroup_dict[match_id].set_opacity(opacity);
    return this;
  }
  set_color_by_tex_to_color_map(texs_to_color_map: Record<string, ParsableManimColor> | Map<string, ParsableManimColor>, _kwargs: Kwargs = {}): this {
    // (an empty dict can arrive as undefined: kwcall reads `{}` as keyword arguments)
    const entries = texs_to_color_map instanceof Map ? [...texs_to_color_map] : Object.entries(texs_to_color_map ?? {});
    for (const [texs, color] of entries) {
      for (const match of this.matched_strings_and_ids) if (match[0] === texs) this.id_to_vgroup_dict[match[1]].set_color(color);
    }
    return this;
  }
  index_of_part(part: VMobject): number {
    const index = this.submobjects.indexOf(part);
    if (index < 0) throw new Error('Trying to get index of part not in MathTex');
    return index;
  }
  sort_alphabetically(): this {
    const key = (m: any): string => (typeof m.get_tex_string === 'function' ? m.get_tex_string() : m.tex_string);
    this.submobjects.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    return this;
  }
}

/** One part of a MathTex (its glyphs), remembering its TeX string. */
export class MathTexPart extends VMobject {
  declare tex_string: string;
  override toString(): string {
    return `${this.constructor.name}(${JSON.stringify(this.tex_string)})`;
  }
}

/** A string compiled with LaTeX in normal (text) mode. */
export class Tex extends MathTex {
  constructor(...args: unknown[]) {
    const [strings, kw] = starArgs<unknown>(args);
    super(...strings, { arg_separator: '', tex_environment: 'center', ...kw });
  }
}

/** A bulleted list. */
export class BulletedList extends Tex {
  declare buff: number;
  declare dot_scale_factor: number;

  constructor(...args: unknown[]) {
    const [items, kw] = starArgs<string>(args);
    const { buff = MED_LARGE_BUFF, dot_scale_factor = 2, tex_environment = null, dot_buff = SMALL_BUFF, ...kwargs } = kw;
    const line_separated_items = items.map((s) => s + '\\\\');
    super(...line_separated_items, { ...kwargs, tex_environment });
    this.buff = buff;
    this.dot_scale_factor = dot_scale_factor;
    this.tex_environment = tex_environment;
    for (const part of this.submobjects) {
      const dot = new MathTex('\\cdot').scale(this.dot_scale_factor);
      dot.next_to(part.submobjects[0], LEFT, { buff: dot_buff });
      part.add_to_back(dot);
    }
    this.arrange(DOWN, { aligned_edge: LEFT, buff: this.buff });
  }
  /** Fade every item except the given one (index or TeX string). */
  fade_all_but(index_or_string: number | string, opacity = 0.5): this {
    const arg = index_or_string;
    let part: VMobject | null;
    if (typeof arg === 'string') {
      part = this.get_part_by_tex(arg);
      if (part === null) throw new Error(`Could not locate part by provided tex string '${arg}'.`);
    } else if (typeof arg === 'number') part = this.submobjects[arg];
    else throw new TypeError(`Expected int or string, got ${arg}`);
    for (const other_part of this.submobjects) {
      if (other_part === part) other_part.set_fill({ opacity: 1 });
      else other_part.set_fill({ opacity });
    }
    return this;
  }
}

/** A title at the top of the frame, underlined. */
export class Title extends Tex {
  declare include_underline: boolean;
  declare match_underline_width_to_text: boolean;
  declare underline_buff: number;
  declare underline: VMobject;

  constructor(...args: unknown[]) {
    const [text_parts, kw] = starArgs<string>(args);
    const { include_underline = true, match_underline_width_to_text = false, underline_buff = MED_SMALL_BUFF, ...kwargs } = kw;
    super(...text_parts, kwargs);
    this.include_underline = include_underline;
    this.match_underline_width_to_text = match_underline_width_to_text;
    this.underline_buff = underline_buff;
    this.to_edge(UP);
    if (this.include_underline) {
      const underline_width = config.frame_width - 2;
      const underline: VMobject = new registry.Line(LEFT, RIGHT);
      underline.next_to(this, DOWN, { buff: this.underline_buff });
      if (this.match_underline_width_to_text) underline.match_width(this);
      else underline.width = underline_width;
      this.add(underline);
      this.underline = underline;
    }
  }
}

register({ SingleStringMathTex, MathTex, MathTexPart, Tex, BulletedList, Title });
