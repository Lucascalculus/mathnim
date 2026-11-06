// What is wrong with a text's markup, in words a model can act on: every registered fence's own check, definitions
// whose parentheses do not close, numbers written in a way the page cannot read, computed numbers that read a name no
// number defines. The course generator's replies are checked with it on the server (studio/format.ts) and sent back
// for repair; nothing here touches the DOM.
import { TANGLE } from '../tangle';
import { expr_names } from '../../../engine/src/kernel/expr';
import { fence_entry, fence_names } from './registry';
import './builtin';

const ONE_NUMBER = new RegExp(`^${TANGLE.source}$`);
const BRACES = /\{\{([^{}]*)\}\}/g;

/** The names of the numbers to drag a text defines ({{n = 3, 1..12}} defines n). */
export function number_names(text: string): string[] {
  return [...text.matchAll(BRACES)].map((m) => /^\{\{\s*([A-Za-z_]\w*)\s*=(?!=)/.exec(m[0])?.[1]).filter((n): n is string => !!n);
}

/**
 * The problems of a text's markup (empty: none). `names`: the numbers defined elsewhere on the same page (the numbers
 * of one page share their names), so a computed number may read them.
 */
export function markup_issues(text: string, o: { names?: Iterable<string> } = {}): string[] {
  const out: string[] = [];
  const fences = new RegExp('```[ \\t]*(' + fence_names().join('|') + ')([^\\n]*)\\n([\\s\\S]*?)(```|$)', 'g');
  for (const m of text.matchAll(fences)) {
    if (m[4] !== '```') {
      out.push(`a \`\`\`${m[1]} block is not closed`);
      continue;
    }
    const why = fence_entry(m[1])?.check?.(m[3], m[2]);
    if (why) out.push(`\`\`\`${m[1]}: ${why}`);
  }
  const prose = text.replace(fences, ' ');
  // a definition's parentheses must close (it may hold (a, b) or $f(x)$ inside)
  for (let i = prose.indexOf('](def:'); i >= 0; i = prose.indexOf('](def:', i + 6)) {
    let depth = 1, j = i + 2;
    for (; j < prose.length && depth > 0; j++) {
      if (prose[j] === '(') depth++;
      else if (prose[j] === ')') depth--;
    }
    if (depth) {
      out.push(`a definition is not closed: "${prose.slice(Math.max(0, prose.lastIndexOf('[', i)), i + 24)}…" needs its ")"`);
      break;
    }
  }
  // numbers: each written so the page can read it; a computed one reads only names that are defined
  const defined = new Set([...(o.names ?? []), ...number_names(prose)]);
  for (const m of prose.matchAll(BRACES)) {
    if (!ONE_NUMBER.test(m[0])) {
      out.push(`"${m[0]}" is not a number the page can read: write {{name = value, min..max}} to drag, {{= expression}} to follow`);
      continue;
    }
    const expr = /^\{\{\s*=\s*([^{}]+?)(?:\s*,\s*\d)?\s*\}\}$/.exec(m[0])?.[1];
    if (expr) for (const n of expr_names(expr)) if (!defined.has(n)) out.push(`"${m[0]}" reads "${n}", which no number on the page defines`);
  }
  if (/\{\{(?![^{}]*\}\})/.test(prose)) out.push('a "{{" without its "}}"');
  return out;
}
