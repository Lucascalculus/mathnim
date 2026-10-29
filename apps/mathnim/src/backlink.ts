// The way back to the page above: "‹" and the words; pointed at, more arrows and a frame of crop marks
// (styles in shell.ts, .backlink).
import { esc } from '@mathnim/present';

const ARROW = '<svg viewBox="0 0 6 10" aria-hidden="true"><path d="M5 1 1 5l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** A back link to `href` named `label` (plain text); `arrows: false` keeps only the words and the frame. */
export const backlink = (href: string, label: string, cls = '', arrows = true) =>
  `<a class="backlink${cls ? ` ${cls}` : ''}" href="${esc(href)}">${arrows ? `<span class="bk-arrows" aria-hidden="true"><i>${ARROW}</i><i>${ARROW}</i><i>${ARROW}</i></span>` : ''}<span>${esc(label)}</span><b></b><b></b><b></b><b></b></a>`;
