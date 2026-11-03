// Things: every object on a figure has an id, a kind, a role in the grammar of the look and a sentence that says what
// it is. The registry knows them all - their boxes and meanings - which is what linking text to figure, lassoing,
// the tutor's light, accessibility and the doctor's description are built on.
import { color_of, look, material_of, resolve_color, text_color_of, type Look, type Material } from '@mathnim/look';
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

/**
 * The freedom layer: what a figure may say about how one thing looks, over what its role gives it. A role is the
 * default (one noun, one colour, everywhere); a style is an override, for a picture the grammar does not cover. The
 * lint reports overrides as warnings, never blocks them, and describe() lists them.
 */
export interface Style {
  /** Stroke and fill colour: a palette key ('cobalt', 'ink2', 'muted', 'accent', 'coral' …), a role ('noun:wall'), or '#rrggbb'. */
  color?: string;
  /** Text colour (default: `color` as given, else the role's colour darkened to read). */
  text?: string;
  /** Stroke width (CSS px). */
  width?: number;
  /** Dashes [on, off] (CSS px); null draws solid even when the role is dashed. */
  dash?: [number, number] | null;
  /** Opacity of the strokes (0..1). */
  alpha?: number;
  /** Fill colour (default: `color`) and its opacity. */
  fill?: string;
  fill_alpha?: number;
  /** Text size (CSS px), weight and family. */
  size?: number;
  weight?: number;
  family?: 'sans' | 'serif' | 'mono';
  italic?: boolean;
  /** A paper backing behind text (its opacity): readable over lines. */
  backing?: number;
}
/** The keys of a style that override how text reads (the lint relaxes its text rules for these). */
const TEXT_KEYS: (keyof Style)[] = ['text', 'size', 'color'];

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
  /** Left out by the layout on this device (an optional remark with no room). */
  dropped = false;
  /** Things drawn as part of this one (a plot's marks). */
  children: Thing[] = [];
  parent: Thing | null = null;
  /** Overrides of how it looks (see Style). */
  style: Style;
  constructor(o: { id?: string; role?: string; says?: L10n; z?: number; style?: Style } = {}) {
    this.id = o.id ?? `t${++auto_id}`;
    this.role = o.role ?? 'text';
    this.says = o.says;
    this.z = o.z ?? 0;
    this.style = o.style ?? {};
    this.opacity = param(1, { name: this.id + '.opacity', range: [0, 1] });
  }
  /** A role that follows the state (read while drawing, so the thing is drawn again when it changes). */
  role_of?: () => string;
  get color(): string {
    return this.style.color ? resolve_color(this.style.color, look()) : color_of(this.role_of?.() ?? this.role, look());
  }
  /** Its colour as text (the noun's hue, dark enough to read; or what its style asks for). */
  get text_color(): string {
    const s = this.style.text ?? this.style.color;
    return s ? resolve_color(s, look()) : text_color_of(this.role_of?.() ?? this.role, look());
  }
  get fill_color(): string {
    return this.style.fill ? resolve_color(this.style.fill, look()) : this.color;
  }
  /** Its role's material with the style's overrides. */
  get material(): Material {
    const m = material_of(this.role, look()), s = this.style;
    if (s.width === undefined && s.dash === undefined && s.alpha === undefined && s.fill_alpha === undefined && s.weight === undefined) return m;
    const out: Material = { ...m };
    if (s.width !== undefined) out.stroke = s.width;
    if (s.dash !== undefined) out.dash = s.dash ?? undefined;
    if (s.alpha !== undefined) out.stroke_opacity = s.alpha;
    if (s.fill_alpha !== undefined) out.fill_opacity = s.fill_alpha;
    if (s.weight !== undefined) out.weight = s.weight as Material['weight'];
    return out;
  }
  /** Does its style override how its text reads (size or colour)? */
  get text_styled(): boolean {
    return TEXT_KEYS.some((k) => this.style[k] !== undefined);
  }
  /** Its style's overrides, for describe(). */
  style_note(): string {
    const e = Object.entries(this.style).filter(([, v]) => v !== undefined);
    return e.length ? ` style{${e.map(([k, v]) => `${k}:${Array.isArray(v) ? v.join('/') : v}`).join(',')}}` : '';
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
  /** Its words piece by piece where each is drawn (a legend's entries, a readout's parts), for the DOM mirror. */
  parts_of?: (lang: Lang) => { text: string; tex?: boolean; box: Box }[];
  /** Is it on screen now? */
  visible(): boolean {
    return !this.dropped && this.opacity.value > 0.001 && (!this.parent || this.parent.visible());
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
