// The way back to the page above: three arrows, then the words, which crop marks frame when pointed at
// (styles in shell.ts, .backlink).
import { esc } from '@mathnim/present';

const ARROW = '<svg viewBox="0 0 6 10" aria-hidden="true"><path d="M5 1 1 5l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** A back link to `href` named `label` (plain text). */
export const backlink = (href: string, label: string, cls = '') =>
  `<a class="backlink${cls ? ` ${cls}` : ''}" href="${esc(href)}"><span class="bk-arrows" aria-hidden="true"><i>${ARROW}</i><i>${ARROW}</i><i>${ARROW}</i></span><span class="bk-label">${esc(label)}<b></b><b></b><b></b><b></b></span></a>`;
