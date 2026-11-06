// The page: where the zones of one page meet (docs/design/ENGINE-ARCH.md). A lesson page, a tutor's answer, a card of
// the gallery: each has one page, and its zones (a figure, a world, the text) attach to it. Zones never know each
// other; they know the names on the page:
//   - values: named numbers the zones share (a number dragged in a sentence, a figure's param bound to it) and
//     formulas computed from them;
//   - nouns: which zone shows which noun, by which thing (a word in a sentence, a curve in a figure);
//   - attention: the noun under the learner's hand (touch a word and its thing answers, and the other way round) and
//     where the page's one light is (the tutor's, or a noun pointed at);
//   - reports: what the learner did, in the shapes of docs/REPORTS.md, from any zone, in one log;
//   - acts: the tutor's, routed to the zone that owns what they name.
// It is DOM-free: a zone that needs the DOM (the text) is an adapter in @mathnim/present.
//
//   const page = new Page('en');
//   page.attach(figure_zone(player));            // engine figure
//   page.attach(text_zone(article, page));       // present
//   page.value('n', 3, { range: [1, 12], step: 1 });
//   page.bind('n', fig.params.get('count')!);    // the sentence's n moves the figure, and the figure moves it back
//   page.hover('ball', 'text');                  // the ball lights in every zone that shows it
import { eval_expr, expr_names } from './expr';
import { derive, param, untracked, type Derived, type Param, type ParamSpec } from './state';
import type { Lang } from './text';

/** Something on the page: a noun (wherever it is shown) or one thing of one zone. */
export type Target = { noun: string } | { zone: string; id: string };
export interface Attention {
  /** The noun under the learner's hand, and the zone the hand is in (null: none). */
  hover: string | null;
  from: string | null;
  /** Where the page's one light is: always one thing of one zone (a noun is resolved to its most particular thing). */
  light: { zone: string; id: string } | null;
}
/** A noun a zone shows, by which of its things (smaller `size` is more particular: a point before the curve it is on). */
export interface NounAnchor {
  noun: string;
  id: string;
  size?: number;
}
/** What the tutor may act on in a zone. */
export interface ZoneManifest {
  things: { id: string; kind: string; says?: string; text?: string }[];
  params: { name: string; value: number; range?: [number, number]; step?: number; doc?: string }[];
}
/** A tutor's act on the page: an engine act (point, set, note, reset, or a registered one) with the zone it is for. */
export interface PageAct {
  op: string;
  zone?: string;
  id?: string;
  noun?: string;
  [k: string]: unknown;
}
export interface ActResult {
  ok: boolean;
  why?: string;
  zone?: string;
}
/** A zone of a page (a figure, a world, the text; later a 2.5D world, a table, narration). */
export interface Zone {
  readonly id: string;
  /** 'figure', 'world', 'text', or a kind still to come. */
  readonly kind: string;
  /** The nouns it shows now. */
  anchors(): NounAnchor[];
  /** Show the page's attention: what the hand is on, where the light is. */
  attend(a: Attention): void;
  manifest?(): ZoneManifest;
  act?(a: PageAct): ActResult;
  describe?(): string;
  /** It has joined a page (attach() calls it): a zone whose learner's hand moves tells the page through it. */
  joined?(page: Page): void;
  /** The page is done with it (detach() calls it). */
  dispose?(): void;
}
/** What the learner did, as a zone reports it (docs/REPORTS.md), and new kinds of report as they come. */
export type Report =
  | { kind: 'answer'; item: string; correct: boolean; response?: string }
  | { kind: 'done'; score?: number }
  | { kind: 'state'; text: string }
  | { kind: string; [k: string]: unknown };
export interface LoggedReport {
  zone: string;
  /** ms since the page was made. */
  at: number;
  report: Report;
}
export type PageEvent =
  | { type: 'attention'; attention: Attention }
  | { type: 'value'; name: string; value: number }
  | { type: 'report'; logged: LoggedReport }
  | { type: 'zones' };
/** What a page can be put back to (resume a page, share a state, replay a session). */
export interface PageSnapshot {
  values: Record<string, number>;
  attention: Attention;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
let pages = 0;

export class Page {
  readonly zones = new Map<string, Zone>();
  readonly values = new Map<string, Param<number>>();
  readonly log: LoggedReport[] = [];
  attention: Attention = { hover: null, from: null, light: null };
  private formulas = new Map<string, Derived<number>>();
  /** Moves when a shared number is made, so a formula that read a name not yet on the page is computed again. */
  private names = param(0, { name: 'page.names' });
  private listeners = new Set<(e: PageEvent) => void>();
  private born = now();
  constructor(readonly lang: Lang = 'en', readonly id = `page${++pages}`) {}

