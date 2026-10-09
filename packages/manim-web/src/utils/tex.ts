// manim/utils/tex.py
//
// web: the template is not compiled (manim-web typesets with MathJax, see
// utils/tex/mathjax.ts); its preamble's macro definitions (\newcommand, \def,
// \DeclareMathOperator...) are honoured, packages and fonts are not.

const _DEFAULT_PREAMBLE = '\\usepackage[english]{babel}\n\\usepackage{amsmath}\n\\usepackage{amssymb}';
const _BEGIN_DOCUMENT = '\\begin{document}';
const _END_DOCUMENT = '\\end{document}';

/** TeX templates to add packages, document classes and macros to Tex/MathTex. */
export class TexTemplate {
  _body = '';
  tex_compiler: string | string[] = 'latex';
  description = '';
  output_format = '.dvi';
  documentclass = '\\documentclass[preview]{standalone}';
  preamble = _DEFAULT_PREAMBLE;
  placeholder_text = 'YourTextHere';
  post_doc_commands = '';

  constructor(kw: Partial<Pick<TexTemplate, 'tex_compiler' | 'description' | 'output_format' | 'documentclass' | 'preamble' | 'placeholder_text' | 'post_doc_commands'>> = {}) {
    for (const [k, v] of Object.entries(kw)) if (v !== undefined) (this as any)[k] = v;
  }
  get body(): string {
    return this._body || [this.documentclass, this.preamble, _BEGIN_DOCUMENT, this.post_doc_commands, this.placeholder_text, _END_DOCUMENT].filter(Boolean).join('\n');
  }
  set body(value: string) {
    this._body = value;
  }
  /** web: pass the file's text (there is no file system in a browser). */
  static from_file(file_text: string, kw: Record<string, unknown> = {}): TexTemplate {
    const instance = new TexTemplate(kw);
    instance.body = file_text;
    return instance;
  }
  add_to_preamble(txt: string, prepend = false): this {
    if (this._body) console.warn('This TeX template was created with a fixed body, trying to add text the preamble will have no effect.');
    if (prepend) this.preamble = txt + '\n' + this.preamble;
    else this.preamble += '\n' + txt;
    return this;
  }
  add_to_document(txt: string): this {
    if (this._body) console.warn('This TeX template was created with a fixed body, trying to add text the document will have no effect.');
    this.post_doc_commands += txt;
    return this;
  }
  get_texcode_for_expression(expression: string): string {
    return this.body.replace(this.placeholder_text, expression);
  }
  get_texcode_for_expression_in_env(expression: string, environment: string): string {
    const [begin, end] = _texcode_for_environment(environment);
    return this.body.replace(this.placeholder_text, [begin, expression, end].join('\n'));
  }
  copy(): TexTemplate {
    return Object.assign(Object.create(TexTemplate.prototype), this);
  }
}

/** Opening and closing code for an environment like `align*` or `{minipage}{5cm}`. */
export function _texcode_for_environment(environment: string): [string, string] {
  let env = environment;
  if (env.startsWith('\\begin')) env = env.slice(6);
  if (env.startsWith('{')) env = env.slice(1);
  let begin = '\\begin{' + env;
  if (!begin.endsWith('}') && !begin.endsWith(']')) begin += '}';
  const end = '\\end{' + env.split('}')[0] + '}';
  return [begin, end];
}

let _default: TexTemplate | null = null;
/** web: the default template (manim's config.tex_template), unless `config.tex_template` is set. */
export function default_tex_template(): TexTemplate {
  return (_default ??= new TexTemplate());
}
