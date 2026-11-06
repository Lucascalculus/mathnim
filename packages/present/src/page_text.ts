// The text as a zone of its page (engine kernel/page.ts). Every text root - a lesson's article, a tutor's answer, a
// card - has one page, made the first time anything in it needs one (page_for), so a host that only renders text
// gets brushing, shared numbers and the light without wiring anything. The text zone:
//   - tells the page its nouns (each [word](noun:k) in it);
//   - lights the words of the noun the learner's hand is on, wherever the hand is (a word, a curve, a symbol of a
//     formula), and the word the page's light falls on;
//   - puts its numbers to drag on the page as shared values (so a figure can bind to them), and shows every number of
//     that name, and every number computed from it, when a value changes - whoever changed it.
import { Page, type NounAnchor, type Attention, type Zone } from '@mathnim/engine';
import { odometer, settled } from './tangle';
import { ui_lang } from './i18n';

/** The roots a page belongs to: the nearest of these around an element. */
const ROOTS = 'article, .mn-answer-text, .mn-card, [data-page], [data-tangle]';
const pages = new WeakMap<Element, Page>();

/** The element a page belongs to, for an element in a text. */
export function root_of(el: Element): HTMLElement {
  return (el.closest(ROOTS) as HTMLElement | null) ?? document.body;
}
/** The page of the text an element is in (made, with its text zone, the first time it is asked for). */
export function page_for(el: Element): Page {
  const root = root_of(el);
  let page = pages.get(root);
  if (!page) {
    const lang = (root.closest('[lang]')?.getAttribute('lang') ?? ui_lang()).startsWith('zh') ? 'zh' : 'en';
    page = new Page(lang);
    pages.set(root, page);
    // (on its root too, for the tools that drive the page headlessly and the tests: page_shots, the browser checks)
    (root as HTMLElement & { mn_page?: Page }).mn_page = page;
    page.attach(text_zone(root, page));
  }
  return page;
}
/** The page of a root, if it has one already. */
export const page_of = (root: Element): Page | undefined => pages.get(root);

export interface TextZone extends Zone {
  readonly root: HTMLElement;
}

export function text_zone(root: HTMLElement, page: Page): TextZone {
  let lit: HTMLElement | null = null;
  const words = () => [...root.querySelectorAll<HTMLElement>('.mn-noun[data-noun]')];
  // the numbers to drag become the page's values (with their range and step), so a figure can bind to them
  register_numbers(root, page);
  const off = page.on((e) => {
    if (e.type === 'value') show_numbers(root, page, e.name, e.value);
  });
  return {
    id: 'text',
    kind: 'text',
    root,
    anchors: (): NounAnchor[] => words().map((w, i) => ({ noun: w.dataset.noun!, id: `w${i}`, size: 1e6 + i })),
    attend(a: Attention) {
      for (const w of words()) w.classList.toggle('mn-lit', !!a.hover && w.dataset.noun === a.hover);
      const here = a.light?.zone === 'text' ? words()[+a.light.id.slice(1)] ?? null : null;
      if (lit !== here) {
        lit?.classList.remove('mn-light');
        here?.classList.add('mn-light');
        lit = here;
      }
    },
    describe: () => words().map((w, i) => `w${i} noun:${w.dataset.noun} "${w.textContent}"`).join('\n'),
    dispose: () => off(),
  };
}

/** Put a root's numbers to drag on its page (those already there keep their value: the page is the truth). */
export function register_numbers(root: ParentNode, page: Page): void {
  root.querySelectorAll<HTMLElement>('.mn-num-in[data-var]').forEach((n) => {
    const name = n.dataset.var!, had = page.values.has(name);
    const p = page.value(name, +n.dataset.value!, { range: [+n.dataset.min!, +n.dataset.max!], step: +n.dataset.step! });
    if (had && p.peek() !== +n.dataset.value!) show_numbers(root, page, name, p.peek());
  });
}
/** Show a value everywhere it is written in the root, and every computed number (they may read it). */
export function show_numbers(root: ParentNode, page: Page, name: string, v: number): void {
  root.querySelectorAll<HTMLElement>(`.mn-num-in[data-var="${CSS.escape(name)}"]`).forEach((n) => {
    if (n.classList.contains('mn-held')) return; // (the one in the hand draws itself)
    n.innerHTML = odometer(v, +n.dataset.dec!, +(n.dataset.digits ?? 1));
    n.dataset.value = String(+v.toFixed(10));
    n.setAttribute('aria-valuenow', n.dataset.value);
  });
  root.querySelectorAll<HTMLElement>('.mn-num-out[data-expr]').forEach((n) => {
    const x = page.formula(n.dataset.expr!).value;
    if (!Number.isFinite(x)) { n.textContent = '…'; return; }
    const dec = +n.dataset.dec!, r = settled(x, dec);
    n.innerHTML = odometer(r, dec, Math.max(1, Math.floor(Math.log10(Math.max(1, Math.abs(Math.round(r))))) + 1));
  });
}
