// manim/mobject/text/code_mobject.py
//
// web: manim highlights with pygments (HTML output parsed by BeautifulSoup);
// manim-web uses the small lexers and copied pygments styles in
// src/ext/text/highlight.ts and colours the characters the same way.
import { LEFT, RIGHT, UP } from '../../constants';
import { BLACK, WHITE } from '../../utils/color/manim_colors';
import { pyargs, type Kwargs } from '../../utils/pyargs';
import { register } from '../../utils/registry';
import { read_text_file_sync } from '../../ext/text/fonts';
import { get_all_styles, get_lexer_by_name, get_style_by_name, guess_lexer, guess_lexer_for_filename, style_color, type CodeStyle } from '../../ext/text/highlight';
import { Dot } from '../geometry/arc';
import { SurroundingRectangle } from '../geometry/shape_matchers';
import { VGroup, VMobject } from '../types/vectorized_mobject';
import { Paragraph } from './text_mobject';

/** Python's str.expandtabs. */
function expandtabs(s: string, tabsize: number): string {
  return s.split('\n').map((line) => {
    let out = '';
    for (const c of line) out += c === '\t' ? (tabsize > 0 ? ' '.repeat(tabsize - (out.length % tabsize)) : '') : c;
    return out;
  }).join('\n');
}