  // ---------------------------------------------------------------- zones
  /** Attach a zone (its id is made unique on this page); returns the detach. */
  attach<Z extends Zone>(z: Z): () => void {
    let id = z.id;
    for (let k = 2; this.zones.has(id) && this.zones.get(id) !== z; k++) id = `${z.id}_${k}`;
    if (id !== z.id) (z as { id: string }).id = id;
    this.zones.set(id, z);
    z.joined?.(this);
    z.attend(this.attention);
    this.emit({ type: 'zones' });
    return () => this.detach(id);
  }
  detach(id: string): void {
    const z = this.zones.get(id);
    if (!z) return;
    this.zones.delete(id);
    if (this.attention.light?.zone === id) this.attention = { ...this.attention, light: null };
    if (this.attention.from === id) this.attention = { ...this.attention, hover: null, from: null };
    z.dispose?.();
    this.emit({ type: 'zones' });
  }

  // ---------------------------------------------------------------- values
  /** A shared number by name: made with `v` and `spec` the first time, the same param after. */
  value(name: string, v = 0, spec: ParamSpec = {}): Param<number> {
    let p = this.values.get(name);
    if (!p) {
      p = param(v, { ...spec, name });
      this.values.set(name, p);
      p.listeners.add(() => this.changed(name));
      this.names.set(this.names.peek() + 1);
    }
    return p;
  }
  /**
   * Zones hear of changed values once the change is over: a figure's script moves its params in one batch, and what
   * is computed from them is current only after it (state.ts), so the page tells its zones in a microtask, once per
   * value however often it moved.
   */
  private pending = new Set<string>();
  private changed(name: string): void {
    if (!this.pending.size) queueMicrotask(() => this.flush());
    this.pending.add(name);
  }
  /** Tell the zones now of the values that changed (a test, or a host that cannot wait for the microtask). */
  flush(): void {
    const names = [...this.pending];
    this.pending.clear();
    for (const name of names) {
      const p = this.values.get(name);
      if (p) this.emit({ type: 'value', name, value: p.peek() });
    }
  }
  /** Set a shared number (made if new). */
  set(name: string, v: number): void {
    this.value(name, v).set(v, true);
  }
  /**
   * A number computed from the shared ones ('2.5*n', 'sqrt(a^2 + b^2)'), recomputed when they change. NaN while a
   * name it reads is not on the page yet (shown as … by a text).
   */
  formula(src: string): Derived<number> {
    let d = this.formulas.get(src);
    if (!d) {
      d = derive(() => {
        void this.names.value;
        const vars = new Map<string, number>();
        for (const n of expr_names(src)) {
          const p = this.values.get(n);
          if (p) vars.set(n, p.value);
        }
        try {
          return eval_expr(src, vars);
        } catch {
          return NaN;
        }
      }, `page ${src}`);
      this.formulas.set(src, d);
    }
    return d;
  }
  /** The shared numbers a formula reads, which are on the page (for drawing what depends on what). */
  depends(src: string): string[] {
    return expr_names(src).filter((n) => this.values.has(n));
  }
  /**
   * Bind a zone's own param to a shared number: each follows the other (a sentence's number moves the figure, the
   * figure's handle moves the sentence). The shared number is made from the param if it is new. Returns the unbind.
   */
  bind(name: string, p: Param<number>): () => void {
    const shared = this.values.get(name) ?? this.value(name, p.peek(), { range: p.spec.range, step: p.spec.step, says: p.spec.says });
    let busy = false;
    const to_p = (v: number) => { if (busy) return; busy = true; try { p.set(v, true); } finally { busy = false; } };
    const to_shared = (v: number) => { if (busy) return; busy = true; try { shared.set(v, true); } finally { busy = false; } };
    to_p(shared.peek());
    shared.listeners.add(to_p);
    p.listeners.add(to_shared);
    return () => {
      shared.listeners.delete(to_p);
      p.listeners.delete(to_shared);
    };
  }

