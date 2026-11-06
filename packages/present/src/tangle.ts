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
// The numbers of one page (or one answer) share their names.

const TANGLE = /\{\{\s*(?:([A-Za-z_][\w]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(?:step\s*)?(\d+(?:\.\d+)?))?|=\s*([^{}]+?)(?:\s*,\s*(\d))?)\s*\}\}/g;
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
    try { value = eval_expr(src, scope); } catch { /* shown as … until the numbers it reads are known */ }
    const decimals = dec !== undefined ? +dec : Number.isFinite(value) && !Number.isInteger(+value.toFixed(6)) ? 2 : 0;
    return `<span class="mn-num mn-num-out" data-expr="${attr(src)}" data-dec="${decimals}">${Number.isFinite(value) ? odometer(value, decimals, int_digits(value)) : '…'}</span>`;
  });
}

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

// ---------------------------------------------------------------- a small, safe expression language
const FUNCS: Record<string, (...a: number[]) => number> = { sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, log: Math.log, ln: Math.log, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan };
/** + − * / ^ ( ), numbers, names from `vars`, pi, and the functions above. Throws on anything else. */
export function eval_expr(src: string, vars: Map<string, number>): number {
  const s = src.replace(/×|·/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  let i = 0;
  const ws = () => { while (s[i] === ' ') i++; };
  const num = (): number => {
    ws();
    if (s[i] === '(') { i++; const v = add(); ws(); if (s[i++] !== ')') throw new Error('expected )'); return v; }
    if (s[i] === '-') { i++; return -pow(); }
    if (s[i] === '+') { i++; return pow(); }
    const m = /^\d+(?:\.\d+)?|^\.\d+/.exec(s.slice(i));
    if (m) { i += m[0].length; return +m[0]; }
    const w = /^[A-Za-z_]\w*/.exec(s.slice(i));
    if (!w) throw new Error(`unexpected ${s[i] ?? 'end'}`);
    i += w[0].length;
    ws();
    if (FUNCS[w[0]] && s[i] === '(') {
      i++;
      const args = [add()];
      ws();
      while (s[i] === ',') { i++; args.push(add()); ws(); }
      if (s[i++] !== ')') throw new Error('expected )');
      return FUNCS[w[0]](...args);
    }
    if (w[0] === 'pi') return Math.PI;
    if (!vars.has(w[0])) throw new Error(`unknown ${w[0]}`);
    return vars.get(w[0])!;
  };
  const pow = (): number => { const b = num(); ws(); if (s[i] === '^') { i++; return b ** pow(); } return b; };
  const mul = (): number => { let v = pow(); for (;;) { ws(); if (s[i] === '*') { i++; v *= pow(); } else if (s[i] === '/') { i++; v /= pow(); } else return v; } };
  const add = (): number => { let v = mul(); for (;;) { ws(); if (s[i] === '+') { i++; v += mul(); } else if (s[i] === '-') { i++; v -= mul(); } else return v; } };
  const v = add();
  ws();
  if (i < s.length) throw new Error(`unexpected ${s[i]}`);
  return v;
}

// ---------------------------------------------------------------- the hand
/** The numbers that share names with `el`: those of its page (or answer). */
const scope_of = (el: HTMLElement): ParentNode => el.closest('article, .mn-answer-text, .mn-card, [data-tangle]') ?? document;
function show(el: HTMLElement, v: number): void {
  el.innerHTML = odometer(v, +el.dataset.dec!, +(el.dataset.digits ?? int_digits(v)));
}
/** Every computed number in the scope, from the numbers to drag as they are now (`live`: values mid-drag). */
function recompute(root: ParentNode, live?: Map<string, number>): void {
  const vars = new Map<string, number>();
  root.querySelectorAll<HTMLElement>('.mn-num-in').forEach((n) => vars.set(n.dataset.var!, +n.dataset.value!));
  if (live) for (const [k, v] of live) vars.set(k, v);
  root.querySelectorAll<HTMLElement>('.mn-num-out').forEach((n) => {
    try {
      const v = eval_expr(n.dataset.expr!, vars);
      n.innerHTML = odometer(v, +n.dataset.dec!, int_digits(v));
    } catch {
      n.textContent = '…';
    }
  });
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
    const root = scope_of(el);
    el.classList.add('mn-held');
    el.setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const v = Math.max(min, Math.min(max, v0 + ((ev.clientX - x0) / per) * step));
      show(el, v);
      recompute(root, new Map([[el.dataset.var!, v]]));
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('mn-held');
      const raw = Math.max(min, Math.min(max, v0 + ((ev.clientX - x0) / per) * step));
      set_value(el, raw);
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
/** Let go: the number settles on its step (the wheels roll there), and the numbers that follow it settle with it. */
function set_value(el: HTMLElement, raw: number): void {
  const min = +el.dataset.min!, max = +el.dataset.max!, step = +el.dataset.step!;
  const to = Math.max(min, Math.min(max, min + Math.round((raw - min) / step) * step)), from = raw, root = scope_of(el);
  const t0 = performance.now(), dur = 160;
  const tick = () => {
    const u = Math.min(1, (performance.now() - t0) / dur), v = from + (to - from) * (1 - (1 - u) ** 3);
    show(el, u < 1 ? v : to);
    recompute(root, new Map([[el.dataset.var!, u < 1 ? v : to]]));
    if (u < 1) requestAnimationFrame(tick);
  };
  el.dataset.value = String(+to.toFixed(10));
  el.setAttribute('aria-valuenow', el.dataset.value);
  requestAnimationFrame(tick);
}
