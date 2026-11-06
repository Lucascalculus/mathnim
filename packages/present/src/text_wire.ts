// The text zone's own interactions, for every page at once (one set of delegated listeners; nothing runs at rest):
//   a definition opens in its sentence (specimen gpu/int/stretch.js), a chain of why drops its reasons on threads
//   (gpu/int/why.js), details unfold like folded paper (fx 'fold'), numbers are dragged (tangle.ts), a noun touched
//   in the text lights its thing in the figure ('mn-noun' events, answered by the page's figures).
import { wire_tangle } from './tangle';

let wired = false;
export function wire_text(root: Document | HTMLElement = document): void {
  if (wired || typeof document === 'undefined') return;
  wired = true;
  wire_tangle();
  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement | null;
    const term = el?.closest?.('.mn-def-term') as HTMLElement | null;
    if (term) return toggle_def(term);
    // tapping a definition folds it back (not a term inside it: that opens its own)
    const body = el?.closest?.('.mn-def-body') as HTMLElement | null;
    if (body && !el?.closest?.('a, button, .mn-num-in')) {
      const t = body.previousElementSibling as HTMLElement | null;
      if (t?.classList.contains('mn-def-term')) return toggle_def(t);
    }
    const ring = el?.closest?.('.mn-chain-ring') as HTMLElement | null;
    if (ring) return toggle_why(ring);
    const head = el?.closest?.('.mn-fold-head') as HTMLElement | null;
    if (head) return toggle_fold(head);
  });
  // a noun in the text: its thing in the figure lights up (the page's figures listen)
  root.addEventListener('pointerover', (e) => {
    const n = (e.target as HTMLElement | null)?.closest?.('.mn-noun') as HTMLElement | null;
    if (n) n.dispatchEvent(new CustomEvent('mn-noun', { bubbles: true, detail: { key: n.dataset.noun } }));
  });
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => document.querySelectorAll<HTMLElement>('.mn-chain').forEach(draw_threads));
    ro.observe(document.body);
  }
}

