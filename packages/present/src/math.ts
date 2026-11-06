// Text with inline TeX (`$...$`) in DOM elements. The TeX renderer is
// pluggable (the app passes manim-web's MathJax adapter); without one the
// TeX source is shown.
//
// Light markup (the prose of lessons and AI answers): $inline$ and $$display$$
// TeX, **bold**, *italic*, `code`, [text](https://link) and footnote
// references [^key] (when the caller passes `footnote`).
import { look, text_color_of } from '@mathnim/look';
export type TexRenderer = (tex: string, display: boolean) => string;
let renderer: TexRenderer | null = null;
export function set_tex_renderer(r: TexRenderer | null): void {
  renderer = r;
  // formulas written while the renderer was loading (the app loads MathJax after the first page): draw them now
  if (r && typeof document !== 'undefined')
    for (const el of document.querySelectorAll<HTMLElement>('.mn-tex-wait')) el.outerHTML = tex_html(el.dataset.tex ?? '', el.hasAttribute('data-display'));
}
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface MarkupOptions {
  /** HTML for a footnote reference [^key] (e.g. a numbered link); without it the marker is dropped. */
  footnote?: (key: string) => string;
}

/** Only web, mail, in-page and relative links (never javascript: and the like). */
function safe_url(url: string): string | null {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u) || /^[#/.]/.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null;
  return u;
}

