// Text and box helpers shared by the fine-tuning visuals of parts A and F.
// Every visual here takes a `lang` parameter ('en' | 'zh'): the learner's
// language is chosen by the lesson (or the AI) and labels are drawn in it.
// Words are set with Text in the sans font (Arimo; CJK falls back to a system
// font in node, and needs a registered CJK web font in the browser).
import { DecimalNumber, Line, RoundedRectangle, Text, VGroup, VMobject } from 'manim-web';
import { palette } from '../../theme';

export type Lang = 'en' | 'zh';
/**
 * `lang: 'auto'` (the default) draws labels in the learner's language (see
 * ft_lang), so visuals in scene steps, text pages and AI answers all follow it.
 */
export const LANG_SPEC = { type: 'enum' as const, values: ['auto', 'en', 'zh'], default: 'auto', doc: "language of the labels: 'en', 'zh', or 'auto' (the learner's language)" };
let current_lang: Lang | null = null;
/** Force the language 'auto' resolves to (tests, tools); null = follow the page again. */
export function set_ft_lang(l: Lang | null): void {
  current_lang = l === 'zh' ? 'zh' : l === 'en' ? 'en' : null;
}
/**
 * The learner's language: the one forced with set_ft_lang(), else the page's
 * (the app sets <html lang> before it renders a page), else English.
 */
export function ft_lang(): Lang {
  if (current_lang) return current_lang;
  const page = typeof document !== 'undefined' ? document.documentElement?.lang ?? '' : '';
  return page.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
/** The language a visual draws in: its `lang` parameter, or the learner's for 'auto'. */
export const resolve_lang = (v: unknown): Lang => (v === 'zh' || v === 'en' ? v : ft_lang());

/** Pick the text of the current language. */
export const pick = (lang: Lang, en: string, zh: string) => (lang === 'zh' ? zh : en);

/** A label in the sans font. `muted` parts (substrings) are drawn in the muted colour. */
export function label(s: string, size = 26, color?: string, o: { weight?: string; muted?: string[]; colors?: Record<string, string> } = {}): VMobject {
  const c = palette();
  const t2c: Record<string, string> = { ...(o.colors ?? {}) };
  for (const m of o.muted ?? []) t2c[m] = c.muted;
  return Text(s, { font_size: size, color: color ?? c.ink, font: 'sans', weight: o.weight ?? 'NORMAL', t2c }) as unknown as VMobject;
}

/** A rounded box of the given size centred at (x, y). */
export function box(x: number, y: number, w: number, h: number, o: { stroke?: string; fill?: string; fill_opacity?: number; width?: number; radius?: number; opacity?: number } = {}): VMobject {
  const c = palette();
  const r = RoundedRectangle({
    width: w, height: h, corner_radius: o.radius ?? 0.12,
    stroke_color: o.stroke ?? c.muted, stroke_width: o.width ?? 2, stroke_opacity: o.opacity ?? 1,
    fill_color: o.fill ?? c.bg, fill_opacity: o.fill_opacity ?? 1,
  }) as unknown as VMobject;
  r.move_to([x, y, 0]);
  return r;
}

/** Shrink a mobject (uniformly) so it is at most w wide and h high. */
export function fit(m: VMobject, w: number, h = Infinity): VMobject {
  const k = Math.min(1, w / Math.max(1e-6, m.width), h / Math.max(1e-6, m.height));
  if (k < 1) m.scale(k);
  return m;
}

/** A plain straight line. */
export function seg(a: readonly number[], b: readonly number[], color: string, width = 2, opacity = 1): VMobject {
  return Line([a[0], a[1], 0], [b[0], b[1], 0], { color, stroke_width: width, stroke_opacity: opacity }) as unknown as VMobject;
}

/** Group helper typed loosely (VGroup of anything). */
export const group = (...ms: unknown[]) => VGroup(...(ms as any[])) as unknown as VMobject;

/** Format a number with thousands separators (en) or as is (zh uses the same digits). */
export function num(x: number, decimals = 0): string {
  const s = x.toFixed(decimals);
  const [i, f] = s.split('.');
  const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return f ? `${ii}.${f}` : ii;
}

/**
 * A live mobject that is rebuilt only when `key()` changes (cheaper than
 * always_redraw for text and formulas). The key is stored on the mobject, so
 * the player's snapshots stay consistent. Like always_redraw, `build` must
 * return the same structure every time (children are paired by position).
 */
export function live<T extends VMobject>(key: () => string, build: () => T): T {
  const m = build() as any;
  m._live_key = key();
  m.add_updater((x: any) => {
    const k = key();
    if (x._live_key === k) return;
    x._live_key = k;
    x.become(build());
  });
  return m as T;
}

/**
 * A row "label value suffix" whose value is a live DecimalNumber (cheap to
 * update while dragging; the words are set once). `at` is the row's left end.
 */
export function value_row(o: { before?: string; after?: string; get: () => number; decimals?: number; size?: number; color?: string; value_color?: string; at: [number, number]; commas?: boolean; every?: number }): VMobject {
  const c = palette();
  const size = o.size ?? 26;
  const parts: any[] = [];
  if (o.before) parts.push(label(o.before, size, o.color ?? c.ink));
  const d = DecimalNumber(o.get(), { num_decimal_places: o.decimals ?? 0, font_size: size + 4, color: o.value_color ?? o.color ?? c.ink, group_with_commas: o.commas ?? true });
  parts.push(d);
  if (o.after) parts.push(label(o.after, size, o.color ?? c.ink));
  const row = VGroup(...parts);
  const place = () => {
    row.arrange([1, 0, 0], { buff: 0.12 });
    row.move_to([0, o.at[1], 0]).align_to([o.at[0], 0, 0], [-1, 0, 0]);
  };
  place();
  // re-typeset at most every `every` seconds of scene time (default 0.1 s): text is
  // expensive to rebuild, and a value that is still changing need not be redrawn 60x a second
  const every = o.every ?? 0.1;
  (d as any)._acc = every;
  d.add_updater((m: any, dt: number) => {
    m._acc = (m._acc ?? 0) + (dt || 0);
    const v = +o.get().toFixed(o.decimals ?? 0);
    if (m._last_v === v || (m._acc < every && m._last_v !== undefined && dt > 0)) return;
    m._acc = 0;
    m._last_v = v;
    m.set_value(v);
    place();
  });
  return row as unknown as VMobject;
}

/** A DecimalNumber that follows `get()`, re-typeset at most every `every` s of scene time (see value_row). */
export function live_decimal(get: () => number, o: { decimals?: number; size?: number; color?: string; unit?: string; every?: number; place?: (m: VMobject) => void } = {}): VMobject {
  const c = palette();
  const d: any = DecimalNumber(get(), { num_decimal_places: o.decimals ?? 2, font_size: o.size ?? 30, color: o.color ?? c.ink, ...(o.unit ? { unit: o.unit } : {}) });
  const every = o.every ?? 0.1;
  d._acc = every;
  o.place?.(d);
  d.add_updater((m: any, dt: number) => {
    m._acc = (m._acc ?? 0) + (dt || 0);
    const v = +get().toFixed(o.decimals ?? 2);
    if (m._last_v === v || (m._acc < every && m._last_v !== undefined && dt > 0)) return;
    m._acc = 0;
    m._last_v = v;
    m.set_value(v);
    o.place?.(m);
  });
  return d as VMobject;
}
