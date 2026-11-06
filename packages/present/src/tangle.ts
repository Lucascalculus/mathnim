// Numbers you drag, with rolling digits (the text zone; specimen gpu/int/tangle.js, after Bret Victor's Tangle). A
// number in a sentence is a handle: drag it sideways and the numbers that depend on it follow. Every number is an
// odometer: each digit is a wheel, and a wheel turns only while the one below it passes from 9 to 0, so carries are
// seen. At rest every wheel sits on a digit and the number reads its value exactly. The number you can drag is glass
// (your hand); the ones that follow are ink.
//
// In any prose, as a model writes it most easily:
//   You buy {{n = 3, 1..12}} cups at $2.50: that is {{= 2.5*n, 2}} dollars.
//   {{name = value, min..max}}  or  {{name = value, min..max, step}}   a number to drag
//   {{= expression}}  or  {{= expression, decimals}}                     a number computed from the others
// Names are words (cups, rate, n); expressions use + − * / ^ ( ) and sqrt, abs, round, min, max, log, exp, sin, cos.
// The numbers of one page (or one answer) share their names: they are the page's shared values (page_text.ts), so a
// figure can bind to them. This file is DOM-free (the server checks markup with its pattern); the hand that drags a
// number is tangle_hand.ts.

import { eval_expr as eval_expr_ } from '../../engine/src/kernel/expr';

export const TANGLE = /\{\{\s*(?:([A-Za-z_][\w]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(?:step\s*)?(\d+(?:\.\d+)?))?|=\s*([^{}]+?)(?:\s*,\s*(\d))?)\s*\}\}/g;
/** What the numbers written so far are (while one text is turned into HTML), so a computed number shows its value at once. */
let scope = new Map<string, number>();
export function tangle_reset(): void {
  scope = new Map();
}
const dec_of = (s: string) => (s.includes('.') ? s.split('.')[1].length : 0);
const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/\*/g, '&#42;');

/** Prose (already escaped) with its {{…}} numbers as HTML. */
export function tangle_html(s: string): string {
  if (!s.includes('{{')) return s;
  return s.replace(TANGLE, (_m, name: string | undefined, v: string, lo: string, hi: string, step: string | undefined, expr: string | undefined, dec: string | undefined) => {
    if (name) {
      const value = +v, min = Math.min(+lo, +hi), max = Math.max(+lo, +hi), st = step ? +step : Math.max(dec_of(v), dec_of(lo), dec_of(hi)) ? 10 ** -Math.max(dec_of(v), dec_of(lo), dec_of(hi)) : 1;
      const decimals = Math.max(dec_of(v), dec_of(String(st)));
      scope.set(name, value);
      const digits = Math.max(int_digits(min), int_digits(max));
      return `<span class="mn-num mn-num-in" role="slider" tabindex="0" aria-label="${attr(name)}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}" data-var="${attr(name)}" data-min="${min}" data-max="${max}" data-step="${st}" data-dec="${decimals}" data-digits="${digits}" data-value="${value}">${odometer(value, decimals, digits)}</span>`;
    }
    const src = (expr ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    let value = NaN;
    try { value = eval_expr_(src, scope); } catch { /* shown as … until the numbers it reads are known */ }
    const decimals = dec !== undefined ? +dec : Number.isFinite(value) && !Number.isInteger(+value.toFixed(6)) ? 2 : 0;
    const r = settled(value, decimals);
    return `<span class="mn-num mn-num-out" data-expr="${attr(src)}" data-dec="${decimals}">${Number.isFinite(r) ? odometer(r, decimals, int_digits(r)) : '…'}</span>`;
  });
}

/**
 * A computed number rounded to its places (it is not moving): the odometer turns the lowest wheel by what is below
 * it, which on a number at rest reads as a misprint (2.828… would stop half way between 2 and 3).
 */
export const settled = (v: number, decimals: number): number => Math.round(v * 10 ** decimals) / 10 ** decimals;
const int_digits = (v: number) => Math.max(1, Math.floor(Math.log10(Math.max(1, Math.abs(Math.round(v))))) + 1);
/**
 * A number as wheels: each digit place a reel of 0-9 (and 0 again) turned to its position. The lowest place turns
 * with the value; a higher place turns only while the one below it passes from 9 to 0 (an odometer's carry).
 */
export function odometer(v: number, decimals: number, digits: number): string {
  const neg = v < 0 && Math.abs(v) >= 0.5 * 10 ** -decimals, V = Math.abs(v) * 10 ** decimals;
  const places = Math.max(digits + decimals, int_digits(Math.abs(v)) + decimals);
  const pos: number[] = [];
  for (let q = 0; q < places; q++) {
    const x = V / 10 ** q;
    if (q === 0) pos.push(((x % 10) + 10) % 10);
    else pos.push((Math.floor(x + 1e-9) % 10) + Math.max(0, pos[q - 1] - 9));
  }
  let html = neg ? '<span class="mn-num-sign">−</span>' : '';
  for (let q = places - 1; q >= 0; q--) {
    // (leading zeros of the integer part are blank, except the units)
    const lead = q > decimals && Math.floor(V / 10 ** q + 1e-9) === 0 && pos[q] < 0.02;
    html += `<span class="mn-dg${lead ? ' mn-dg-lead' : ''}"><span class="mn-reel" style="transform:translateY(${(-pos[q] * 1.25).toFixed(3)}em)">${REEL}</span></span>`;
    if (q === decimals && decimals > 0) html += '<span class="mn-num-dot">.</span>';
  }
  return html;
}
const REEL = '<i>0</i><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i><i>7</i><i>8</i><i>9</i><i>0</i>';

// (the expression language is the engine's: a page's formulas and a sentence's computed numbers read alike)
export { eval_expr } from '../../engine/src/kernel/expr';
