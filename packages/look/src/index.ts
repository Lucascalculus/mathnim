// The Mathium look: the design system as data. A lesson says what a thing *is* (its role: a noun, the truth, a
// guess, the one action) and how things *relate* (beside, below, attached to); everything about how that looks and
// moves lives here. Changing the look - a colour, the gap between a label and its line, how a guess converges - is an
// edit to this file, reviewed on the doctor's change sheet; no lesson changes (docs/design/ENGINE.md §9).
//
// Version 1 keeps the site's current palette (so figures on the new engine sit beside the old ones without a seam)
// and adds the grammar: one colour per noun, everywhere; graphite only for scaffolding; one vermilion action.

export type ThemeName = 'light' | 'dark';

export interface Palette {
  /** Stage background and its soft gradient. */
  bg: string;
  bg_top: string;
  bg_bottom: string;
  /** Text and marks that carry meaning. */
  ink: string;
  /** Secondary text (never numbers, never the learner's own marks: grey reads as "disabled"). */
  ink2: string;
  /** Scaffolding only: grids, construction lines, axes' minor ticks. */
  scaffold: string;
  /** The faintest rules (grid lines). */
  faint: string;
  /** The site's quiet grey for marks (a clipped plan, minor numbers): lighter than ink2, so not for body text. */
  muted: string;
  /** Pigments: each names one noun of a course (see `nouns`). */
  cobalt: string;
  ochre: string;
  vermilion: string;
  viridian: string;
  violet: string;
  teal: string;
}

export const PALETTES: Record<ThemeName, Palette> = {
  light: {
    bg: '#FFFFFF', bg_top: '#FFFFFF', bg_bottom: '#F5F5F7',
    ink: '#111113', ink2: '#5B5B62', scaffold: '#9A9AA1', faint: '#E6E6EA', muted: '#86868B',
    cobalt: '#2563EB', ochre: '#B8860B', vermilion: '#E4572E', viridian: '#1F8A5B', violet: '#7C3AED', teal: '#0D9488',
  },
  dark: {
    bg: '#0E1014', bg_top: '#12151B', bg_bottom: '#0B0D10',
    ink: '#ECEFF4', ink2: '#A3AAB6', scaffold: '#6B7280', faint: '#2A2F38', muted: '#8B93A1',
    cobalt: '#58C4DD', ochre: '#F7D96F', vermilion: '#FC6255', viridian: '#83C167', violet: '#9A72AC', teal: '#5CD0B3',
  },
};

/** Pigment names. */
export type Pigment = 'cobalt' | 'ochre' | 'vermilion' | 'viridian' | 'violet' | 'teal' | 'ink';

/**
 * Nouns: the same thing has the same colour in every figure, every course and the text around it. A course adds its
 * nouns here (reviewed), never in a lesson. Unknown nouns fall back to ink, and the lint reports them.
 */
export const NOUNS: Record<string, Pigment> = {
  // control (MPC): as the course has always drawn them (a speed limit gold, the wall coral)
  'plan': 'cobalt', 'best-plan': 'cobalt', 'cart': 'cobalt', 'prediction': 'cobalt',
  'wall': 'vermilion', 'limit': 'ochre', 'terminal-set': 'viridian', 'goal': 'viridian',
  'motor': 'ink', 'speed': 'ochre', 'state': 'ink', 'cost': 'cobalt',
  // probability, statistics
  'data': 'ink', 'mean': 'cobalt', 'density': 'cobalt', 'sample': 'ink',
  // linear algebra
  'i-hat': 'viridian', 'j-hat': 'vermilion', 'eigenvector': 'violet', 'determinant': 'ochre', 'flipped': 'violet', 'collapsed': 'vermilion', 'grid': 'cobalt',
  // operations research (MGMT90141): the profit line, the feasible set, and up to four limits (a wall of the plan plane)
  'profit': 'cobalt', 'feasible': 'viridian', 'limit-a': 'ochre', 'limit-b': 'teal', 'limit-c': 'violet', 'limit-d': 'ink',
  // decision analysis and the normal table (MGMT90141): a value rolled back through a tree (an expected value), the cut
  // on a rejected branch, the probability under the learner's hand, and standard units (z)
  'expected-value': 'cobalt', 'cut': 'vermilion', 'chance': 'violet', 'z-score': 'violet',
  // fine-tuning
  'base-model': 'ink', 'adapter': 'violet', 'reward': 'viridian', 'loss': 'vermilion', 'attention': 'cobalt',
  'train-loss': 'cobalt', 'val-loss': 'vermilion', 'metric': 'viridian',
};

/**
 * Roles: what a mark is, in the grammar of docs/design/NEXT.md. A figure only names roles; the stroke, dash, fill and
 * weight come from here.
 */
