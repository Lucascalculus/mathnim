// A small syntax highlighter for the code in lessons: python, bash, json,
// yaml and plain text. It tokenizes with ordered sticky regexes (first match
// wins, unknown characters are plain) and returns one HTML string per line, so
// a code page can number lines and highlight ranges. Classes: mn-t-c comment,
// mn-t-s string, mn-t-n number, mn-t-k keyword, mn-t-l literal (True, null),
// mn-t-b builtin, mn-t-f function / command, mn-t-d decorator, mn-t-a key or
// flag, mn-t-v variable.
import { esc } from './math';

type Rule = [RegExp, string];
const words = (ws: string) => new RegExp(`\\b(?:${ws.trim().split(/\s+/).join('|')})\\b`, 'y');

const PY_KEYWORDS = 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case';
const PY_BUILTINS = 'print len range enumerate zip list dict set tuple int float str bool type isinstance super min max sum abs open map filter sorted reversed any all self cls getattr setattr hasattr round iter next';
const BASH_KEYWORDS = 'if then else elif fi for while until do done case esac in function return export local select time';

const RULES: Record<string, Rule[]> = {
  python: [
    [/#[^\n]*/y, 'c'],
    [/[rRbBfFuU]{0,2}(?:"""[\s\S]*?(?:"""|$(?![\s\S]))|'''[\s\S]*?(?:'''|$(?![\s\S])))/y, 's'],
    [/[rRbBfFuU]{0,2}(?:"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/y, 's'],
    [/@[A-Za-z_][\w.]*/y, 'd'],
    [/(?:0[xX][\da-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?j?)/y, 'n'],
    [words('True False None'), 'l'],
    [words(PY_KEYWORDS), 'k'],
    [/(?<=\b(?:def|class)\s+)[A-Za-z_]\w*/y, 'f'],
    [words(PY_BUILTINS), 'b'],
    [/[A-Za-z_]\w*(?=\s*\()/y, 'f'],
    [/[A-Za-z_]\w*/y, ''],
  ],
  bash: [
    [/(?<![^\s;|&(])#[^\n]*/y, 'c'],
    [/"(?:\\.|[^"\\])*"?/y, 's'],
    [/'[^']*'?/y, 's'],
    [/\$\{[^}\n]*\}?|\$[A-Za-z_]\w*|\$[\d@*#?$!-]/y, 'v'],
    [words(BASH_KEYWORDS), 'k'],
    [/(?<=(?:^|[|;&(]|&&|\|\|)[ \t]*)[A-Za-z_./~][\w./~+-]*/my, 'f'],
    [/(?<=\s)--?[A-Za-z][\w-]*/y, 'a'],
    [/\b\d+(?:\.\d+)?\b/y, 'n'],
    [/[A-Za-z_][\w.-]*/y, ''],
  ],
  json: [
    [/"(?:\\.|[^"\\\n])*"(?=\s*:)/y, 'a'],
    [/"(?:\\.|[^"\\\n])*"?/y, 's'],
    [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, 'n'],
    [words('true false null'), 'l'],
  ],
  yaml: [
    [/(?<![^\s])#[^\n]*/y, 'c'],
    [/(?<=^[ \t]*(?:-[ \t]+)?)[^\s#:'"\-][^:#\n]*?(?=:(?:[ \t]|$))/my, 'a'],
    [/"(?:\\.|[^"\\\n])*"?|'[^'\n]*'?/y, 's'],
    [/(?<=[:\-\s])-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?=\s*(?:#|$))/my, 'n'],
    [/(?<=[:\-\s])(?:true|false|yes|no|null|~)(?=\s*(?:#|$))/my, 'l'],
    [/[&*][\w-]+/y, 'v'],
  ],
};
const ALIASES: Record<string, string> = { py: 'python', python3: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', yml: 'yaml', jsonl: 'json' };
/** Canonical language name ('python', 'bash', 'json', 'yaml' or 'text'). */
export const code_lang = (lang: string): string => {
  const l = (lang || 'text').toLowerCase();
  const c = ALIASES[l] ?? l;
  return c in RULES ? c : 'text';
};
/** A readable name for a tab, e.g. 'Python'. */
export const lang_label = (lang: string): string => ({ python: 'Python', bash: 'Bash', json: 'JSON', yaml: 'YAML' })[code_lang(lang)] ?? (lang || 'Text');

/** Tokens [class, text] covering the whole code (class '' is plain). */
export function tokenize(code: string, lang: string): [string, string][] {
  const rules = RULES[code_lang(lang)];
  if (!rules) return [['', code]];
  const out: [string, string][] = [];
  const push = (cls: string, text: string) => {
    const last = out[out.length - 1];
    if (last && last[0] === cls) last[1] += text;
    else out.push([cls, text]);
  };
  let i = 0;
  while (i < code.length) {
    let matched = false;
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length) {
        push(cls, m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) push('', code[i++]);
  }
  return out;
}

/** HTML for each line of the code (escaped, with token spans that never cross a line). */
export function highlight_lines(code: string, lang: string): string[] {
  const lines: string[] = [''];
  for (const [cls, text] of tokenize(code.replace(/\n$/, ''), lang)) {
    text.split('\n').forEach((piece, k) => {
      if (k > 0) lines.push('');
      if (piece) lines[lines.length - 1] += cls ? `<span class="mn-t-${cls}">${esc(piece)}</span>` : esc(piece);
    });
  }
  return lines;
}