/** Prose without TeX: escaped, then nouns, links, footnotes, bold, italic, line breaks. */
function prose_html(text: string, o: MarkupOptions): string {
  let s = esc(text);
  // a noun: the word in its noun's colour, as the thing it names is drawn in the figure ([cost](noun:cost))
  s = s.replace(/\[([^\]]+)\]\(noun:([\w-]+)\)/g, (_m, label: string, key: string) => `<span class="mn-noun" data-noun="${key}" style="color:${text_color_of(`noun:${key}`, look())}">${label}</span>`);
  s = s.replace(/\[\^([\w.:-]+)\]/g, (_, key: string) => (o.footnote ? o.footnote(key) : ''));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const u = safe_url(url.replace(/&amp;/g, '&').replace(/&#39;/g, "'"));
    return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${label}</a>` : label;
  });
  return s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/\n/g, '<br>');
}

function tex_html(tex: string, display: boolean): string {
  if (renderer) {
    try {
      // (the source stays on the formula: a passage asked about reads it as TeX, since the picture has no text)
      return `<span class="mn-math" data-tex="${esc(tex)}"${display ? ' data-display="" style="display:block;text-align:center"' : ''}>${renderer(tex, display)}</span>`;
    } catch {
      /* fall through */
    }
  }
  // no renderer (yet): the source, faint, drawn once set_tex_renderer gets one
  return `<span class="mn-tex-wait" data-tex="${esc(tex)}"${display ? ' data-display=""' : ''} style="opacity:.5">${esc(tex)}</span>`;
}

// Chinese punctuation must not start a line: closing marks after inline math stay with it
// (and opening marks before it), e.g. "预训练好的 $W_0$，只学习" never breaks before "，".
const CJK_CLOSE = /^[，。、；：！？）」』”’》〉】…—·%]+/;
const CJK_OPEN = /[（「『“‘《〈【]+$/;

/** HTML for text containing $inline$ and $$display$$ TeX; **bold**, *italic*, `code` and [links](url) are supported. */
/** Bold that contains math (**the rank of $BA$ is at most $r$**) spans several prose pieces: marked first, closed at the end. */
const B_OPEN = '\u0001', B_CLOSE = '\u0002';
const mark_bold_math = (chunk: string): string =>
  chunk.includes('**') && chunk.includes('$') ? chunk.replace(/\*\*(?=\S)([^*]*?\$[^*]*?\S)\*\*/g, `${B_OPEN}$1${B_CLOSE}`) : chunk;

/** "\$" is a literal dollar in prose (it starts no math); inside math it stays TeX's own \$. */
const DOLLAR = '\u0004';

/**
 * A ```steps block (a derivation, one TeX line per step, `% words` for what was done) becomes a column of displayed
 * formulas with their reasons: readable as it is, and turned into the engine's formula steps by mount_steps() where
 * the page can play them. A block still arriving (an answer streaming in) shows nothing yet.
 */
const STEPS_FENCE = /```[ \t]*steps[^\n]*\n([\s\S]*?)(```|$)/g;
/** A derivation's lines as the column of formulas mount_steps() turns into the engine's (a steps block of a page). */
export function steps_rows_html(rows: { tex: string; why?: string }[]): string {
  const body = rows.map((r) => `${r.tex}${r.why ? ` % ${r.why}` : ''}`).join('\n');
  const html = rows.map((r) => `<div class="mn-step">${tex_html(r.tex, true)}${r.why ? `<div class="mn-step-why">${prose_math_html(r.why)}</div>` : ''}</div>`).join('');
  return `<div class="mn-steps" data-steps="${esc(body)}">${html}</div>`;
}
function steps_html(body: string, closed: boolean): string {
  if (!closed) return '<div class="mn-steps mn-steps-wait"></div>';
  const rows: { tex: string; why: string }[] = [];
  for (const raw of body.split('\n')) {
    let l = raw.trim(), why = '';
    const c = /(^|[^\\])%(.*)$/.exec(l);
    if (c) { why = c[2].trim(); l = l.slice(0, c.index + c[1].length).trim(); }
    l = l.replace(/^\$+|\$+$/g, '').replace(/^\\\[|\\\]$/g, '').trim();
    if (l) rows.push({ tex: l, why });
    else if (why && rows.length && !rows[rows.length - 1].why) rows[rows.length - 1].why = why; // (a reason on its own line)
  }
  const html = rows.map((r) => `<div class="mn-step">${tex_html(r.tex, true)}${r.why ? `<div class="mn-step-why">${prose_math_html(r.why)}</div>` : ''}</div>`).join('');
  return `<div class="mn-steps" data-steps="${esc(body)}">${html}</div>`;
}

/**
 * A definition in its sentence: [term](def: what it means). The term is shown with a dotted underline; opened, the
 * definition unfolds in place under its line (the rest of the text moves down, never sideways), and it may hold
 * definitions of its own. The parentheses of the definition are matched, so it may contain (a, b) or $f(x)$.
 */
const DEF_MARK = '\u0005', DEF_END = '\u0006';
function lift_definitions(text: string, o: MarkupOptions, out: string[]): string {
  let res = '', i = 0;
  for (;;) {
    const at = text.indexOf('](def:', i);
    if (at < 0) break;
    const open = text.lastIndexOf('[', at);
    if (open < i) { res += text.slice(i, at + 6); i = at + 6; continue; }
    let depth = 1, j = at + 2;
    for (; j < text.length && depth > 0; j++) { if (text[j] === '(') depth++; else if (text[j] === ')') depth--; }
    if (depth) break;
    const term = text.slice(open + 1, at), body = text.slice(at + 6, j - 1).trim();
    out.push(`<span class="mn-def"><button type="button" class="mn-def-term" aria-expanded="false">${math_html(term, o)}</button><span class="mn-def-body" hidden>${math_html(body, o)}</span></span>`);
    res += text.slice(i, open) + DEF_MARK + (out.length - 1) + DEF_END;
    i = j;
  }
  return res + text.slice(i);
}

export function math_html(text: string, o: MarkupOptions = {}): string {
  if (text.includes('](def:')) {
    const defs: string[] = [];
    const lifted = lift_definitions(text, o, defs);
    // (what is left is text without definitions: one written unclosed stays as written)
    return fenced_html(lifted, o).replace(new RegExp(`${DEF_MARK}(\\d+)${DEF_END}`, 'g'), (_m, k: string) => defs[+k]);
  }
  return fenced_html(text, o);
}

function fenced_html(text: string, o: MarkupOptions): string {
  if (!text.includes('```')) return prose_math_html(text, o);
  const out: string[] = [];
  let at = 0;
  for (const m of text.matchAll(STEPS_FENCE)) {
    if (m.index! > at) out.push(prose_math_html(text.slice(at, m.index).replace(/\s+$/, ''), o));
    out.push(steps_html(m[1], m[2] === '```'));
    at = m.index! + m[0].length;
    if (!m[0].length) break;
  }
  if (at < text.length) out.push(prose_math_html(text.slice(at).replace(/^\s+/, ''), o));
  return out.join('');
}

function prose_math_html(text: string, o: MarkupOptions = {}): string {
  return text
    .split(/(`[^`\n]+`)/g)
    .map((chunk) => {
      if (/^`[^`\n]+`$/.test(chunk)) return `<code>${esc(chunk.slice(1, -1))}</code>`;
      const parts = mark_bold_math(chunk.replaceAll('\\$', DOLLAR)).split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
      const out: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        const m = /^\$\$([^$]+)\$\$$|^\$([^$]+)\$$/.exec(parts[i]);
        if (!m) {
          out.push(prose_html(parts[i], o));
          continue;
        }
        let html = tex_html((m[1] ?? m[2]).replaceAll(DOLLAR, '\\$'), !!m[1]);
        if (!m[1]) {
          // inline math: glue the punctuation around it so the line cannot break between them
          const before = CJK_OPEN.exec(parts[i - 1] ?? '')?.[0] ?? '';
          const after = CJK_CLOSE.exec(parts[i + 1] ?? '')?.[0] ?? '';
          if (before || after) {
            if (before) out[out.length - 1] = prose_html(parts[i - 1].slice(0, -before.length), o);
            if (after) parts[i + 1] = parts[i + 1].slice(after.length);
            html = `<span class="mn-nowrap">${esc(before)}${html}${esc(after)}</span>`;
          }
        }
        out.push(html);
      }
      return out.join('').replaceAll(B_OPEN, '<b>').replaceAll(B_CLOSE, '</b>').replaceAll(DOLLAR, '$');
    })
    .join('');
}
/** A displayed formula (TeX source, no dollars). */
export function display_math_html(tex: string): string {
  return tex_html(tex, true);
}
export function set_math(el: HTMLElement, text: string): void {
  el.innerHTML = math_html(text);
}

