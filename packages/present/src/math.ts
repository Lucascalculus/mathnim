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
      return `<span class="mn-math"${display ? ' style="display:block;text-align:center"' : ''}>${renderer(tex, display)}</span>`;
    } catch {
      /* fall through */
    }
  }
  return `<code>${esc(tex)}</code>`;
}

/** HTML for text containing $inline$ and $$display$$ TeX; **bold**, *italic*, `code` and [links](url) are supported. */
export function math_html(text: string, o: MarkupOptions = {}): string {
  return text
    .split(/(`[^`\n]+`)/g)
    .map((chunk) => {
      if (/^`[^`\n]+`$/.test(chunk)) return `<code>${esc(chunk.slice(1, -1))}</code>`;
      return chunk
        .split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g)
        .map((part) => {
          const m = /^\$\$([^$]+)\$\$$|^\$([^$]+)\$$/.exec(part);
          if (!m) return prose_html(part, o);
          return tex_html(m[1] ?? m[2], !!m[1]);
        })
        .join('');
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
