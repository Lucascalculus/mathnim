// Minimal syntax highlighting for Code (web extension; manim uses pygments).
// A small hand-written lexer per language produces pygments token types
// ('Keyword', 'Name.Builtin', 'Literal.String.Double', ...) and a few pygments
// styles (colours copied from pygments) map them to colours, which is all
// manim's Code uses from pygments' HTML output.
//   languages: python, javascript/typescript, json, and a generic C-like lexer
//   (c, cpp, java, rust, go, ...); anything else is plain text.

/** A token: [pygments token type, text]. */
export type Token = [string, string];

/** A pygments-like style: background, line number colour and token colours. */
export interface CodeStyle {
  name: string;
  background_color: string;
  line_number_color: string;
  styles: Record<string, string>;
}

const STYLES: Record<string, { bg: string; ln: string; st: Record<string, string> }> = {
  'vim': { bg: '#000000', ln: 'inherit', st: {'':'#cccccc','Comment':'#000080','Comment.Special':'#cd0000','Keyword':'#cdcd00','Keyword.Declaration':'#00cd00','Keyword.Namespace':'#cd00cd','Keyword.Type':'#00cd00','Operator':'#3399cc','Operator.Word':'#cdcd00','Name.Class':'#00cdcd','Name.Builtin':'#cd00cd','Name.Exception':'#666699','Name.Variable':'#00cdcd','Literal.String':'#cd0000','Literal.Number':'#cd00cd','Generic.Heading':'#000080','Generic.Subheading':'#800080','Generic.Deleted':'#cd0000','Generic.Inserted':'#00cd00','Generic.Error':'#ff0000','Generic.Prompt':'#000080','Generic.Output':'#888','Generic.Traceback':'#04d'} },
  'monokai': { bg: '#272822', ln: 'inherit', st: {'':'#f8f8f2','Error':'#ed007e','Comment':'#959077','Keyword':'#66d9ef','Keyword.Namespace':'#ff4689','Operator':'#ff4689','Punctuation':'#f8f8f2','Name':'#f8f8f2','Name.Attribute':'#a6e22e','Name.Builtin':'#a6e22e','Name.Class':'#a6e22e','Name.Constant':'#66d9ef','Name.Decorator':'#a6e22e','Name.Exception':'#a6e22e','Name.Function':'#a6e22e','Name.Other':'#a6e22e','Name.Tag':'#ff4689','Literal.Number':'#ae81ff','Literal':'#ae81ff','Literal.Date':'#e6db74','Literal.String':'#e6db74','Literal.String.Escape':'#ae81ff','Generic.Deleted':'#ff4689','Generic.Error':'#ff4689','Generic.Inserted':'#a6e22e','Generic.Output':'#66d9ef','Generic.Prompt':'#ff4689','Generic.Subheading':'#959077','Generic.Traceback':'#66d9ef'} },
  'default': { bg: '#f8f8f8', ln: 'inherit', st: {'Text.Whitespace':'#bbbbbb','Comment':'#3d7b7b','Comment.Preproc':'#9c6500','Keyword':'#008000','Keyword.Type':'#b00040','Operator':'#666666','Operator.Word':'#aa22ff','Name.Builtin':'#008000','Name.Function':'#0000ff','Name.Class':'#0000ff','Name.Namespace':'#0000ff','Name.Exception':'#cb3f38','Name.Variable':'#19177c','Name.Constant':'#880000','Name.Label':'#767600','Name.Entity':'#717171','Name.Attribute':'#687822','Name.Tag':'#008000','Name.Decorator':'#aa22ff','Literal.String':'#ba2121','Literal.String.Interpol':'#a45a77','Literal.String.Escape':'#aa5d1f','Literal.String.Regex':'#a45a77','Literal.String.Symbol':'#19177c','Literal.String.Other':'#008000','Literal.Number':'#666666','Generic.Heading':'#000080','Generic.Subheading':'#800080','Generic.Deleted':'#a00000','Generic.Inserted':'#008400','Generic.Error':'#e40000','Generic.Prompt':'#000080','Generic.Output':'#717171','Generic.Traceback':'#04d'} },
  'dracula': { bg: '#282a36', ln: '#f1fa8c', st: {'Text.Whitespace':'#f8f8f2','Comment':'#6272a4','Comment.Preproc':'#ff79c6','Generic':'#f8f8f2','Generic.Deleted':'#8b080b','Generic.Output':'#44475a','Error':'#f8f8f2','Keyword':'#ff79c6','Keyword.Constant':'#ff79c6','Keyword.Declaration':'#8be9fd','Keyword.Type':'#8be9fd','Literal':'#f8f8f2','Name':'#f8f8f2','Name.Attribute':'#50fa7b','Name.Builtin':'#8be9fd','Name.Builtin.Pseudo':'#f8f8f2','Name.Class':'#50fa7b','Name.Function':'#50fa7b','Name.Label':'#8be9fd','Name.Tag':'#ff79c6','Name.Variable':'#8be9fd','Literal.Number':'#ffb86c','Operator':'#ff79c6','Other':'#f8f8f2','Punctuation':'#f8f8f2','Literal.String':'#bd93f9','Text':'#f8f8f2'} },
  'github-dark': { bg: '#0d1117', ln: '#6e7681', st: {'':'#e6edf3','Error':'#f85149','Keyword':'#ff7b72','Keyword.Constant':'#79c0ff','Keyword.Pseudo':'#79c0ff','Name':'#e6edf3','Name.Class':'#f0883e','Name.Constant':'#79c0ff','Name.Decorator':'#d2a8ff','Name.Entity':'#ffa657','Name.Exception':'#f0883e','Name.Function':'#d2a8ff','Name.Label':'#79c0ff','Name.Namespace':'#ff7b72','Name.Property':'#79c0ff','Name.Tag':'#7ee787','Name.Variable':'#79c0ff','Literal':'#a5d6ff','Literal.Date':'#79c0ff','Literal.String':'#a5d6ff','Literal.String.Affix':'#79c0ff','Literal.String.Delimiter':'#79c0ff','Literal.String.Escape':'#79c0ff','Literal.String.Heredoc':'#79c0ff','Literal.String.Regex':'#79c0ff','Literal.Number':'#a5d6ff','Comment':'#8b949e','Comment.Preproc':'#8b949e','Comment.Special':'#8b949e','Operator':'#ff7b72','Generic':'#e6edf3','Generic.Deleted':'#ffa198','Generic.Error':'#ffa198','Generic.Heading':'#79c0ff','Generic.Inserted':'#56d364','Generic.Output':'#8b949e','Generic.Prompt':'#8b949e','Generic.Subheading':'#79c0ff','Generic.Traceback':'#ff7b72','Text.Whitespace':'#6e7681'} },
  'one-dark': { bg: '#282C34', ln: 'inherit', st: {'':'#abb2bf','Punctuation':'#abb2bf','Punctuation.Marker':'#abb2bf','Keyword':'#c678dd','Keyword.Constant':'#e5c07b','Keyword.Declaration':'#c678dd','Keyword.Namespace':'#c678dd','Keyword.Reserved':'#c678dd','Keyword.Type':'#e5c07b','Name':'#e06c75','Name.Attribute':'#e06c75','Name.Builtin':'#e5c07b','Name.Class':'#e5c07b','Name.Function':'#61afef','Name.Function.Magic':'#56b6c2','Name.Other':'#e06c75','Name.Tag':'#e06c75','Name.Decorator':'#61afef','Literal.String':'#98c379','Literal.Number':'#d19a66','Operator':'#56b6c2','Comment':'#7f848e','Generic.Heading':'#abb2bf','Generic.Subheading':'#abb2bf','Generic.Deleted':'#e06c75','Generic.Inserted':'#98c379','Generic.Error':'#e06c75','Generic.Output':'#e06c75','Generic.Traceback':'#e06c75'} },
  'solarized-dark': { bg: '#002b36', ln: '#586e75', st: {'':'#839496','Comment':'#586e75','Comment.Hashbang':'#586e75','Comment.Multiline':'#586e75','Comment.Preproc':'#d33682','Comment.PreprocFile':'#586e75','Keyword':'#859900','Keyword.Constant':'#2aa198','Keyword.Declaration':'#2aa198','Keyword.Namespace':'#cb4b16','Keyword.Type':'#b58900','Operator':'#586e75','Operator.Word':'#859900','Name.Builtin':'#268bd2','Name.Builtin.Pseudo':'#268bd2','Name.Class':'#268bd2','Name.Constant':'#268bd2','Name.Decorator':'#268bd2','Name.Entity':'#268bd2','Name.Exception':'#268bd2','Name.Function':'#268bd2','Name.Function.Magic':'#268bd2','Name.Label':'#268bd2','Name.Namespace':'#268bd2','Name.Tag':'#268bd2','Name.Variable':'#268bd2','Name.Variable.Global':'#268bd2','Name.Variable.Magic':'#268bd2','Literal.String':'#2aa198','Literal.String.Doc':'#586e75','Literal.String.Regex':'#cb4b16','Literal.Number':'#2aa198','Generic':'#839496','Generic.Deleted':'#dc322f','Generic.Error':'#dc322f','Generic.Inserted':'#859900','Generic.Output':'#839496','Generic.Prompt':'#268bd2','Generic.Traceback':'#268bd2'} },
  'solarized-light': { bg: '#fdf6e3', ln: '#93a1a1', st: {'':'#657b83','Comment':'#93a1a1','Comment.Hashbang':'#93a1a1','Comment.Multiline':'#93a1a1','Comment.Preproc':'#d33682','Comment.PreprocFile':'#93a1a1','Keyword':'#859900','Keyword.Constant':'#2aa198','Keyword.Declaration':'#2aa198','Keyword.Namespace':'#cb4b16','Keyword.Type':'#b58900','Operator':'#93a1a1','Operator.Word':'#859900','Name.Builtin':'#268bd2','Name.Builtin.Pseudo':'#268bd2','Name.Class':'#268bd2','Name.Constant':'#268bd2','Name.Decorator':'#268bd2','Name.Entity':'#268bd2','Name.Exception':'#268bd2','Name.Function':'#268bd2','Name.Function.Magic':'#268bd2','Name.Label':'#268bd2','Name.Namespace':'#268bd2','Name.Tag':'#268bd2','Name.Variable':'#268bd2','Name.Variable.Global':'#268bd2','Name.Variable.Magic':'#268bd2','Literal.String':'#2aa198','Literal.String.Doc':'#93a1a1','Literal.String.Regex':'#cb4b16','Literal.Number':'#2aa198','Generic':'#657b83','Generic.Deleted':'#dc322f','Generic.Error':'#dc322f','Generic.Inserted':'#859900','Generic.Output':'#657b83','Generic.Prompt':'#268bd2','Generic.Traceback':'#268bd2'} },
  'native': { bg: '#202020', ln: '#aaaaaa', st: {'':'#d0d0d0','Text.Whitespace':'#666666','Comment':'#ababab','Comment.Preproc':'#ff3a3a','Comment.Special':'#e50808','Keyword':'#6ebf26','Operator.Word':'#6ebf26','Literal.String':'#ed9d13','Literal.String.Other':'#ffa500','Literal.Number':'#51b2fd','Name.Builtin':'#2fbccd','Name.Variable':'#40ffff','Name.Constant':'#40ffff','Name.Class':'#71adff','Name.Function':'#71adff','Name.Namespace':'#71adff','Name.Exception':'#bbbbbb','Name.Tag':'#6ebf26','Name.Attribute':'#bbbbbb','Name.Decorator':'#ffa500','Generic.Heading':'#ffffff','Generic.Subheading':'#ffffff','Generic.Deleted':'#ff3a3a','Generic.Inserted':'#589819','Generic.Error':'#ff3a3a','Generic.Prompt':'#aaaaaa','Generic.Output':'#cccccc','Generic.Traceback':'#ff3a3a','Error':'#a61717'} },
  'friendly': { bg: '#f0f0f0', ln: '#666666', st: {'Text.Whitespace':'#bbbbbb','Comment':'#60a0b0','Comment.Preproc':'#007020','Keyword':'#007020','Keyword.Type':'#902000','Operator':'#666666','Operator.Word':'#007020','Name.Builtin':'#007020','Name.Function':'#06287e','Name.Class':'#0e84b5','Name.Namespace':'#0e84b5','Name.Exception':'#007020','Name.Variable':'#bb60d5','Name.Constant':'#60add5','Name.Label':'#002070','Name.Entity':'#d55537','Name.Attribute':'#4070a0','Name.Tag':'#062873','Name.Decorator':'#555555','Literal.String':'#4070a0','Literal.String.Interpol':'#70a0d0','Literal.String.Escape':'#4070a0','Literal.String.Regex':'#235388','Literal.String.Symbol':'#517918','Literal.String.Other':'#c65d09','Literal.Number':'#40a070','Generic.Heading':'#000080','Generic.Subheading':'#800080','Generic.Deleted':'#a00000','Generic.Inserted':'#00a000','Generic.Error':'#ff0000','Generic.Prompt':'#c65d09','Generic.Output':'#888','Generic.Traceback':'#04d'} },
  'emacs': { bg: '#f8f8f8', ln: 'inherit', st: {'Text.Whitespace':'#bbbbbb','Comment':'#008800','Keyword':'#aa22ff','Keyword.Type':'#00bb00','Operator':'#666666','Operator.Word':'#aa22ff','Name.Builtin':'#aa22ff','Name.Function':'#00a000','Name.Class':'#0000ff','Name.Namespace':'#0000ff','Name.Exception':'#d2413a','Name.Variable':'#b8860b','Name.Constant':'#880000','Name.Label':'#a0a000','Name.Entity':'#999999','Name.Attribute':'#bb4444','Name.Tag':'#008000','Name.Decorator':'#aa22ff','Literal.String':'#bb4444','Literal.String.Interpol':'#bb6688','Literal.String.Escape':'#bb6622','Literal.String.Regex':'#bb6688','Literal.String.Symbol':'#b8860b','Literal.String.Other':'#008000','Literal.Number':'#666666','Generic.Heading':'#000080','Generic.Subheading':'#800080','Generic.Deleted':'#a00000','Generic.Inserted':'#00a000','Generic.Error':'#ff0000','Generic.Prompt':'#000080','Generic.Output':'#888','Generic.Traceback':'#04d'} },
  'xcode': { bg: '#ffffff', ln: 'inherit', st: {'Comment':'#177500','Comment.Preproc':'#633820','Literal.String':'#c41a16','Literal.String.Char':'#2300ce','Operator':'#000000','Keyword':'#a90d91','Name':'#000000','Name.Attribute':'#836c28','Name.Class':'#3f6e75','Name.Function':'#000000','Name.Builtin':'#a90d91','Name.Builtin.Pseudo':'#5b269a','Name.Variable':'#000000','Name.Tag':'#000000','Name.Decorator':'#000000','Name.Label':'#000000','Literal':'#1c01ce','Literal.Number':'#1c01ce','Error':'#000000'} },
};

