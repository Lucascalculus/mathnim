// The DOM mirror. A figure's words are drawn on a canvas, which a screen reader cannot read and a learner cannot
// select. The mirror is a layer of plain elements over the canvas, built from the registry: one element per thing
// that says something (its words, or what it is), at the thing's place and in reading order, so a screen reader reads
// the figure top to bottom and finds each thing where it is drawn when the learner explores by touch; the readouts
// announce their new values after a change (politely, once the hand stops); each handle is a slider the keyboard can
// move. The words are transparent (the canvas shows them) and sit where they are drawn, so they can be selected and
// copied, and the page's "ask about this" works on them.
import type { Figure } from './figure';
import type { Handle } from './kinds';
import type { Box } from './geom';
import { tr } from './text';
import type { Thing } from './thing';

/** TeX as words a screen reader can say and a learner can copy: a_1 = -0.31 → a₁ = −0.31, \le → ≤. */
export function tex_to_text(s: string): string {
  const SUB: Record<string, string> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', n: 'ₙ', k: 'ₖ', i: 'ᵢ', j: 'ⱼ', t: 'ₜ', x: 'ₓ' };
  const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', T: 'ᵀ' };
  const SYM: Record<string, string> = {
    le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', times: '×', cdot: '·', pm: '±', to: '→', rightarrow: '→', infty: '∞', in: '∈',
    varnothing: '∅', emptyset: '∅', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π',
    sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', omega: 'ω', sum: 'Σ', sqrt: '√', partial: '∂', nabla: '∇', ldots: '…', dots: '…', quad: ' ', qquad: '  ', det: 'det', cdots: '⋯',
    hat: '', bar: '', vec: '', mathcal: '', mathbf: '', mathrm: '', text: '', operatorname: '', left: '', right: '', displaystyle: '',
  };
  const script = (map: Record<string, string>, body: string) => [...body].map((c) => map[c] ?? c).join('');
  let out = s
    // colours say nothing to a reader; a matrix reads row by row; î and ĵ are letters
    .replace(/\\textcolor\{[^{}]*\}\{([^{}]*)\}/g, '$1')
    .replace(/\\color\{[^{}]*\}/g, '')
    .replace(/\\begin\{[pbvB]?matrix\}([\s\S]*?)\\end\{[pbvB]?matrix\}/g, (_, body: string) => `[${body.split('\\\\').map((r) => r.split('&').map((x) => x.trim()).join(' ')).join('; ')}]`)
    .replace(/\\hat\{\\imath\}|\\hat\s*\\imath/g, 'î')
    .replace(/\\hat\{\\jmath\}|\\hat\s*\\jmath/g, 'ĵ')
    .replace(/\\imath/g, 'ı')
    .replace(/\\jmath/g, 'ȷ')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\([A-Za-z]+)/g, (_, w: string) => SYM[w] ?? w)
    .replace(/_\{([^{}]*)\}|_(\S)/g, (_, a: string, b: string) => script(SUB, a ?? b))
    .replace(/\^\{([^{}]*)\}|\^(\S)/g, (_, a: string, b: string) => script(SUP, a ?? b))
    .replace(/[{}]/g, '')
    .replace(/-/g, '−')
    .replace(/\s+/g, ' ')
    .trim();
  // (a dash between letters is a hyphen in words: keep it)
  out = out.replace(/([A-Za-z])−([A-Za-z])/g, '$1-$2');
  return out;
}