/** Syntax-highlighted source code with optional line numbers and a background ('rectangle' or 'window'). */
export class Code extends VMobject {
  static _styles_list_cache: string[] | null = null;
  static default_background_config: Kwargs = { buff: 0.3, fill_color: null, stroke_color: WHITE, corner_radius: 0.2, stroke_width: 1, fill_opacity: 1 };
  static default_paragraph_config: Kwargs = { font: 'Monospace', font_size: 24, line_spacing: 0.5, disable_ligatures: true };
  declare code_lines: Paragraph;
  declare line_numbers: Paragraph;
  declare background: VMobject;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['code_file', 'code_string', 'language', 'formatter_style', 'tab_width', 'add_line_numbers', 'line_numbers_from', 'background', 'background_config', 'paragraph_config'], {
      code_file: null, code_string: null, language: null, formatter_style: 'vim', tab_width: 4, add_line_numbers: true, line_numbers_from: 1,
      background: 'rectangle', background_config: null, paragraph_config: null,
    });
    super();
    let code_string: string;
    let lexer;
    if (o.code_file != null) {
      const file = String(o.code_file);
      code_string = read_text_file_sync(file);
      lexer = o.language != null ? get_lexer_by_name(o.language) : guess_lexer_for_filename(file.slice(file.lastIndexOf('/') + 1), code_string);
    } else if (o.code_string != null) {
      code_string = String(o.code_string);
      lexer = o.language != null ? get_lexer_by_name(o.language) : guess_lexer(code_string);
    } else throw new Error('Either a code file or a code string must be specified.');
    code_string = expandtabs(code_string, o.tab_width);
    const selected_style: CodeStyle = typeof o.formatter_style === 'string' ? get_style_by_name(o.formatter_style) : o.formatter_style;
    // pygments strips leading/trailing newlines (stripnl) and ends the text with one
    const source = code_string.replace(/^\n+|\n+$/g, '');
    const tokens = lexer.lex(source);
    const code_lines = source.split('\n');
    const base_paragraph_config: Kwargs = { ...(this.constructor as typeof Code).default_paragraph_config, ...(o.paragraph_config ?? {}) };
    delete base_paragraph_config.color;
    const default_text_color = style_color(selected_style, 'Text');
    const foreground_color = default_text_color === null ? BLACK : default_text_color;
    const rendered_code_lines = code_lines.some((l) => l.trim()) ? code_lines : code_lines.map(() => '');
    const alignment_suffix = ' pA' + String(o.line_numbers_from);
    const alignment_reference = new Paragraph(alignment_suffix, base_paragraph_config);
    const alignment_length = alignment_reference.get(0).length;
    const boundary_line_indices = [...new Set([0, rendered_code_lines.length - 1])].sort((a, b) => a - b);
    const aligned_code_lines = rendered_code_lines.slice();
    for (const index of boundary_line_indices) aligned_code_lines[index] += alignment_suffix;
    this.code_lines = new Paragraph(...aligned_code_lines, { color: foreground_color, ...base_paragraph_config });
    let i_line = 0, i_char = 0;
    for (const [ttype, text] of tokens) {
      const color = ttype === 'Text' || ttype === 'Text.Whitespace' ? null : style_color(selected_style, ttype);
      const n = [...text].filter((c) => c !== '\n').length;
      if (color && !text.includes('\n') && n) this.code_lines.get(i_line).get_slice(i_char, i_char + n).set_color(color);
      else if (color) {
        // multi-line token (docstring, block comment): colour each line's part
        let li = i_line, ci = i_char;
        for (const part of text.split('\n')) {
          const k = [...part].length;
          if (k && li < this.code_lines.length) this.code_lines.get(li).get_slice(ci, ci + k).set_color(color);
          li++;
          ci = 0;
        }
      }
      for (const c of text) {
        if (c === '\n') {
          i_line += 1;
          i_char = 0;
        } else i_char += 1;
      }
    }
    if (o.add_line_numbers) {
      const n_lines = this.code_lines.length;
      const line_number_strings = Array.from({ length: n_lines }, (_, k) => String(o.line_numbers_from + k));
      const line_number_config = { ...base_paragraph_config, alignment: 'right' };
      let line_number_color: unknown = selected_style.line_number_color;
      if (line_number_color === 'inherit') line_number_color = foreground_color;
      this.line_numbers = new Paragraph(...line_number_strings, { color: line_number_color, ...line_number_config });
      this.line_numbers.next_to(this.code_lines, { direction: LEFT });
      const nref = String(o.line_numbers_from).length;
      const first = this.code_lines.get(0);
      const line_number_reference = new VGroup(...first.submobjects.slice(first.submobjects.length - nref));
      this.line_numbers.shift([0, line_number_reference.get_y() - this.line_numbers.get(0).get_y(), 0]);
      this.add(this.line_numbers);
    }
    const popped: VMobject[] = [];
    for (const index of boundary_line_indices) for (let k = 0; k < alignment_length; k++) popped.push(this.code_lines.get(index).submobjects.pop()!);
    const alignment_mobjects = new VGroup(...popped).stretch_to_fit_width(0, { about_edge: LEFT });
    for (const line of this.code_lines) line.submobjects = line.submobjects.filter((c: VMobject) => !(c instanceof Dot));
    this.add(this.code_lines);
    const background_config_base: Kwargs = { ...(this.constructor as typeof Code).default_background_config, ...(o.background_config ?? {}) };
    if (background_config_base.fill_color == null) background_config_base.fill_color = selected_style.background_color;
    if (o.background === 'rectangle') {
      this.background = new SurroundingRectangle(this, alignment_mobjects, background_config_base);
    } else if (o.background === 'window') {
      const buttons = new VGroup(...['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => new Dot({ radius: 0.1, stroke_width: 0, color: c }))).arrange(RIGHT, { buff: 0.1 });
      const code_and_alignment = new VGroup(this, alignment_mobjects);
      buttons.next_to(code_and_alignment, UP, { buff: 0.1 }).align_to(code_and_alignment, LEFT).shift([-0.1, 0, 0]);
      this.background = new SurroundingRectangle(code_and_alignment, buttons, background_config_base);
      buttons.shift([-0.1, 0.1, 0]);
      this.background.add(buttons);
    } else throw new Error(`Unknown background type: ${o.background}`);
    this.add_to_back(this.background);
  }

  /** A pygments style by name (web: the bundled subset). */
  static get_pygments_style(name: string): CodeStyle {
    return get_style_by_name(name);
  }
  /** Names of the available styles. */
  static get_styles_list(): string[] {
    if (Code._styles_list_cache === null) Code._styles_list_cache = get_all_styles();
    return Code._styles_list_cache;
  }
}

register({ Code });
