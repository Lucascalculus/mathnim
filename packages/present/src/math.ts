// Text with inline TeX (`$...$`) in DOM elements. The TeX renderer is
// pluggable (the app passes manim-web's MathJax adapter); without one the
// TeX source is shown.
//
// Light markup (the prose of lessons and AI answers): $inline$ and $$display$$
// TeX, **bold**, *italic*, `code`, [text](https://link) and footnote
// references [^key] (when the caller passes `footnote`).
import { look, text_color_of } from '@mathnim/look';
import { chain_html, parse_chain } from './chain';
import { tangle_html, tangle_reset } from './tangle';
import { fence_entry, fence_names, markup_entries, type MarkupCtx } from './markup';
/** A block of a formula and what it means, with the blocks it is made of (its next layer). */
export interface PartText { tex: string; says: string; html?: string; parts?: PartText[] }
/**
 * A ```parts fence: the formula on its first line, then `piece: what it means` lines; a piece indented under another
 * (two spaces, or a tab, per layer) is one of the blocks that piece is made of. A `% nouns: A = hypothesis` line
 * colours a symbol as its noun, in the formula and in the words.
 */
export function parse_parts(body: string): { tex: string; parts: PartText[]; nouns: Record<string, string> } | null {
  const lines = body.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return null;
  const tex = lines[0].trim().replace(/^\$+|\$+$/g, '');
  const roots: PartText[] = [], stack: { depth: number; part: PartText }[] = [], nouns: Record<string, string> = {};
  for (const raw of lines.slice(1)) {
    const nl = /^\s*%\s*(?:nouns?|名词)\s*[:：]\s*(.*)$/i.exec(raw);
    if (nl) {
      for (const one of nl[1].split(/[,，;；]/)) { const q = /^\s*\$?(.+?)\$?\s*[=:：→]\s*([a-z][\w-]*)\s*$/i.exec(one); if (q) nouns[q[1].trim()] = q[2].toLowerCase(); }
      continue;
    }
    const m = /^(\s*)[-*]?\s*\$?(.+?)\$?\s*[:：]\s+(.+)$/.exec(raw.replace(/\t/g, '  '));
    if (!m) continue;
    const depth = Math.floor(m[1].length / 2), part: PartText = { tex: m[2].trim(), says: m[3].trim() };
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack[stack.length - 1]?.part;
    if (parent) (parent.parts ??= []).push(part);
    else roots.push(part);
    stack.push({ depth, part });
  }
  return roots.length ? { tex, parts: roots, nouns } : null;
}
/**
 * A formula taken apart as the page shows it before it can play: the formula, and each block with what it means, its
 * own blocks under it (mount_parts turns it into the engine's). `view` (the fence's word, ```parts 3d): '3d' takes it
 * apart in depth, for a lesson's key formula; else in the plane.
 */
export function parts_html(tex: string, parts: PartText[], o: { view?: string; nouns?: Record<string, string> } = {}): string {
  const strip = (ps: PartText[]): unknown[] => ps.map((p) => ({ tex: p.tex, says: p.says, ...(p.parts?.length ? { parts: strip(p.parts) } : {}) }));
  const list = (ps: PartText[]): string => `<dl class="mn-parts-list">${ps.map((p) => `<div><dt>${tex_html(p.tex, false)}</dt><dd>${p.html ?? esc(p.says)}${p.parts?.length ? list(p.parts) : ''}</dd></div>`).join('')}</dl>`;
  const data = { tex, parts: strip(parts), ...(o.view === '3d' ? { view: o.view } : {}), ...(o.nouns && Object.keys(o.nouns).length ? { nouns: o.nouns } : {}) };
  return `<div class="mn-parts" data-parts="${esc(JSON.stringify(data))}"><div class="mn-parts-tex">${tex_html(tex, true)}</div>${list(parts)}</div>`;
}
/** Details folded under the sentence, unfolded like paper (text_wire.ts): a head, and each leaf a sheet. */
export function fold_html(head: string, leaves: string[]): string {
  return `<div class="mn-fold"><button type="button" class="mn-fold-head" aria-expanded="false"><span>${head}</span></button><div class="mn-fold-body" hidden>${leaves.map((l) => `<div class="mn-fold-leaf">${l}</div>`).join('')}</div></div>`;
}
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
  /**
   * A single letter in bold is a symbol, set as math (**x** is how a model writes the vector $\mathbf{x}$): for the
   * tutor's answers, not a lesson's text (where **D**ialogue may spell an acronym).
   */
  bold_symbols?: boolean;
}

/** Only web, mail, in-page and relative links (never javascript: and the like). */
function safe_url(url: string): string | null {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u) || /^[#/.]/.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null;
  return u;
}

