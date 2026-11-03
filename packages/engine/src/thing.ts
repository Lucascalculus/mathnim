// Things: every object on a figure has an id, a kind, a role in the grammar of the look and a sentence that says what
// it is. The registry knows them all - their boxes and meanings - which is what linking text to figure, lassoing,
// the tutor's light, accessibility and the doctor's description are built on.
import { color_of, look, material_of, text_color_of, type Look, type Material } from '@mathnim/look';
import type { Box, Ctx2D, XY } from './geom';
import { param, type Param } from './state';
import type { L10n, Lang } from './text';

export interface DrawEnv {
  g: Ctx2D;
  look: Look;
  lang: Lang;
  /** CSS px → device px. */
  dpr: number;
  /** The figure's frame (CSS px). */
  frame: Box;
}

/** What a placed label must keep clear of. */
export type Obstacle = { box: Box; weight?: number } | { seg: [XY, XY]; weight?: number } | { pt: XY; r: number; weight?: number };

let auto_id = 0;

export abstract class Thing {
  id: string;
  abstract kind: string;
  role: string;
  says?: L10n;
  /** Drawn in order of z (then of creation). */
  z = 0;
  /** 0..1; a script's reveal() animates it. */
  readonly opacity: Param<number>;
  /** Where layout put it (CSS px). Marks inside a plot set it from their geometry when drawn. */
  box: Box = { x: 0, y: 0, w: 0, h: 0 };
  /** Why it is where it is (explain()). */
  why: string[] = [];
  /** Things drawn as part of this one (a plot's marks). */
  children: Thing[] = [];
  parent: Thing | null = null;
  constructor(o: { id?: string; role?: string; says?: L10n; z?: number } = {}) {
    this.id = o.id ?? `t${++auto_id}`;
    this.role = o.role ?? 'text';
    this.says = o.says;
    this.z = o.z ?? 0;
    this.opacity = param(1, { name: this.id + '.opacity', range: [0, 1] });
  }
  get color(): string {
    return color_of(this.role, look());
  }
  /** Its colour as text (the noun's hue, dark enough to read). */
  get text_color(): string {
    return text_color_of(this.role, look());
  }
  get material(): Material {
    return material_of(this.role, look());
  }
  /** Draw with the env's context (already scaled to CSS px). Reading params here makes the thing depend on them. */
  abstract draw(env: DrawEnv): void;
  /** Shapes a label must avoid (default: the box). */
  obstacles(): Obstacle[] {
    return this.box.w > 0 ? [{ box: this.box }] : [];
  }
  /** The text it shows, for the lint and the description. */
  text(_lang: Lang): string {
    return '';
  }
  /** Text size in CSS px (0: no text). */
  text_px(): number {
    return 0;
  }
  /** Is it on screen now? */
  visible(): boolean {
    return this.opacity.value > 0.001 && (!this.parent || this.parent.visible());
  }
}

export class Registry {
  readonly things = new Map<string, Thing>();
  add<T extends Thing>(t: T): T {
    if (this.things.has(t.id)) throw new Error(`engine: two things are called '${t.id}'`);
    this.things.set(t.id, t);
    for (const c of t.children) if (!this.things.has(c.id)) this.add(c);
    return t;
  }
  get(id: string): Thing | undefined {
    return this.things.get(id);
  }
  all(): Thing[] {
    return [...this.things.values()];
  }
  /** Things in drawing order. */
  ordered(): Thing[] {
    const list = this.all().filter((t) => !t.parent);
    return list.map((t, i) => [t, i] as const).sort((a, b) => a[0].z - b[0].z || a[1] - b[1]).map(([t]) => t);
  }
}

export { contrast } from '@mathnim/look';
/** A colour with an alpha. */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