export type Role =
  | 'noun'        // a thing of the lesson's world, coloured by its noun (role 'noun:<name>')
  | 'truth'       // the true answer, solid
  | 'guess'       // the learner's guess, hollow
  | 'predicted'   // a prediction, dashed
  | 'ghost'       // a previous or counterfactual state, hollow dashed and faint
  | 'active'      // something that binds right now (an active constraint): thick
  | 'region'      // an area (feasible set): a tint of its noun
  | 'scaffold'    // axes, grids, construction
  | 'glass'       // where the hand is: handles
  | 'verb'        // the one vermilion action of the screen
  | 'text'        // ordinary text
  | 'muted';      // secondary text

export interface Material {
  stroke?: number;          // px at 1x
  dash?: [number, number];  // px
  fill_opacity?: number;    // for regions and dots
  stroke_opacity?: number;
  hollow?: boolean;
  weight?: 400 | 500 | 600 | 700;
}

export const MATERIALS: Record<Role, Material> = {
  noun: { stroke: 2.5, fill_opacity: 1 },
  truth: { stroke: 3, fill_opacity: 1, weight: 600 },
  guess: { stroke: 2.5, hollow: true },
  predicted: { stroke: 2.5, dash: [7, 5] },
  ghost: { stroke: 2, dash: [5, 5], stroke_opacity: 0.55, hollow: true },
  active: { stroke: 5.5 },
  region: { stroke: 2, fill_opacity: 0.12 },
  scaffold: { stroke: 1.25, stroke_opacity: 1 },
  glass: { stroke: 0.75 },
  verb: { weight: 600 },
  text: { weight: 400 },
  muted: { weight: 400 },
};

