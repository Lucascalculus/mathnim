// Glass (凝结玻璃; specimen fx 'condense'): a pane that answers a tap. It is simply there, a pane of clear glass beside
// what was tapped, with what it says on it: no animation in, nothing computed while it is open (no droplets, no blur:
// Lucas, 2026-11-07, "直接浮现…不要实时算高斯模糊"). It is glass because it is held by your hand: tap anywhere else,
// or Esc, and it is gone. Clear, not frosted. Used for a source behind a footnote marker; open to any short answer to
// a tap.
//
//   condense(html, { x, y }, anchor_rect)   →  { el, close() }
import { define_effect, t } from '@mathnim/engine';

let current: { el: HTMLElement; close: () => void; key?: string } | null = null;

/** Close the pane that is open, if any. */
export function evaporate(): void {
  current?.close();
}

/** A glass pane with `html` on it next to `near` (the thing tapped; `_from`, where the finger was, is kept for callers). */
export function condense(html: string, _from: { x: number; y: number }, near: DOMRect, o: { key?: string; width?: number } = {}): { el: HTMLElement; close: () => void } {
  // a second tap on the same thing closes it
  if (current && o.key && current.key === o.key) {
    current.close();
    return { el: document.createElement('div'), close: () => {} };
  }
  current?.close();
  const el = document.createElement('div');
  el.className = 'mn-glass';
  el.setAttribute('role', 'note');
  el.innerHTML = html;
  document.body.append(el);
  // where it forms: under the thing tapped (above it near the bottom of the screen), inside the viewport
  const vw = document.documentElement.clientWidth, vh = window.innerHeight, W = Math.min(o.width ?? 360, vw - 24);
  el.style.width = `${W}px`;
  const H = el.offsetHeight, below = near.bottom + 10 + H < vh - 8;
  const left = Math.max(12, Math.min(vw - W - 12, near.left + near.width / 2 - W / 2)), top = below ? near.bottom + 10 : Math.max(8, near.top - 10 - H);
  el.style.left = `${left + scrollX}px`;
  el.style.top = `${top + scrollY}px`;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add('mn-glass-out');
    setTimeout(() => el.remove(), 180);
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', esc);
    if (current?.el === el) current = null;
  };
  const outside = (e: PointerEvent) => { if (!el.contains(e.target as Node)) close(); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  setTimeout(() => {
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', esc);
  }, 0);
  current = { el, close, key: o.key };
  return current;
}

define_effect({ name: 'condense', says: t('a pane of clear glass, simply there beside what was tapped', '一块清透的玻璃，直接出现在点的地方旁边'), zones: ['text'], maturity: 'stable', since: '0.2.1', from: 'motion/condense', syntax: '[^key]', accept: t('there at once, nothing computed while it is open; not frosted', '立即出现，打开时不做任何计算；不磨砂'), source: 'packages/present/src/glass.ts' });
