// The tutor's hands (docs/design/ENGINE.md §10). The tutor acts in a figure only as a learner can: it points at a
// thing, moves what the learner's hand can move, puts a short note on a thing, or puts everything back. Every act
// names a thing or a param the figure has, and is checked here before it is done; each one is kept in the figure's
// history (the deck of what the tutor did), so the learner can see it and undo it.
import type { Figure } from './figure';
import { inflate, type Box, type XY } from './geom';
import { Label } from './kinds';
import { param, untracked, type Param } from './state';
import { tr } from './text';
import { Thing, rgba, type DrawEnv } from './thing';

export type Act =
  | { op: 'point'; id: string }
  | { op: 'set'; param: string; to: number }
  | { op: 'note'; id: string; text: string }
  | { op: 'reset' };
/** What the tutor may act on: the things on screen now and the params the learner can move. */
export interface Manifest {
  things: { id: string; kind: string; says?: string; text?: string }[];
  params: { name: string; value: number; range?: [number, number]; step?: number; doc?: string }[];
}
export interface ActRecord {
  act: Act;
  ok: boolean;
  /** Why it was not done. */
  why?: string;
  /** ms since the page loaded. */
  at: number;
}
/** A note the tutor puts on a thing is short: a few words, not a paragraph. */
export const NOTE_MAX = 60;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The params the learner can move: those under a handle, and those the figure lets the tutor move (`tutor: true`). */
export function movable(fig: Figure): Param<number>[] {
  const out = new Set<Param<number>>();
  for (const h of fig.handles) {
    out.add(h.px);
    if (h.py) out.add(h.py);
  }
  for (const p of fig.params.values()) if (p.spec.tutor) out.add(p);
  return [...out];
}
const param_named = (fig: Figure, name: string): Param<number> | undefined => movable(fig).find((p) => p.name === name);
const thing_named = (fig: Figure, id: string): Thing | undefined => fig.registry.get(id) ?? fig.labels.find((l) => l.id === id);
const on_screen = (t: Thing): boolean => untracked(() => t.visible()) && t.box.w > 0 && t.kind !== 'handle' && t.kind !== 'light';

export function manifest_of(fig: Figure): Manifest {
  const things = fig.registry.all().concat(fig.labels.filter((l) => !fig.registry.get(l.id)))
    .filter((t) => on_screen(t) && !t.id.startsWith('tutor_'))
    .map((t) => {
      const text = untracked(() => t.text(fig.lang)).slice(0, 60);
      return { id: t.id, kind: t.kind, ...(t.says ? { says: tr(t.says, fig.lang) } : {}), ...(text ? { text } : {}) };
    });
  const params = movable(fig).map((p) => {
    const doc = p.spec.says ? tr(p.spec.says, fig.lang) : p.spec.doc;
    return { name: p.name, value: +p.peek().toFixed(4), ...(p.spec.range ? { range: p.spec.range } : {}), ...(p.spec.step ? { step: p.spec.step } : {}), ...(doc ? { doc } : {}) };
  });
  return { things, params };
}

/** null when the act can be done now, else why not (in words an agent can act on). */
export function check_act(fig: Figure, a: Act): string | null {
  switch (a.op) {
    case 'point':
    case 'note': {
      const t = thing_named(fig, a.id);
      if (!t) return `no thing '${a.id}' in this figure`;
      if (!on_screen(t)) return `'${a.id}' is not on screen now`;
      if (a.op === 'note' && !a.text.trim()) return 'an empty note';
      if (a.op === 'note' && a.text.length > NOTE_MAX) return `a note is at most ${NOTE_MAX} characters`;
      return null;
    }
    case 'set': {
      const p = param_named(fig, a.param);
      if (!p) return `'${a.param}' is not something the learner can move here (${movable(fig).map((q) => q.name).join(', ') || 'nothing is'})`;
      if (!Number.isFinite(a.to)) return `'${a.to}' is not a number`;
      return null;
    }
    case 'reset':
      return null;
  }
  return 'unknown act';
}

