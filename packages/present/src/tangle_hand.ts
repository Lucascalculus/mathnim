// The hand on a number in a sentence (tangle.ts draws it). Dragging sideways (or the arrow keys) sets the page's shared
// value of that name (page_text.ts): the number in the hand rolls with the pointer, every other number of that name and
// every number computed from it follow, and a figure bound to it moves. Let go and it settles on its step.
import { odometer } from './tangle';
import { page_for, register_numbers } from './page_text';

const int_digits = (v: number) => Math.max(1, Math.floor(Math.log10(Math.max(1, Math.abs(Math.round(v))))) + 1);
function show(el: HTMLElement, v: number): void {
  el.innerHTML = odometer(v, +el.dataset.dec!, +(el.dataset.digits ?? int_digits(v)));
}
/** The page's value for a number in the hand (put on the page if this text has not been yet: a streamed answer). */
function value_of(el: HTMLElement) {
  const page = page_for(el);
  if (!page.values.has(el.dataset.var!)) register_numbers(el.closest('article, .mn-answer-text, .mn-card, [data-page], [data-tangle]') ?? document.body, page);
  return { page, name: el.dataset.var! };
}

let wired = false;
/** One set of listeners for every number on the page: drag sideways (or the arrow keys) to change it. */
export function wire_tangle(): void {
  if (wired || typeof document === 'undefined') return;
  wired = true;
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('.mn-num-in') as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    const min = +el.dataset.min!, max = +el.dataset.max!, step = +el.dataset.step!, v0 = +el.dataset.value!, x0 = e.clientX;
    // the whole range in about 240 px, never less than 3 px a step
    const per = Math.max(3, 240 / Math.max(1, (max - min) / step));
    const { page, name } = value_of(el);
    el.classList.add('mn-held');
    try { el.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser does not track: the listeners still see it) */ }
    const at = (ev: PointerEvent) => Math.max(min, Math.min(max, v0 + ((ev.clientX - x0) / per) * step));
    const move = (ev: PointerEvent) => {
      const v = at(ev);
      show(el, v);
      page.set(name, v);
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      set_value(el, at(ev));
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  document.addEventListener('keydown', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('.mn-num-in') as HTMLElement | null;
    if (!el || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1;
    set_value(el, +el.dataset.value! + d * +el.dataset.step!);
  });
}
/** Let go: the number settles on its step (the wheels roll there), and everything that follows it settles with it. */
function set_value(el: HTMLElement, raw: number): void {
  const min = +el.dataset.min!, max = +el.dataset.max!, step = +el.dataset.step!;
  const to = Math.max(min, Math.min(max, min + Math.round((raw - min) / step) * step)), from = raw;
  const { page, name } = value_of(el);
  const t0 = performance.now(), dur = 160;
  el.classList.add('mn-held');
  const tick = () => {
    const u = Math.min(1, (performance.now() - t0) / dur), v = u < 1 ? from + (to - from) * (1 - (1 - u) ** 3) : to;
    show(el, v);
    page.set(name, v);
    if (u < 1) requestAnimationFrame(tick);
    else {
      el.classList.remove('mn-held');
      el.dataset.value = String(+to.toFixed(10));
      el.setAttribute('aria-valuenow', el.dataset.value);
    }
  };
  requestAnimationFrame(tick);
}
