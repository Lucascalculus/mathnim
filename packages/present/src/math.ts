// Text with inline TeX (`$...$`) in DOM elements. The TeX renderer is
// pluggable (the app passes manim-web's MathJax adapter); without one the
// TeX source is shown.
//
// Light markup (the prose of lessons and AI answers): $inline$ and $$display$$
// TeX, **bold**, *italic*, `code`, [text](https://link) and footnote
// references [^key] (when the caller passes `footnote`).
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

/** Prose without TeX: escaped, then links, footnotes, bold, italic, line breaks. */
function prose_html(text: string, o: MarkupOptions): string {
  let s = esc(text);
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

/** HTML for text containing $inline$ and $$display$$ TeX (or \( \) and \[ \]); **bold**, *italic*, `code` and [links](url) are supported. */
export function math_html(text: string, o: MarkupOptions = {}): string {
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
