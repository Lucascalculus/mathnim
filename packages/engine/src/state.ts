// State is the truth; pictures are functions of it. Params are the values a figure is about (they can be set by a
// script, a handle, the tutor or a world's solve()); derived values are computed from them, lazily, and recomputed
// only when something they read changed - in dependency order, so no half-updated state is ever observed.
// Everything is deterministic: the same params give the same picture, which is what makes seeking exact.

let tracking: Derived<unknown> | null = null;
let clock = 1;   // a global version: every write increments it
/** The params written inside batch_writes(), each with its value before the batch (null: not in a batch). */
let batch: Map<Param<unknown>, unknown> | null = null;
const writers = new Set<() => void>();
/** Be told after any param changes (a player schedules one frame; nothing runs while nothing changes). */
export function watch_writes(f: () => void): () => void {
  writers.add(f);
  return () => writers.delete(f);
}

/** Something that can be read (and tracked). */
export interface Readable<T> {
  readonly value: T;
  /** The version at which it last changed (for caches). */
  readonly version: number;
}

export class Param<T> implements Readable<T> {
  private _v: T;
  version = clock;
  readonly subs = new Set<Derived<unknown>>();
  /** Listeners called after every change (handles, the player's dirty flag). */
  readonly listeners = new Set<(v: T) => void>();
  constructor(v: T, readonly name = '', readonly spec: ParamSpec = {}) {
    this._v = v;
  }
  get value(): T {
    if (tracking) tracking.deps.add(this);
    return this._v;
  }
  /** Read without being tracked. */
  peek(): T {
    return this._v;
  }
  /** Set it (clamped to its range; snapped to its step unless `exact`, as a script's motion is). */
  set(v: T, exact = false): void {
    if (Object.is(v, this._v)) return;
    if (typeof v === 'number' && this.spec.range) v = Math.min(this.spec.range[1], Math.max(this.spec.range[0], v)) as T;
    if (typeof v === 'number' && this.spec.step && !exact) v = (Math.round((v as number) / this.spec.step) * this.spec.step) as T;
    if (Object.is(v, this._v)) return;
    // inside a batch the value moves and its listeners hear it in order (a sim's new run must come before the script
    // moves its clock on); whether it changed - its version, what is derived from it - is decided when the batch ends
    if (batch) {
      if (!batch.has(this as Param<unknown>)) batch.set(this as Param<unknown>, this._v);
      this._v = v;
      for (const f of this.listeners) f(v);
      return;
    }
    // (outside a batch, as always: a new version and what is derived from it stale first, so a listener reads it new)
    this._v = v;
    this.version = ++clock;
    for (const d of this.subs) d.stale();
    for (const f of this.listeners) f(v);
    for (const f of writers) f();
  }
  /** (batch_writes) It ends the batch different from how it began: a new version, what is derived from it stale, the player told. */
  commit(): void {
    this.version = ++clock;
    for (const d of this.subs) d.stale();
    for (const f of writers) f();
  }
}

/**
 * Writes that count as one change: a seek puts every param the script touches back where it started and plays the
 * script again up to the moment, so a param may move and come back within it. Only what ends the batch different from
 * how it began gets a new version and tells its listeners; the rest stay as they were, and what reads only them is not
 * drawn again (a frame in which nothing ends different is not drawn at all). Inside a batch, derived values are not
 * recomputed (a script's motion must not read them: call()'s f depends on u only).
 */
export function batch_writes(f: () => void): void {
  if (batch) return f();
  batch = new Map();
  let b: Map<Param<unknown>, unknown>;
  try {
    f();
  } finally {
    b = batch;
    batch = null;
  }
  for (const [p, before] of b) if (!Object.is(p.peek(), before)) p.commit();
}
export interface ParamSpec {
  range?: [number, number];
  step?: number;
  doc?: string;
  /** The tutor may move it (as it may move what is under a handle): acts.ts. */
  tutor?: boolean;
  /** What it is, in both languages (the tutor's history and the screen reader say it). */
  says?: { en: string; zh: string };
}

export class Derived<T> implements Readable<T> {
  private _v!: T;
  private dirty = true;
  version = 0;
  readonly deps = new Set<Readable<unknown>>();
  readonly subs = new Set<Derived<unknown>>();
  constructor(private f: () => T, readonly name = '') {}
  stale(): void {
    if (this.dirty) return;
    this.dirty = true;
    for (const d of this.subs) d.stale();
  }
  get value(): T {
    if (tracking) tracking.deps.add(this);
    if (this.dirty) this.recompute();
    return this._v;
  }
  /** Its value, without being tracked. */
  peek(): T {
    return untracked(() => this.value);
  }
  private recompute(): void {
    for (const d of this.deps) (d as Param<unknown> | Derived<unknown>).subs.delete(this);
    this.deps.clear();
    const outer = tracking;
    tracking = this as Derived<unknown>;
    let v: T;
    try {
      v = this.f();
    } finally {
      tracking = outer;
    }
    for (const d of this.deps) (d as Param<unknown> | Derived<unknown>).subs.add(this);
    this.dirty = false;
    if (!Object.is(v, this._v)) {
      this._v = v;
      this.version = ++clock;
    }
  }
}

export const param = <T>(v: T, o: ParamSpec & { name?: string } = {}): Param<T> => new Param(v, o.name ?? '', o);
export const derive = <T>(f: () => T, name = ''): Derived<T> => new Derived(f, name);
/** A plain value, or a readable. */
export type Val<T> = T | Readable<T> | (() => T);
export function read<T>(v: Val<T>): T {
  if (v instanceof Param || v instanceof Derived) return v.value as T;
  if (typeof v === 'function') return (v as () => T)();
  return v as T;
}
/** Read without tracking (for event handlers). */
export function untracked<T>(f: () => T): T {
  const outer = tracking;
  tracking = null;
  try {
    return f();
  } finally {
    tracking = outer;
  }
}
/** Run `f` and record every readable it reads (a draw pass uses this to know what a thing depends on). */
export function track<T>(f: () => T): { value: T; deps: Readable<unknown>[] } {
  const probe = new Derived(f);
  const value = probe.value;
  const deps = [...probe.deps];
  for (const d of deps) (d as Param<unknown> | Derived<unknown>).subs.delete(probe);
  return { value, deps };
}
/** The current global version (anything written since a version v has version > v). */
export const now_version = (): number => clock;