  // ---------------------------------------------------------------- nouns and attention
  /** Every thing on the page that shows a noun, the most particular first. */
  find(noun: string): { zone: string; id: string; size: number }[] {
    const out: { zone: string; id: string; size: number }[] = [];
    for (const [zid, z] of this.zones) for (const a of z.anchors()) if (a.noun === noun) out.push({ zone: zid, id: a.id, size: a.size ?? Infinity });
    return out.sort((a, b) => a.size - b.size);
  }
  /** The nouns shown on the page, each once. */
  nouns(): string[] {
    return [...new Set([...this.zones.values()].flatMap((z) => z.anchors().map((a) => a.noun)))];
  }
  /** The learner's hand is on a noun (in zone `from`), or on none. Every zone answers. */
  hover(noun: string | null, from: string | null = null): void {
    if (this.attention.hover === noun && this.attention.from === (noun ? from : null)) return;
    this.attention = { ...this.attention, hover: noun, from: noun ? from : null };
    this.tell_zones();
  }
  /**
   * Put the page's one light on something (null: off). A noun is resolved to its most particular thing, preferring a
   * drawn one (a figure) to a word. Returns where it went, or null when nothing shows that target.
   */
  point(target: Target | null, o: { prefer?: string } = {}): { zone: string; id: string } | null {
    let at: { zone: string; id: string } | null = null;
    if (target && 'noun' in target) {
      const found = this.find(target.noun);
      const pick = (o.prefer && found.find((f) => this.zones.get(f.zone)?.kind === o.prefer)) || found.find((f) => this.zones.get(f.zone)?.kind !== 'text') || found[0];
      at = pick ? { zone: pick.zone, id: pick.id } : null;
    } else if (target && this.zones.has(target.zone)) at = { zone: target.zone, id: target.id };
    if (target && !at) return null;
    this.attention = { ...this.attention, light: at };
    this.tell_zones();
    return at;
  }
  private tell_zones(): void {
    const a = this.attention;
    for (const z of this.zones.values()) z.attend(a);
    this.emit({ type: 'attention', attention: a });
  }

  // ---------------------------------------------------------------- reports
  /** A zone reports what the learner did. */
  tell(zone: string, report: Report): LoggedReport {
    const logged = { zone, at: now() - this.born, report };
    this.log.push(logged);
    this.emit({ type: 'report', logged });
    return logged;
  }

  // ---------------------------------------------------------------- the tutor
  /** Everything the tutor may act on, zone by zone, and the shared numbers. */
  manifest(): { zones: ({ id: string; kind: string } & ZoneManifest)[]; values: { name: string; value: number; range?: [number, number] }[] } {
    return untracked(() => ({
      zones: [...this.zones.values()].filter((z) => z.manifest).map((z) => ({ id: z.id, kind: z.kind, ...z.manifest!() })),
      values: [...this.values].map(([name, p]) => ({ name, value: p.peek(), ...(p.spec.range ? { range: p.spec.range } : {}) })),
    }));
  }
  /**
   * Do a tutor's act: in the zone it names, else in the zone that shows its noun or thing, else (a shared number,
   * `{ op: 'set', param }` with no zone) on the page's own values.
   */
  act(a: PageAct): ActResult {
    if (a.op === 'set' && !a.zone && typeof a.param === 'string' && this.values.has(a.param)) {
      const to = Number(a.to);
      if (!Number.isFinite(to)) return { ok: false, why: `'${String(a.to)}' is not a number` };
      this.values.get(a.param)!.set(to);
      return { ok: true, zone: 'page' };
    }
    if (a.op === 'point' && a.noun) {
      const at = this.point({ noun: a.noun });
      return at ? { ok: true, zone: at.zone } : { ok: false, why: `nothing on the page shows '${a.noun}'` };
    }
    const order = a.zone ? [this.zones.get(a.zone)].filter(Boolean) as Zone[] : [...this.zones.values()];
    if (a.zone && !order.length) return { ok: false, why: `no zone '${a.zone}' on this page (${[...this.zones.keys()].join(', ') || 'none'})` };
    let last: ActResult = { ok: false, why: 'no zone on this page can do it' };
    for (const z of order) {
      if (!z.act) continue;
      const r = z.act(a);
      if (r.ok) return { ...r, zone: z.id };
      last = { ...r, zone: z.id };
    }
    return last;
  }

  // ---------------------------------------------------------------- state
  snapshot(): PageSnapshot {
    return { values: Object.fromEntries([...this.values].map(([k, p]) => [k, p.peek()])), attention: { ...this.attention } };
  }
  restore(s: PageSnapshot): void {
    for (const [k, v] of Object.entries(s.values)) this.set(k, v);
    this.attention = { ...s.attention };
    this.tell_zones();
  }
  /** What is on the page, zone by zone (for agents, tests and the tutor). */
  describe(): string {
    return [...this.zones.values()].map((z) => `[${z.id}: ${z.kind}]\n${z.describe?.() ?? z.anchors().map((a) => `${a.id} noun:${a.noun}`).join('\n')}`).join('\n');
  }

  // ---------------------------------------------------------------- events
  on(f: (e: PageEvent) => void): () => void {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }
  private emit(e: PageEvent): void {
    for (const f of this.listeners) f(e);
  }
  dispose(): void {
    for (const id of [...this.zones.keys()]) this.detach(id);
    this.listeners.clear();
  }
}
