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
  return `<code>${esc(tex)}</code>`;
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

export function math_html(text: string, o: MarkupOptions = {}): string {
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