/** Fonts: the system's own (no download). Chinese comes from PingFang, YaHei or Noto CJK, whichever the device has. */
export const FONTS = {
  sans: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

/** The type scale inside figures: three sizes only (px at 1x, before the device's scale). */
export const TYPE = {
  label: { size: 15, weight: 500, line: 1.3 },
  caption: { size: 16, weight: 400, line: 1.55 },
  readout: { size: 22, weight: 500, line: 1.2 },
  /** The one or two quantities a figure is about (a matrix, its determinant): set large, beside the picture. */
  display: { size: 30, weight: 500, line: 1.2 },
  /** TeX is set at this multiple of the text size around it. */
  tex_scale: 1.12,
};

/** Spacing (px at 1x). */
export const SPACE = {
  /** Between a label and the thing it is attached to. */
  label_gap: 6,
  /** Between blocks in a row or a column. */
  gap: 16,
  /** Around the whole figure. */
  pad: 18,
  /** Between lines of a caption list. */
  list_gap: 6,
  /** The tick length of an axis. */
  tick: 5,
};

/**
 * Motion: a figure names an intent; the spring behind it is here. `response` is the period of the spring in seconds
 * (SwiftUI's meaning), `damping` its damping fraction (1 = no overshoot). `reduced` is what the intent becomes when
 * the system asks for less motion.
 */
export interface Motion {
  response: number;
  damping: number;
  reduced: 'instant' | 'fade';
  /** 'spring' (default): the spring's step response; 'ease': slow in and slow out over the whole time (a long move or a drawing-on, so a narration's pacing holds); 'linear': at one speed (manim's linear rate). */
  curve?: 'spring' | 'ease' | 'linear';
}
export const MOTION: Record<string, Motion> = {
  reveal: { response: 0.55, damping: 1, reduced: 'fade' },
  converge: { response: 0.8, damping: 0.92, reduced: 'fade' },
  emphasise: { response: 0.4, damping: 0.7, reduced: 'instant' },
  travel: { response: 1.1, damping: 1, reduced: 'instant', curve: 'ease' },
  settle: { response: 0.45, damping: 0.85, reduced: 'instant' },
  grow: { response: 1.4, damping: 1, reduced: 'instant', curve: 'ease' },
  /** A line or a grid drawing itself on. */
  draw: { response: 1.2, damping: 1, reduced: 'instant', curve: 'ease' },
  /** At one speed, start to end (a clock, a sweep). */
  linear: { response: 1, damping: 1, reduced: 'instant', curve: 'linear' },
  /** Words written on. */
  write: { response: 1.0, damping: 1, reduced: 'instant', curve: 'linear' },
};

/** Layout rules, applied by the engine per device. */
export const LAYOUT = {
  /** Below this width (CSS px) a figure is laid out for a phone: rows become columns. */
  phone_below: 560,
  /** Desktop figures are laid out for this aspect when the page lets them choose (width / height). */
  desktop_aspect: 16 / 9,
  /** A phone figure may be up to this many times taller than wide (the page scrolls; the figure stays legible). */
  phone_max_tall: 2.3,
  /** Smallest text a figure may show (CSS px). */
  min_text: 12,
  /** Smallest touch target (CSS px). */
  min_target: 44,
  /** A plot is never smaller than this (CSS px, its data area). */
  min_plot: 150,
};

/** Rules the taste lint enforces (docs/design/ENGINE.md §4.5). */
export const TASTE = {
  /** At most this many vermilion verbs on a screen. */
  max_verbs: 1,
  /** Text contrast against the stage, WCAG ratio. */
  min_contrast: 4.5,
  /** Phrases that instruct the learner (design speaks before words). */
  instructions: [/^(请|点击|拖动|试着|按下)/, /^(please|click|drag|try to|press)\b/i],
};

export interface Look {
  theme: ThemeName;
  palette: Palette;
  nouns: typeof NOUNS;
  materials: typeof MATERIALS;
  fonts: typeof FONTS;
  type: typeof TYPE;
  space: typeof SPACE;
  motion: typeof MOTION;
  layout: typeof LAYOUT;
  taste: typeof TASTE;
  /** Fewer, gentler motions (the system's reduced-motion setting). */
  reduced_motion: boolean;
}

let current: Look = make_look('light');

export function make_look(theme: ThemeName, o: { reduced_motion?: boolean } = {}): Look {
  return { theme, palette: PALETTES[theme], nouns: NOUNS, materials: MATERIALS, fonts: FONTS, type: TYPE, space: SPACE, motion: MOTION, layout: LAYOUT, taste: TASTE, reduced_motion: !!o.reduced_motion };
}
/** The look figures are drawn with now. */
export const look = (): Look => current;
export function set_look(l: Look): void {
  current = l;
}

/** The colour of a role, e.g. 'noun:wall' → ochre, 'truth' → ink, 'verb' → vermilion. */
export function color_of(role: string, l: Look = current): string {
  const p = l.palette;
  const [r, noun] = role.split(':');
  if (r === 'noun' || r === 'region' || r === 'active' || r === 'predicted' || r === 'ghost' || r === 'guess' || r === 'truth') {
    if (noun) {
      const pig = l.nouns[noun];
      if (pig) return pig === 'ink' ? p.ink : p[pig];
    }
    return r === 'region' || r === 'predicted' || r === 'ghost' || r === 'guess' ? p.cobalt : p.ink;
  }
  if (r === 'scaffold') return p.scaffold;
  if (r === 'verb') return p.vermilion;
  if (r === 'muted') return p.ink2;
  return p.ink;
}
/** Palette keys a figure may name directly (a style override), and the old site's names for the same pigments. */
const ALIASES: Record<string, keyof Palette> = { accent: 'cobalt', gold: 'ochre', coral: 'vermilion', good: 'viridian', purple: 'violet', paper: 'bg' };
/**
 * A colour a figure asked for (the freedom layer): a palette key ('cobalt', 'ink2', 'muted', or the old names 'accent',
 * 'gold', 'coral', 'good', 'purple'), a role ('noun:wall', 'verb'), or any '#rrggbb'. It follows the theme unless it is
 * a hex.
 */
export function resolve_color(c: string, l: Look = current): string {
  if (c.startsWith('#')) return c;
  const k = (ALIASES[c] ?? c) as keyof Palette;
  if (k in l.palette) return l.palette[k];
  return color_of(c, l);
}
/** Contrast ratio of two #rrggbb colours (WCAG 2). */
export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const n = parseInt(h.replace('#', '').slice(0, 6), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  const ch = (n: number, k: number) => (n >> k) & 255;
  const m = (k: number) => Math.round(ch(pa, k) + (ch(pb, k) - ch(pa, k)) * t);
  return '#' + [m(16), m(8), m(0)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
const text_cache = new Map<string, string>();
/**
 * The colour of a role *as text*: its own hue, darkened (or, on dark stages, lightened) just enough to read at the
 * contrast the taste rules ask for. A noun keeps its identity in words and in marks.
 */
export function text_color_of(role: string, l: Look = current): string {
  const c = color_of(role, l), key = `${l.theme}|${c}`;
  let out = text_cache.get(key);
  if (out) return out;
  out = c;
  const toward = l.theme === 'dark' ? '#FFFFFF' : '#000000';
  for (let t = 0; t <= 1 && contrast(out, l.palette.bg) < l.taste.min_contrast; t += 0.04) out = mix(c, toward, t);
  text_cache.set(key, out);
  return out;
}
/** The material of a role. */
export function material_of(role: string, l: Look = current): Material {
  return l.materials[(role.split(':')[0] as Role)] ?? l.materials.text;
}
/** Is this noun known to the look? (the lint reports unknown ones) */
export const known_noun = (role: string, l: Look = current): boolean => {
  const [, noun] = role.split(':');
  return !noun || noun in l.nouns;
};