/** The light the tutor points with: a soft ring around a thing (its point, or its box), for a few seconds. */
export class Light extends Thing {
  kind = 'light';
  target: string | null = null;
  readonly level: Param<number>;
  constructor(private fig: Figure) {
    super({ id: 'tutor_light', role: 'glass', z: 9 });
    this.level = param(0, { name: 'tutor_light.level', range: [0, 1] });
  }
  draw(env: DrawEnv): void {
    const k = this.level.value;
    const t = this.target ? thing_named(this.fig, this.target) : undefined;
    if (k <= 0.001 || !t) {
      this.box = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const g = env.g, col = env.look.palette.vermilion, at = (t as Thing & { where?: () => XY | null }).where?.();
    g.save();
    g.strokeStyle = rgba(col, 0.9 * k);
    g.fillStyle = rgba(col, 0.08 * k);
    g.lineWidth = 2.5;
    g.shadowColor = rgba(col, 0.55 * k);
    g.shadowBlur = 14;
    g.beginPath();
    let b: Box;
    if (at) {
      const r = Math.max(16, Math.min(t.box.w, t.box.h) / 2 + 9);
      g.arc(at[0], at[1], r, 0, Math.PI * 2);
      b = { x: at[0] - r, y: at[1] - r, w: 2 * r, h: 2 * r };
    } else {
      b = inflate(t.box, 7);
      if (g.roundRect) g.roundRect(b.x, b.y, b.w, b.h, 8);
      else g.rect(b.x, b.y, b.w, b.h);
    }
    g.fill();
    g.stroke();
    g.restore();
    this.box = b;
  }
}

/**
 * What the tutor did to one figure: the light, the note, the params it moved (and their values before it first moved
 * them, for reset), and the history. Created the first time the tutor acts.
 */
export class Hands {
  readonly light: Light;
  readonly note: Label;
  history: ActRecord[] = [];
  private note_text = '';
  private note_on: string | null = null;
  readonly note_ver: Param<number>;
  /** Each moved param's value before the tutor first moved it. */
  private kept = new Map<Param<number>, number>();
  constructor(private fig: Figure) {
    this.light = new Light(fig);
    this.note_ver = param(0, { name: 'tutor_note.version' });
    this.note = new Label(() => (this.note_ver.value, this.note_text), () => {
      const t = this.note_on ? thing_named(fig, this.note_on) : undefined;
      if (!t || !on_screen(t)) return null;
      return (t as Thing & { where?: () => XY | null }).where?.() ?? t.box;
    }, { id: 'tutor_note', role: 'verb', z: 9, style: { weight: 600, backing: 0.94 } });
    fig.labels.push(this.note);
    fig.registry.add(this.light);
    fig.registry.add(this.note);
  }
  record(act: Act, why?: string): ActRecord {
    const r: ActRecord = { act, ok: !why, ...(why ? { why } : {}), at: now() };
    this.history.push(r);
    return r;
  }
  /** Remember a param's value before the tutor first moves it. */
  keep(p: Param<number>): void {
    if (!this.kept.has(p)) this.kept.set(p, p.peek());
  }
  /** What reset() goes back to. */
  kept_values(): [Param<number>, number][] {
    return [...this.kept];
  }
  forget(): void {
    this.kept.clear();
  }
  show_note(id: string | null, text = ''): void {
    this.note_on = id;
    this.note_text = text;
    this.note_ver.set(this.note_ver.peek() + 1, true);
  }
  param(name: string): Param<number> | undefined {
    return param_named(this.fig, name);
  }
}

/** Do an act at once (no motion): node, tests and the doctor; the player animates the same acts. */
export function act_now(fig: Figure, a: Act): ActRecord {
  const h = fig.hands(), why = check_act(fig, a);
  if (why) return h.record(a, why);
  if (a.op === 'set') {
    const p = h.param(a.param)!;
    h.keep(p);
    p.set(a.to);
  } else if (a.op === 'point') {
    h.light.target = a.id;
    h.light.level.set(1);
  } else if (a.op === 'note') h.show_note(a.id, a.text);
  else {
    for (const [p, v] of h.kept_values()) p.set(v, true);
    h.forget();
    h.light.level.set(0);
    h.show_note(null);
  }
  return h.record(a);
}