// ---------------------------------------------------------------- a definition in its sentence
// Open: the definition is set right after the term, on a faint ground, and the rest of the sentence keeps its x and
// drops down by whole lines below it (a dotted leader carries the eye from the margin to where it resumes): no word
// moves sideways. Closed: everything goes back exactly.
const rests = new WeakMap<HTMLElement, { rest: HTMLElement; top: HTMLElement; space: boolean }>();
/** The block a term's sentence flows in: the nearest ancestor that is not inline. */
function flow_of(el: HTMLElement): HTMLElement {
  let p = el.parentElement!;
  while (p.parentElement && /^inline/.test(getComputedStyle(p).display)) p = p.parentElement;
  return p;
}
/** The first character of text after `node` inside `flow` (to find where the sentence resumes). */
function first_char_after(node: Node, flow: HTMLElement): Range | null {
  const w = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
  let n = w.nextNode(), past = false;
  for (; n; n = w.nextNode()) {
    if (!past) { if (node.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING && !node.contains(n)) past = true; else continue; }
    const s = n.textContent ?? '', i = s.search(/\S/);
    if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); return r; }
  }
  return null;
}
function toggle_def(term: HTMLElement): void {
  const wrap = term.parentElement as HTMLElement, body = term.nextElementSibling as HTMLElement | null;
  if (!body) return;
  const open = term.getAttribute('aria-expanded') !== 'true';
  if (!open) return close_def(term);
  const flow = flow_of(wrap), fr = flow.getBoundingClientRect();
  const left = fr.left + parseFloat(getComputedStyle(flow).paddingLeft || '0');
  // (a definition inside a definition opens in place: the sentence has already made room for the outer one)
  const nested = !!wrap.parentElement?.closest('.mn-def-body');
  let top: HTMLElement = wrap;
  while (top.parentElement && top.parentElement !== flow) top = top.parentElement;
  const next = nested ? null : first_char_after(top, flow), nr = next?.getBoundingClientRect();
  term.setAttribute('aria-expanded', 'true');
  body.hidden = false;
  body.classList.remove('mn-def-in');
  void body.offsetWidth;
  body.classList.add('mn-def-in');
  if (!next || !nr) return;
  // the rest of the sentence, taken out from where it resumes to the end of its block (inline wrappers split cleanly)
  const r = document.createRange();
  r.setStartAfter(top);
  r.setEnd(flow, flow.childNodes.length);
  const frag = r.extractContents();
  // (its leading space is the leader's: the first word lands exactly where it was)
  const tw = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
  const first = tw.nextNode() as Text | null, space = !!first && /^\s/.test(first.textContent ?? '');
  if (first) first.textContent = (first.textContent ?? '').replace(/^\s+/, '');
  const rest = document.createElement('span');
  rest.className = 'mn-def-rest';
  const x = Math.max(0, nr.left - left);
  const lead = document.createElement('span');
  lead.className = 'mn-def-lead' + (x > 28 ? ' mn-def-dots' : '');
  lead.style.width = `${x}px`;
  rest.append(lead, frag);
  flow.append(rest);
  rests.set(term, { rest, top, space });
  // the words that dropped come down from where they were
  const after = first_char_after(lead, rest)?.getBoundingClientRect();
  if (after) {
    rest.style.transform = `translateY(${nr.top - after.top}px)`;
    void rest.offsetWidth;
    rest.classList.add('mn-def-drop');
    rest.style.transform = '';
    setTimeout(() => rest.classList.remove('mn-def-drop'), 420);
  }
}
function close_def(term: HTMLElement): void {
  const body = term.nextElementSibling as HTMLElement;
  // what is open inside it folds first
  body.querySelectorAll<HTMLElement>('.mn-def-term[aria-expanded="true"]').forEach((t) => close_def(t));
  term.setAttribute('aria-expanded', 'false');
  body.hidden = true;
  const kept = rests.get(term);
  if (!kept) return;
  rests.delete(term);
  const { rest, top, space } = kept;
  rest.querySelector(':scope > .mn-def-lead')?.remove();
  const nodes = [...rest.childNodes];
  // (the space the leader stood for, where there was one: none in Chinese)
  if (space) {
    if (nodes[0]?.nodeType === Node.TEXT_NODE) nodes[0].textContent = ' ' + nodes[0].textContent;
    else nodes.unshift(document.createTextNode(' '));
  }
  top.after(...nodes);
  rest.remove();
  top.parentElement?.normalize();
}