const CSS = `
.mn-mirror{position:absolute;pointer-events:none;overflow:hidden}
.mn-mirror .mn-m-t{position:absolute;color:transparent;white-space:pre;line-height:1;pointer-events:auto;cursor:text;transform-origin:0 0;user-select:text;-webkit-user-select:text}
.mn-mirror .mn-m-t::selection{background:rgba(37,99,235,.28);color:transparent}
.mn-mirror .mn-m-m{position:absolute}
.mn-mirror .mn-m-h{position:absolute;border-radius:50%;outline:none}
.mn-mirror .mn-m-h:focus-visible{box-shadow:0 0 0 3px rgba(37,99,235,.55)}
.mn-mirror .mn-m-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;
let styled = false;

/** The words a thing shows (TeX as text), or ''. */
function words_of(t: Thing, fig: Figure): string {
  const s = t.text(fig.lang);
  if (!s) return '';
  return t.kind === 'readout' || (t.kind === 'label' && (t as Thing & { o?: { tex?: boolean } }).o?.tex) || (t.kind === 'legend' && /\\/.test(s)) ? tex_to_text(s) : s;
}

export class Mirror {
  readonly root: HTMLDivElement;
  private live: HTMLDivElement;
  private nodes = new Map<string, HTMLElement>();
  private keys = new Map<string, string>();
  private said = '';
  private say_timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private fig: Figure, private canvas: HTMLCanvasElement, private o: { label?: string; quiet: () => boolean; nudge: (h: Handle, dx: number, dy: number) => void }) {
    const doc = canvas.ownerDocument;
    if (!styled) {
      const st = doc.createElement('style');
      st.textContent = CSS;
      doc.head.append(st);
      styled = true;
    }
    this.root = doc.createElement('div');
    this.root.className = 'mn-mirror';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-roledescription', fig.lang === 'zh' ? '互动图' : 'interactive figure');
    if (o.label) this.root.setAttribute('aria-label', o.label);
    this.live = doc.createElement('div');
    this.live.className = 'mn-m-live';
    this.live.setAttribute('aria-live', 'polite');
    this.root.append(this.live);
    const parent = canvas.parentElement;
    if (parent && getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    canvas.after(this.root);
    // (the canvas itself is a picture the mirror describes: a screen reader reads the mirror instead)
    canvas.setAttribute('aria-hidden', 'true');
  }

  /** Bring the layer up to date with what was drawn last (cheap when nothing moved: only changed elements are touched). */
  sync(): void {
    const fig = this.fig, c = this.canvas, k = fig.view_scale;
    // the layer covers the canvas exactly
    const r = this.root.style;
    r.left = `${c.offsetLeft}px`;
    r.top = `${c.offsetTop}px`;
    r.width = `${c.clientWidth}px`;
    r.height = `${c.clientHeight}px`;
    const sx = c.clientWidth / (fig.frame.w * k || 1), s = k * sx;
    const things = fig.registry.all().concat(fig.labels.filter((l) => !fig.registry.get(l.id)))
      .filter((t) => t.kind !== 'light' && t.kind !== 'handle' && t.box.w > 0 && t.visible())
      // reading order: rows of 24 px, then left to right
      .sort((a, b) => Math.round(a.box.y / 24) - Math.round(b.box.y / 24) || a.box.x - b.box.x);
    const seen = new Set<string>();
    let prev: Element = this.live;
    // (a legend or a readout is mirrored piece by piece, each where it is drawn; a mark inside a plot is cut to the plot)
    // (`lead`: what a piece is comes before its words - "the best plan's first acceleration: a₁ =")
    const items: { id: string; t: Thing; text: string; says: string; box: Box; lead?: boolean }[] = [];
    for (const t of things) {
      const says = t.says ? tr(t.says, fig.lang) : '';
      const parts = t.parts_of?.(fig.lang);
      if (parts?.length) {
        parts.forEach((p, i) => items.push({ id: `${t.id}#${i}`, t, text: p.tex ? tex_to_text(p.text) : p.text, says: i === 0 ? says : '', box: p.box, lead: true }));
        continue;
      }
      const text = words_of(t, fig);
      if (!text && !says) continue;
      const plot = (t as Thing & { plot?: { data: Box } }).plot;
      items.push({ id: t.id, t, text, says, box: plot ? cut(t.box, plot.data) : t.box });
    }
    for (const { id, t, text, says, box, lead } of items) {
      if (box.w <= 0 || box.h <= 0) continue;
      seen.add(id);
      const key = `${text}|${says}|${box_key(box)}|${s.toFixed(4)}`;
      let el = this.nodes.get(id);
      if (!el) {
        el = c.ownerDocument.createElement('span');
        this.nodes.set(id, el);
      }
      if (prev.nextSibling !== el) prev.after(el);
      prev = el;
      if (this.keys.get(id) === key) continue;
      this.keys.set(id, key);
      place(el, box, s);
      if (text) {
        // words: transparent text at the size it is drawn, stretched to the drawn width (fonts differ a little)
        // (a caption keeps its lines; one line sits in the middle of its box, as drawn)
        el.className = 'mn-m-t';
        el.removeAttribute('role');
        const tb = t as Thing & { lines?: { spans: { s: string }[]; width: number }[]; line_h?: () => number };
        const multi = t.kind === 'text' && !!tb.lines && tb.lines.length > 1;
        el.textContent = multi ? tb.lines!.map((l) => l.spans.map((sp) => sp.s).join('')).join('\n') : text;
        el.style.fontSize = `${Math.max(1, t.text_px() * s)}px`;
        el.style.lineHeight = `${(multi && tb.line_h ? tb.line_h() : box.h) * s}px`;
        el.style.width = '';
        el.style.height = '';
        el.style.transform = '';
        if (says && says !== text) el.setAttribute('aria-label', lead ? `${says}: ${text}` : `${text} (${says})`);
        else el.removeAttribute('aria-label');
        const natural = el.offsetWidth, drawn = (t.kind === 'text' && tb.lines?.length ? Math.max(...tb.lines.map((l) => l.width)) : box.w) * s;
        if (natural > 0) el.style.transform = `scaleX(${Math.min(1.15, drawn / natural)})`;
      } else {
        // a mark: what it is, where it is
        el.className = 'mn-m-m';
        el.textContent = '';
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', says);
      }
    }
    // handles: sliders the keyboard moves
    for (const h of fig.handles) {
      if (!h.visible() || h.box.w <= 0) continue;
      seen.add(h.id);
      let el = this.nodes.get(h.id);
      if (!el) {
        el = c.ownerDocument.createElement('div');
        el.className = 'mn-m-h';
        el.tabIndex = 0;
        el.setAttribute('role', 'slider');
        el.addEventListener('keydown', (e) => {
          const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
          const v = d[e.key];
          if (!v) return;
          e.preventDefault();
          this.o.nudge(h, v[0], v[1]);
        });
        this.nodes.set(h.id, el);
      }
      if (prev.nextSibling !== el) prev.after(el);
      prev = el;
      const vals = [h.px, ...(h.py ? [h.py] : [])], range = h.px.spec.range;
      const valtext = vals.map((p) => `${p.spec.says ? tr(p.spec.says, fig.lang) : p.name} ${+p.peek().toFixed(2)}`).join(', ');
      const key = `${valtext}|${box_key(h.box)}|${s.toFixed(4)}`;
      if (this.keys.get(h.id) === key) continue;
      this.keys.set(h.id, key);
      place(el, h.box, s);
      el.setAttribute('aria-label', h.says ? tr(h.says, fig.lang) : h.id);
      el.setAttribute('aria-valuetext', valtext);
      el.setAttribute('aria-valuenow', String(+h.px.peek().toFixed(4)));
      if (range) {
        el.setAttribute('aria-valuemin', String(range[0]));
        el.setAttribute('aria-valuemax', String(range[1]));
      }
      if (h.py) el.setAttribute('aria-orientation', 'horizontal');
    }
    for (const [id, el] of this.nodes) if (!seen.has(id)) {
      el.remove();
      this.nodes.delete(id);
      this.keys.delete(id);
    }
    this.announce();
  }

  /** The readouts' words, said once the figure stops changing (not while its script plays). */
  private announce(): void {
    if (!this.o.quiet()) return;
    const now = this.fig.registry.all().filter((t) => t.kind === 'readout' && t.visible() && t.box.w > 0).map((t) => words_of(t, this.fig)).filter(Boolean).join('; ');
    if (now === this.said) return;
    if (this.say_timer) clearTimeout(this.say_timer);
    this.say_timer = setTimeout(() => {
      this.said = now;
      this.live.textContent = now;
    }, 700);
  }
  /** What the layer says now, in order (tests and the doctor read it). */
  text(): string[] {
    return [...this.root.querySelectorAll<HTMLElement>('.mn-m-t, .mn-m-m, .mn-m-h')].map((e) => e.getAttribute('aria-label') ?? e.textContent ?? '');
  }
  destroy(): void {
    if (this.say_timer) clearTimeout(this.say_timer);
    this.root.remove();
    this.canvas.removeAttribute('aria-hidden');
  }
}

/** A box cut to another (a mark's bounds to its plot's data area). */
function cut(a: Box, b: Box): Box {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}
function box_key(b: Box): string {
  return `${b.x.toFixed(1)},${b.y.toFixed(1)},${b.w.toFixed(1)},${b.h.toFixed(1)}`;
}
function place(el: HTMLElement, b: Box, s: number): void {
  el.style.left = `${b.x * s}px`;
  el.style.top = `${b.y * s}px`;
  el.style.width = `${b.w * s}px`;
  el.style.height = `${b.h * s}px`;
}