const expand = (c: string) => (/^#[0-9a-fA-F]{3}$/.test(c) ? '#' + [...c.slice(1)].map((h) => h + h).join('') : c);

/** Names of the bundled pygments styles (web: a subset of pygments' list). */
export function get_all_styles(): string[] {
  return Object.keys(STYLES);
}
/** A pygments style by name (throws for unknown names, like pygments). */
export function get_style_by_name(name: string): CodeStyle {
  const s = STYLES[name];
  if (!s) throw new Error(`Could not find style module '${name}' (available in manim-web: ${get_all_styles().join(', ')})`);
  return { name, background_color: expand(s.bg), line_number_color: s.ln === 'inherit' ? 'inherit' : expand(s.ln), styles: s.st };
}
/** Colour of a token type in a style (inherits from parent token types), or null. */
export function style_color(style: CodeStyle, ttype: string): string | null {
  let t = ttype;
  for (;;) {
    const c = style.styles[t];
    if (c) return expand(c);
    if (t === '') return null;
    const i = t.lastIndexOf('.');
    t = i < 0 ? '' : t.slice(0, i);
  }
}

// ------------------------------------------------------------------ lexers

type Rule = [RegExp, string | ((m: RegExpExecArray, st: LexState) => Token[] | string)];
interface LexState {
  prev: string;
  expect: string | null;
}

function run_rules(code: string, rules: Rule[], fallback = 'Text'): Token[] {
  const out: Token[] = [];
  const st: LexState = { prev: '', expect: null };
  let pos = 0;
  const sticky = rules.map(([re, t]) => [new RegExp(re.source, re.flags.replace('y', '') + 'y'), t] as const);
  while (pos < code.length) {
    let matched = false;
    for (const [re, t] of sticky) {
      re.lastIndex = pos;
      const m = re.exec(code);
      if (!m || m[0].length === 0) continue;
      const r = typeof t === 'function' ? t(m, st) : t;
      if (typeof r === 'string') out.push([r, m[0]]);
      else out.push(...r);
      pos += m[0].length;
      matched = true;
      break;
    }
    if (!matched) out.push([fallback, code[pos++]]);
  }
  return out;
}

const PY_KEYWORDS = new Set(['assert', 'async', 'await', 'break', 'continue', 'del', 'elif', 'else', 'except', 'finally', 'for', 'global', 'if', 'lambda', 'pass', 'raise', 'nonlocal', 'return', 'try', 'while', 'yield', 'as', 'with', 'def', 'class', 'match', 'case']);
const PY_BUILTINS = new Set('__import__ abs aiter all any bin bool bytearray breakpoint bytes callable chr classmethod compile complex delattr dict dir divmod enumerate eval filter float format frozenset getattr globals hasattr hash hex id input int isinstance issubclass iter len list locals map max memoryview min next object oct open ord pow print property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip'.split(' '));
const PY_PSEUDO = new Set(['self', 'cls', 'Ellipsis', 'NotImplemented']);
const PY_EXC = /^(?:[A-Z]\w*(?:Error|Exception|Warning)|KeyboardInterrupt|StopIteration|StopAsyncIteration|SystemExit|GeneratorExit)$/;

function py_string(m: RegExpExecArray): Token[] {
  const [, prefix, body] = m;
  const q = body.startsWith('"""') || body.startsWith("'''") ? body.slice(0, 3) : body[0];
  const kind = q[0] === '"' ? 'Literal.String.Double' : 'Literal.String.Single';
  const toks: Token[] = [];
  if (prefix) toks.push(['Literal.String.Affix', prefix]);
  if (/f/i.test(prefix)) {
    // f-string: interpolations {expr} are lexed as code
    const inner = body.slice(q.length, body.length - (body.endsWith(q) && body.length >= 2 * q.length ? q.length : 0));
    toks.push([kind, q]);
    let i = 0, lit = '';
    while (i < inner.length) {
      if (inner[i] === '{' && inner[i + 1] !== '{') {
        if (lit) toks.push([kind, lit]), (lit = '');
        let depth = 0, j = i;
        for (; j < inner.length; j++) {
          if (inner[j] === '{') depth++;
          else if (inner[j] === '}' && --depth === 0) break;
        }
        const expr = inner.slice(i + 1, j);
        const [e, fmt] = expr.split(/(?=[!:](?![=]))/, 2);
        toks.push(['Literal.String.Interpol', '{'], ...lex_python(e));
        if (fmt) toks.push(['Literal.String.Interpol', fmt]);
        if (j < inner.length) toks.push(['Literal.String.Interpol', '}']);
        i = j + 1;
      } else if ((inner[i] === '{' || inner[i] === '}') && inner[i + 1] === inner[i]) {
        lit += inner[i] + inner[i];
        i += 2;
      } else lit += inner[i++];
    }
    if (lit) toks.push([kind, lit]);
    if (body.endsWith(q) && body.length >= 2 * q.length) toks.push([kind, q]);
    return toks;
  }
  toks.push([kind, body]);
  return toks;
}

/** Python lexer (token types as pygments' PythonLexer). */
export function lex_python(code: string): Token[] {
  const rules: Rule[] = [
    [/[ \t]*\n/, 'Text.Whitespace'],
    [/[ \t]+/, 'Text'],
    [/#[^\n]*/, 'Comment.Single'],
    [/([rRbBuUfF]{0,2})("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/, (m) => py_string(m)],
    [/@[\w.]+/, 'Name.Decorator'],
    [/(?:\d[\d_]*\.[\d_]*|\.\d[\d_]*|\d[\d_]*)(?:[eE][+-]?\d+)[jJ]?|\d[\d_]*\.[\d_]*[jJ]?|\.\d[\d_]*[jJ]?/, 'Literal.Number.Float'],
    [/0[xX][\da-fA-F_]+/, 'Literal.Number.Hex'],
    [/0[bB][01_]+/, 'Literal.Number.Bin'],
    [/0[oO][0-7_]+/, 'Literal.Number.Oct'],
    [/\d[\d_]*[jJ]?/, 'Literal.Number.Integer'],
    [/[A-Za-z_\u00c0-\uffff][\w\u00c0-\uffff]*/, (m, st) => {
      const w = m[0];
      let t: string;
      if (st.expect) {
        t = st.expect;
        st.expect = null;
      } else if (w === 'import' || w === 'from') t = 'Keyword.Namespace';
      else if (w === 'def') (t = 'Keyword'), (st.expect = 'Name.Function');
      else if (w === 'class') (t = 'Keyword'), (st.expect = 'Name.Class');
      else if (w === 'True' || w === 'False' || w === 'None') t = 'Keyword.Constant';
      else if (w === 'and' || w === 'or' || w === 'not' || w === 'in' || w === 'is') t = 'Operator.Word';
      else if (PY_KEYWORDS.has(w)) t = 'Keyword';
      else if (st.prev === '.') t = 'Name';
      else if (PY_PSEUDO.has(w)) t = 'Name.Builtin.Pseudo';
      else if (PY_BUILTINS.has(w)) t = 'Name.Builtin';
      else if (PY_EXC.test(w)) t = 'Name.Exception';
      else if (st.prev === 'import' || st.prev === 'from') t = 'Name.Namespace';
      else t = 'Name';
      st.prev = w;
      return t;
    }],
    [/!=|==|<<|>>|:=|[-~+/*%=<>&^|.]/, (m, st) => {
      st.prev = m[0];
      return 'Operator';
    }],
    [/[\]{}:(),;[]/, (m, st) => {
      st.prev = m[0];
      return 'Punctuation';
    }],
    [/\\\n/, 'Text'],
  ];
  return run_rules(code, rules);
}

const JS_KEYWORDS = new Set('await break case catch continue debugger default do else export finally for from if import return super switch throw try while with yield async of as'.split(' '));
const JS_DECL = new Set(['var', 'let', 'const', 'function', 'class', 'interface', 'type', 'enum', 'extends', 'implements', 'static', 'get', 'set']);
const JS_TYPES = new Set(['number', 'string', 'boolean', 'any', 'void', 'never', 'unknown', 'object', 'symbol', 'bigint']);
const JS_BUILTINS = new Set('Array Boolean Date Error Function Math Number Object RegExp String Promise Map Set JSON console window document globalThis parseInt parseFloat isNaN isFinite Symbol'.split(' '));

/** JavaScript / TypeScript lexer (pygments' JavascriptLexer token types). */
export function lex_javascript(code: string): Token[] {
  const rules: Rule[] = [
    [/\s+/, 'Text.Whitespace'],
    [/\/\/[^\n]*/, 'Comment.Single'],
    [/\/\*[\s\S]*?(?:\*\/|$)/, 'Comment.Multiline'],
    [/"(?:\\.|[^"\\\n])*"?/, 'Literal.String.Double'],
    [/'(?:\\.|[^'\\\n])*'?/, 'Literal.String.Single'],
    [/`(?:\\.|[^`\\])*`?/, 'Literal.String.Backtick'],
    [/0[xX][\da-fA-F_]+n?|0[bB][01_]+n?|0[oO][0-7_]+n?/, 'Literal.Number.Hex'],
    [/(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?/, (m) => (/[.eE]/.test(m[0]) ? 'Literal.Number.Float' : 'Literal.Number.Integer')],
    [/[A-Za-z_$][\w$]*/, (m, st) => {
      const w = m[0];
      let t = 'Name.Other';
      if (st.expect) {
        t = st.expect;
        st.expect = null;
      } else if (w === 'true' || w === 'false' || w === 'null' || w === 'undefined' || w === 'NaN' || w === 'Infinity') t = 'Keyword.Constant';
      else if (w === 'new' || w === 'typeof' || w === 'instanceof' || w === 'delete' || w === 'void' || w === 'in') t = 'Operator.Word';
      else if (w === 'this') t = 'Name.Builtin';
      else if (JS_DECL.has(w)) {
        t = 'Keyword.Declaration';
        if (w === 'class' || w === 'interface') st.expect = 'Name.Class';
        else if (w === 'function') st.expect = 'Name.Function';
      } else if (JS_KEYWORDS.has(w)) t = 'Keyword';
      else if (JS_TYPES.has(w)) t = 'Keyword.Type';
      else if (JS_BUILTINS.has(w) && st.prev !== '.') t = 'Name.Builtin';
      st.prev = w;
      return t;
    }],
    [/=>|\+\+|--|~|&&|\?\?|\?|:|\|\||\\(?=\n)|(?:<<|>>>?|==?|!=?|[-<>+*%&|^/])=?/, (m, st) => {
      st.prev = m[0];
      return 'Operator';
    }],
    [/[{(\[;,]/, (m, st) => {
      st.prev = m[0];
      return 'Punctuation';
    }],
    [/[})\].]/, (m, st) => {
      st.prev = m[0];
      return 'Punctuation';
    }],
  ];
  return run_rules(code, rules);
}

const C_KEYWORDS = new Set('if else for while do switch case default break continue return goto sizeof typedef struct union enum class public private protected virtual override template typename namespace using new delete try catch throw static const extern inline volatile register auto fn let mut impl trait pub use mod match loop where func package import go defer select chan map range type interface var val def object extends implements final abstract native synchronized throws this self super'.split(' '));
const C_TYPES = new Set('int long short char float double void bool unsigned signed size_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 usize isize str String boolean byte string'.split(' '));

/** Generic C-family lexer (C, C++, Java, Rust, Go, C#, Kotlin, Swift ...). */
export function lex_clike(code: string): Token[] {
  const rules: Rule[] = [
    [/\s+/, 'Text.Whitespace'],
    [/\/\/[^\n]*/, 'Comment.Single'],
    [/\/\*[\s\S]*?(?:\*\/|$)/, 'Comment.Multiline'],
    [/#\s*\w+[^\n]*/, 'Comment.Preproc'],
    [/"(?:\\.|[^"\\\n])*"?/, 'Literal.String'],
    [/'(?:\\.|[^'\\\n])'/, 'Literal.String.Char'],
    [/0[xX][\da-fA-F_]+\w*|(?:\d[\d_]*\.?[\d_]*|\.\d+)(?:[eE][+-]?\d+)?\w*/, (m) => (/^0x/i.test(m[0]) ? 'Literal.Number.Hex' : /[.eE]/.test(m[0]) ? 'Literal.Number.Float' : 'Literal.Number.Integer')],
    [/[A-Za-z_]\w*/, (m) => (m[0] === 'true' || m[0] === 'false' || m[0] === 'null' || m[0] === 'nullptr' || m[0] === 'NULL' || m[0] === 'nil' ? 'Keyword.Constant' : C_KEYWORDS.has(m[0]) ? 'Keyword' : C_TYPES.has(m[0]) ? 'Keyword.Type' : 'Name')],
    [/[-+*/%=<>!&|^~?:.]+/, 'Operator'],
    [/[{}()[\];,]/, 'Punctuation'],
  ];
  return run_rules(code, rules);
}

/** JSON lexer. */
export function lex_json(code: string): Token[] {
  return run_rules(code, [
    [/\s+/, 'Text.Whitespace'],
    [/"(?:\\.|[^"\\])*"(?=\s*:)/, 'Name.Tag'],
    [/"(?:\\.|[^"\\])*"?/, 'Literal.String.Double'],
    [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'Literal.Number'],
    [/true|false|null/, 'Keyword.Constant'],
    [/[{}[\],:]/, 'Punctuation'],
  ]);
}

/** A lexer: code -> tokens. */
export interface Lexer {
  name: string;
  lex(code: string): Token[];
}
const LEXERS: Record<string, Lexer> = {
  python: { name: 'Python', lex: lex_python },
  javascript: { name: 'JavaScript', lex: lex_javascript },
  json: { name: 'JSON', lex: lex_json },
  clike: { name: 'C', lex: lex_clike },
  text: { name: 'Text only', lex: (c) => [['Text', c]] },
};
const ALIASES: Record<string, string> = {
  python: 'python', py: 'python', python3: 'python', py3: 'python', sage: 'python', pycon: 'python',
  javascript: 'javascript', js: 'javascript', typescript: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript', mjs: 'javascript',
  json: 'json', c: 'clike', h: 'clike', cpp: 'clike', 'c++': 'clike', cxx: 'clike', hpp: 'clike', java: 'clike', rust: 'clike', rs: 'clike',
  go: 'clike', golang: 'clike', csharp: 'clike', 'c#': 'clike', cs: 'clike', kotlin: 'clike', kt: 'clike', swift: 'clike', scala: 'clike',
  glsl: 'clike', cuda: 'clike', text: 'text', txt: 'text', plain: 'text',
};
/** pygments.lexers.get_lexer_by_name (web: a handful of languages; unknown -> plain text with a warning). */
export function get_lexer_by_name(name: string): Lexer {
  const k = ALIASES[name.toLowerCase()];
  if (!k) {
    console.warn(`manim-web: no highlighter for language '${name}'; showing plain text`);
    return LEXERS.text;
  }
  return LEXERS[k];
}
/** pygments.lexers.guess_lexer (heuristic). */
export function guess_lexer(code: string): Lexer {
  if (/^\s*[{[]/.test(code) && /[}\]]\s*$/.test(code) && /"\s*:/.test(code)) return LEXERS.json;
  if (/^\s*(def|class|import|from)\s|:\s*(#.*)?$|\bself\b|\belif\b|print\(/m.test(code)) return LEXERS.python;
  if (/\b(const|let|var|function)\b|=>|console\./.test(code)) return LEXERS.javascript;
  if (/#include|\bint\s+main\b|;\s*$/m.test(code)) return LEXERS.clike;
  return LEXERS.python;
}
/** pygments.lexers.guess_lexer_for_filename. */
export function guess_lexer_for_filename(filename: string, code: string): Lexer {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() : '';
  return ext && ALIASES[ext] ? LEXERS[ALIASES[ext]] : guess_lexer(code);
}
