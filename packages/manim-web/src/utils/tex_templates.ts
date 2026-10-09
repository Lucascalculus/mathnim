// manim/utils/tex_templates.py
//
// web: only TexTemplateLibrary; the font templates (TexFontTemplates) need
// LaTeX font packages, which MathJax cannot use.
import { TexTemplate } from './tex';

const _3b1b_preamble = '\n\\usepackage[english]{babel}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage{amsmath}\n\\usepackage{amssymb}\n\\usepackage{dsfont}\n\\usepackage{setspace}\n\\usepackage{tipa}\n\\usepackage{relsize}\n\\usepackage{textcomp}\n\\usepackage{mathrsfs}\n\\usepackage{calligra}\n\\usepackage{wasysym}\n\\usepackage{ragged2e}\n\\usepackage{physics}\n\\usepackage{xcolor}\n\\usepackage{microtype}\n\\DisableLigatures{encoding = *, family = * }\n\\linespread{1}\n';
const _new_ams_template = () => new TexTemplate({ preamble: '\n\\usepackage[english]{babel}\n\\usepackage{amsmath}\n\\usepackage{amssymb}\n' });

/** A collection of TeX templates (manim's TexTemplateLibrary). */
export class TexTemplateLibrary {
  static default = new TexTemplate({ preamble: _3b1b_preamble });
  static threeb1b = new TexTemplate({ preamble: _3b1b_preamble });
  static ctex = new TexTemplate({ tex_compiler: 'xelatex', output_format: '.xdv', preamble: _3b1b_preamble.replace('\\DisableLigatures{encoding = *, family = * }', '\\usepackage[UTF8]{ctex}') });
  static simple = _new_ams_template();
}