/** Prose without TeX: escaped, then numbers to drag, nouns, links, footnotes, bold, italic, line breaks. */
function prose_html(text: string, o: MarkupOptions): string {
  let s = tangle_html(esc(text));
  // a noun: the word in its noun's colour, as the thing it names is drawn in the figure ([cost](noun:cost))
  s = s.replace(/\[([^\]]+)\]\(noun:([\w-]+)\)/g, (_m, label: string, key: string) => `<span class="mn-noun" data-noun="${key}" style="color:${text_color_of(`noun:${key}`, look())}">${label}</span>`);
  s = s.replace(/\[\^([\w.:-]+)\]/g, (_, key: string) => (o.footnote ? o.footnote(key) : ''));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const u = safe_url(url.replace(/&amp;/g, '&').replace(/&#39;/g, "'"));
    return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${label}</a>` : label;
  });
  // (inline tools added by a file: each its pattern on the escaped prose; a renderer that gives up leaves the text as it is)
  for (const e of markup_entries()) {
    if (e.form !== 'inline' || !e.pattern || !e.html) continue;
    s = s.replace(e.pattern, (m0: string, g1?: unknown) => e.html!(m0, typeof g1 === 'string' ? g1 : '', ctx_of(o)) ?? m0);
  }
  return s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/\n/g, '<br>');
}
/** What a tool added by a file gets to render with (markup/registry.ts). */
function ctx_of(o: MarkupOptions, closed = true): MarkupCtx {
  return { closed, prose: (s) => prose_math_html(s, o), text: (s) => math_html_in(s, o), tex: tex_html, esc };
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

/** "\$" is a literal dollar in prose (it starts no math); inside math it stays TeX's own \$. */
const DOLLAR = '\u0004';
/**
 * A formula stands in the prose as one private mark (M0 index M1) while the light markup is read, so markup that
 * runs over a formula (**the rank of $BA$ is at most $r$**) or a star inside one (**$x^*$ is optimal**) reads right.
 */
const M0 = '\uE000', M1 = '\uE001';
const FORMULA = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
/**
 * \( \) and \[ \] (as models often write TeX) become $ $ and $$ $$; only outside the formulas already in dollars,
 * where TeX's own \\[2pt] lives.
 */
function dollar_delimiters(chunk: string): string {
  if (!chunk.includes('\\(') && !chunk.includes('\\[')) return chunk;
  return chunk
    .split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g)
    .map((p, i) => (i % 2 ? p : p.replace(/\\\[([\s\S]+?)\\\]/g, (_m, tex: string) => '$$' + tex + '$$').replace(/\\\(([\s\S]+?)\\\)/g, (_m, tex: string) => '$' + tex + '$')))
    .join('');
}
// (the marks around a formula, as classes: what may sit before it, what after it)
const PLACED = new RegExp(`(${CJK_OPEN.source.slice(0, -1)})?${M0}(\\d+)${M1}(${CJK_CLOSE.source.slice(1)})?`, 'g');

/**
 * A ```steps block (a derivation, one TeX line per step, `% words` for what was done) becomes a column of displayed
 * formulas with their reasons: readable as it is, and turned into the engine's formula steps by mount_steps() where
 * the page can play them. A block still arriving (an answer streaming in) shows nothing yet.
 */
/** A derivation's lines as the column of formulas mount_steps() turns into the engine's (a steps block of a page). */
export function steps_rows_html(rows: { tex: string; why?: string }[], nouns?: Record<string, string>): string {
  const named = nouns && Object.keys(nouns).length ? `% nouns: ${Object.entries(nouns).map(([k, v]) => `${k} = ${v}`).join(', ')}\n` : '';
  const body = named + rows.map((r) => `${r.tex}${r.why ? ` % ${r.why}` : ''}`).join('\n');
  const html = rows.map((r) => `<div class="mn-step">${tex_html(r.tex, true)}${r.why ? `<div class="mn-step-why">${prose_math_html(r.why)}</div>` : ''}</div>`).join('');
  return `<div class="mn-steps" data-steps="${esc(body)}">${html}</div>`;
}
function steps_html(body: string, closed: boolean): string {
  if (!closed) return '<div class="mn-steps mn-steps-wait"></div>';
  const rows: { tex: string; why: string }[] = [];
  for (const raw of body.split('\n')) {
    let l = raw.trim(), why = '';
    if (/^%\s*(?:nouns?|名词)\s*[:：]/i.test(l)) continue; // (the symbols it names by noun: for the engine's drawing)
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

let depth = 0;
/** HTML for text containing $inline$ and $$display$$ TeX (or \( \) and \[ \]); **bold**, *italic*, `code` and [links](url) are supported. */
export function math_html(text: string, o: MarkupOptions = {}): string {
  // (the numbers of one text share their names: a computed number shows its value from the ones written before it)
  if (!depth) tangle_reset();
  depth++;
  try {
    return math_html_in(text, o);
  } finally {
    depth--;
  }
}
function math_html_in(text: string, o: MarkupOptions): string {
  if (text.includes('](def:')) {
    const defs: string[] = [];
    const lifted = lift_definitions(text, o, defs);
    // (what is left is text without definitions: one written unclosed stays as written)
    return fenced_html(lifted, o).replace(new RegExp(`${DEF_MARK}(\\d+)${DEF_END}`, 'g'), (_m, k: string) => defs[+k]);
  }
  return fenced_html(text, o);
}

/**
 * The fences a text may hold, each turned into its own piece of the text zone: ```steps (a derivation written line by
 * line), ```why (a claim and its chain of reasons), ```details Summary (more, folded under the sentence).
 */
const BUILT_IN = new Set(['steps', 'why', 'details', 'parts']);
let fence_re: { names: string; re: RegExp } | null = null;
/** The fences a text may hold: the built-in ones and every one a file added (markup/registry.ts). */
function fences(): RegExp {
  const names = [...new Set([...BUILT_IN, ...fence_names()])].join('|');
  if (fence_re?.names !== names) fence_re = { names, re: new RegExp('```[ \\t]*(' + names + ')([^\\n]*)\\n([\\s\\S]*?)(```|$)', 'g') };
  return fence_re.re;
}
function fenced_html(text: string, o: MarkupOptions): string {
  if (!text.includes('```')) return prose_math_html(text, o);
  const out: string[] = [];
  let at = 0;
  for (const m of text.matchAll(fences())) {
    if (m.index! > at) out.push(prose_math_html(text.slice(at, m.index).replace(/\s+$/, ''), o));
    const closed = m[4] === '```', body = m[3];
    if (m[1] === 'steps') out.push(steps_html(body, closed));
    else if (!closed) out.push('<div class="mn-steps mn-steps-wait"></div>');
    else if (!BUILT_IN.has(m[1])) out.push(fence_entry(m[1])?.html?.(body, m[2].trim(), ctx_of(o, closed)) ?? prose_math_html(body, o));
    else if (m[1] === 'parts') {
      const p = parse_parts(body);
      const html_of = (ps: PartText[]): PartText[] => ps.map((x) => ({ ...x, html: prose_math_html(x.says, o), parts: x.parts && html_of(x.parts) }));
      out.push(p ? parts_html(p.tex, html_of(p.parts), { view: m[2].trim(), nouns: p.nouns }) : prose_math_html(body, o));
    } else if (m[1] === 'why') {
      const c = parse_chain(body, (s) => prose_math_html(s, o));
      out.push(c ? chain_html(c) : prose_math_html(body, o));
    } else out.push(fold_html(prose_math_html(m[2].trim() || '…', o), body.split(/\n\s*\n/).filter((x) => x.trim()).map((x) => math_html_in(x.trim(), o))));
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
      const formulas: { tex: string; display: boolean }[] = [];
      const mark = (tex: string, display: boolean) => `${M0}${formulas.push({ tex, display }) - 1}${M1}`;
      const prose = dollar_delimiters(chunk.replaceAll('\\$', DOLLAR))
        .replace(FORMULA, (_m, d: string | undefined, i: string | undefined) => mark(d ?? i!, d !== undefined))
        // a symbol set in bold (**x**: a vector, as a model writes it) is math, as $\mathbf{x}$ would be
        .replace(o.bold_symbols ? /\*\*([A-Za-z])\*\*(?![A-Za-z])/g : /(?!)/g, (_m, s: string) => mark(`\\mathbf{${s}}`, false));
      return prose_html(prose, o)
        // inline math glues the punctuation around it, so the line cannot break between them
        .replace(PLACED, (_m, before: string | undefined, k: string, after: string | undefined) => {
          const f = formulas[+k], html = tex_html(f.tex.replaceAll(DOLLAR, '\\$'), f.display);
          return !f.display && (before || after) ? `<span class="mn-nowrap">${before ?? ''}${html}${after ?? ''}</span>` : `${before ?? ''}${html}${after ?? ''}`;
        })
        .replaceAll(DOLLAR, '$');
    })
    .join('');
}

/**
 * Text still streaming in: a formula not yet closed ($…, $$…, \(…, \[…) stays hidden until it closes, and a bold not
 * yet closed shows its words without the stars (they come in a moment).
 */
export function partial_math_html(s: string, o: MarkupOptions = {}): string {
  const masked = s.replace(/\\\$/g, '  ').replace(/\$\$[^$]+\$\$|\$[^$]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g, (m) => ' '.repeat(m.length));
  const open = masked.search(/\$|\\\(|\\\[/);
  // (the end may be half of something: the backslash of \( or \[, one star of two)
  const cut = (open >= 0 ? masked.slice(0, open) : masked).replace(/\\$|(?<!\*)\*$/, '').length;
  let shown = s.slice(0, cut);
  // a bold whose closing stars have not come: its opening stars wait with them
  const stars = [...masked.slice(0, cut).matchAll(/\*\*/g)];
  if (stars.length % 2) shown = shown.slice(0, stars[stars.length - 1].index) + shown.slice(stars[stars.length - 1].index + 2);
  return math_html(shown, o);
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