// ---------------------------------------------------------------- a chain of why
function toggle_why(ring: HTMLElement): void {
  const node = ring.parentElement as HTMLElement, under = node.querySelector<HTMLElement>(':scope > .mn-chain-under');
  if (!under) return;
  const open = ring.getAttribute('aria-expanded') !== 'true';
  if (open) {
    ring.setAttribute('aria-expanded', 'true');
    under.hidden = false;
    under.classList.remove('mn-chain-drop');
    void under.offsetWidth;
    under.classList.add('mn-chain-drop');
  } else {
    // everything hanging from it is drawn back up into it
    node.querySelectorAll<HTMLElement>('.mn-chain-ring').forEach((r) => r.setAttribute('aria-expanded', 'false'));
    node.querySelectorAll<HTMLElement>('.mn-chain-under').forEach((u) => (u.hidden = true));
  }
  const chain = node.closest('.mn-chain') as HTMLElement;
  // the threads follow the reasons down as they drop
  const t0 = performance.now();
  const tick = () => { draw_threads(chain); if (performance.now() - t0 < 420) requestAnimationFrame(tick); };
  tick();
}
/** Each shown reason hangs from its parent's ring on a thread: down from the ring, a soft S, down into its own mark. */
export function draw_threads(chain: HTMLElement): void {
  const svg = chain.querySelector<SVGSVGElement>(':scope > .mn-chain-threads');
  if (!svg) return;
  const cr = chain.getBoundingClientRect();
  svg.setAttribute('width', String(cr.width));
  svg.setAttribute('height', String(cr.height));
  let d = '';
  chain.querySelectorAll<HTMLElement>('.mn-chain-under:not([hidden])').forEach((under) => {
    const ring = under.parentElement!.querySelector<HTMLElement>(':scope > .mn-chain-ring');
    if (!ring) return;
    const pr = ring.getBoundingClientRect(), px = pr.left + pr.width / 2 - cr.left, py = pr.top + pr.height / 2 - cr.top + 5.5;
    under.querySelectorAll<HTMLElement>(':scope > .mn-chain-node').forEach((kid) => {
      const mark = kid.querySelector<HTMLElement>(':scope > .mn-chain-ring, :scope > .mn-chain-ground, :scope > .mn-chain-leaf');
      if (!mark) return;
      const mr = mark.getBoundingClientRect(), x = mr.left + mr.width / 2 - cr.left, y = mr.top + mr.height / 2 - cr.top - (mark.classList.contains('mn-chain-ring') ? 5.5 : 4);
      if (y <= py + 0.5) return;
      // straight down the margin past everything above it, then a soft S into its own mark (it never crosses text)
      const yb = Math.max(py, y - 22), m = (y - yb) * 0.5;
      d += `M${px.toFixed(1)} ${py.toFixed(1)}L${px.toFixed(1)} ${yb.toFixed(1)}C${px.toFixed(1)} ${(yb + m).toFixed(1)} ${x.toFixed(1)} ${(y - m).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
  });
  svg.innerHTML = d ? `<path d="${d}"/>` : '';
}

// ---------------------------------------------------------------- details, unfolded like folded paper
// Each leaf of what is folded is a sheet; opening, the sheets unfold from flat like paper folded in a zigzag (the
// face turned up to the one light is lit, the face turned down is shaded); at rest it is plain text, sharp.
function toggle_fold(head: HTMLElement): void {
  const box = head.parentElement as HTMLElement, body = box.querySelector<HTMLElement>(':scope > .mn-fold-body');
  if (!body || box.dataset.moving) return;
  const open = head.getAttribute('aria-expanded') !== 'true';
  head.setAttribute('aria-expanded', String(open));
  const leaves = [...body.children] as HTMLElement[];
  const still = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (open) body.hidden = false;
  if (still || !leaves.length) { if (!open) body.hidden = true; return; }
  const hs = leaves.map((l) => l.offsetHeight);
  box.dataset.moving = '1';
  body.classList.add('mn-folding');
  const t0 = performance.now(), dur = open ? 600 : 420;
  const set = (a: number) => leaves.forEach((f, i) => {
    const up = i % 2 === 0, deg = (up ? -1 : 1) * a * 86;
    f.style.transformOrigin = up ? 'top center' : 'bottom center';
    f.style.transform = a > 0.001 ? `perspective(700px) rotateX(${deg.toFixed(2)}deg)` : '';
    f.style.marginBottom = a > 0.001 ? `${(-a * hs[i] * 0.94).toFixed(1)}px` : '';
    f.style.setProperty('--shade', up ? `rgba(255,255,255,${(0.55 * a).toFixed(3)})` : `rgba(26,27,31,${(0.2 * a).toFixed(3)})`);
  });
  set(open ? 1 : 0);
  const inout = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
  const tick = () => {
    const u = Math.min(1, (performance.now() - t0) / dur), a = open ? 1 - inout(u) : inout(u);
    set(a);
    if (u < 1) return void requestAnimationFrame(tick);
    set(0);
    body.classList.remove('mn-folding');
    if (!open) body.hidden = true;
    delete box.dataset.moving;
  };
  requestAnimationFrame(tick);
}