/** A formula as it is read: its TeX between dollars. */
export const formula_text = (el: HTMLElement) => (el.dataset.display !== undefined ? `$$${el.dataset.tex}$$` : `$${el.dataset.tex}$`);

/** Text as it is read, formulas as their TeX (whitespace collapsed), and where each character comes from: a text node
 *  and its offset, or a formula (offset -1). */
export function reading(root: Node): { text: string; at: { node: Node; off: number }[] } {
  let text = '';
  const at: { node: Node; off: number }[] = [];
  const add = (ch: string, node: Node, off: number) => {
    if (/\s/.test(ch)) {
      if (!text || text.endsWith(' ')) return;
      ch = ' ';
    }
    text += ch;
    at.push({ node, off });
  };
  const walk = (n: Node) => {
    for (const c of [...n.childNodes]) {
      if (c instanceof HTMLElement && c.classList.contains('mn-math') && c.dataset.tex !== undefined) for (const ch of formula_text(c)) add(ch, c, -1);
      else if (c.nodeType === 3) {
        const d = (c as Text).data; // (offsets in UTF-16 units, as ranges count them)
        for (let i = 0; i < d.length; i++) add(d[i], c, i);
      }
      else if (c instanceof Element && c.namespaceURI === 'http://www.w3.org/1999/xhtml' && !c.matches('script,style')) walk(c);
    }
  };
  walk(root);
  while (text.endsWith(' ')) {
    text = text.slice(0, -1);
    at.pop();
  }
  return { text, at };
}
