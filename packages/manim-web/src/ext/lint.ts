// Scene linter (web extension): finds layout problems a viewer would notice -
// objects off screen, labels overlapping each other or crossing lines, text
// too small or too low in contrast, crowded frames. Used as the quality gate
// for generated scenes and in the dev overlay.
//
//   const issues = lint_frame(scene);                  // current state
//   const all = await lint_timeline(player);           // end of every segment
import { config } from '../_config';
import { Mobject } from '../mobject/mobject';
import { VMobject } from '../mobject/types/vectorized_mobject';
import { ManimColor } from '../utils/color/core';
import type { Scene } from '../scene/scene';
import type { ScenePlayer } from './player';

export interface LintIssue {
  rule: 'off-frame' | 'text-overlap' | 'label-crosses-line' | 'tiny-text' | 'low-contrast' | 'crowded' | 'too-fast';
  severity: 'error' | 'warning';
  message: string;
  mobjects: Mobject[];
  time?: number;
  segment?: number;
}
export interface LintOptions {
  /** Margin (scene units) that must stay free at the frame edges. */
  margin?: number;
  /** Minimum text height in pixels at 1080p. */
  min_text_px?: number;
  /** Minimum WCAG contrast ratio between text and background. */
  min_contrast?: number;
  /** Maximum number of separate text objects on screen. */
  max_texts?: number;
  /** Background colour (default config.background_color). */
  background?: string;
}

const TEXT_CLASSES = new Set(['Text', 'MarkupText', 'Paragraph', 'Tex', 'MathTex', 'SingleStringMathTex', 'DecimalNumber', 'Integer', 'Variable', 'Title', 'BulletedList', 'Code']);
/** Class name without the prefixes/suffixes bundlers add when renaming (`_MathTex`, `Axes2`). */
export const class_name = (c: Function): string => c.name.replace(/^_+/, '').replace(/\d+$/, '');
/** Does m's class, or one of its base classes, match? (By name, so it works for modules not loaded.) */
function is_a(m: Mobject, test: (name: string) => boolean): boolean {
  for (let p = Object.getPrototypeOf(m); p && p !== Object.prototype; p = Object.getPrototypeOf(p)) if (test(class_name(p.constructor))) return true;
  return false;
}
/** Is m a text-like mobject? */
export function is_text(m: Mobject): boolean {
  return is_a(m, (n) => TEXT_CLASSES.has(n));
}
type Box = { x0: number; y0: number; x1: number; y1: number };
function box(m: Mobject): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of m.get_family()) {
    const p = f.points;
    if (!visible(f)) continue;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < x0) x0 = p[i];
      if (p[i] > x1) x1 = p[i];
      if (p[i + 1] < y0) y0 = p[i + 1];
      if (p[i + 1] > y1) y1 = p[i + 1];
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}
function visible(m: Mobject): boolean {
  if (!m.points.length) return false;
  if (m instanceof VMobject) return (m.get_fill_opacity() > 0.02) || (m.get_stroke_opacity() > 0.02 && m.get_stroke_width() > 0);
  // only images and point clouds are drawn; plain Mobjects (ValueTracker, Group) are not
  return 'pixel_array' in m || 'rgbas' in m;
}
const area = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}
function luminance(c: ManimColor): number {
  const [r, g, b] = c.to_rgb().map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast_ratio(a: ManimColor, b: ManimColor): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Name for messages: class + short text content. */
export function label_of(m: Mobject): string {
  const t = (m as any).tex_string ?? (m as any).original_text ?? (m as any).text;
  const v = (m as any).get_value?.();
  const extra = typeof t === 'string' ? ` "${t.length > 24 ? t.slice(0, 24) + '…' : t}"` : typeof v === 'number' ? ` ${+v.toFixed(3)}` : '';
  return class_name(m.constructor) + extra;
}

/** Units of text: text mobjects as wholes; everything else by leaves. */
const AXIS = /^(NumberLine|UnitInterval|Axes|ThreeDAxes|NumberPlane|PolarPlane|ComplexPlane)$/;
/** Units of text: text mobjects as wholes; everything else by leaves. `units` counts one per axis for tick labels. */
function collect(scene: Scene): { texts: Mobject[]; shapes: Mobject[]; units: number } {
  const texts: Mobject[] = [], shapes: Mobject[] = [];
  const owners = new Set<Mobject | null>();
  let loose = 0;
  const walk = (m: Mobject, axis: Mobject | null) => {
    if (is_a(m, (n) => AXIS.test(n))) axis ??= m;
    if (is_text(m)) {
      if (box(m)) {
        texts.push(m);
        if (axis) owners.add(axis);
        else loose++;
      }
      return;
    }
    if (visible(m)) shapes.push(m);
    for (const s of m.submobjects) walk(s, axis);
  };
  for (const m of scene.get_render_mobjects()) walk(m, null);
  return { texts, shapes, units: loose + owners.size };
}

/** Lint the scene as it is now. */
export function lint_frame(scene: Scene, o: LintOptions = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  const cam = scene.camera as any;
  const fw: number = cam.frame_width, fh: number = cam.frame_height, fc: number[] = cam.frame_center;
  const margin = o.margin ?? 0.1;
  const frame = { x0: fc[0] - fw / 2 + margin, x1: fc[0] + fw / 2 - margin, y0: fc[1] - fh / 2 + margin, y1: fc[1] + fh / 2 - margin };
  const { texts, shapes, units } = collect(scene);
  const px1080 = 1080 / fh;

  for (const m of [...texts, ...shapes]) {
    const b = box(m);
    if (!b) continue;
    const inside = overlap(b, frame);
    if (inside === 0 && area(b) > 0) issues.push({ rule: 'off-frame', severity: 'error', message: `${label_of(m)} is completely outside the frame.`, mobjects: [m] });
    else if (b.x0 < frame.x0 - 1e-6 || b.x1 > frame.x1 + 1e-6 || b.y0 < frame.y0 - 1e-6 || b.y1 > frame.y1 + 1e-6) {
      if (is_text(m) || area(b) < fw * fh * 0.5) issues.push({ rule: 'off-frame', severity: is_text(m) ? 'error' : 'warning', message: `${label_of(m)} is cut off at the frame edge.`, mobjects: [m] });
    }
  }
  for (let i = 0; i < texts.length; i++) {
    const a = box(texts[i])!;
    for (let j = i + 1; j < texts.length; j++) {
      const b = box(texts[j])!;
      const ov = overlap(a, b);
      if (ov > 0.08 * Math.min(area(a), area(b))) issues.push({ rule: 'text-overlap', severity: 'error', message: `${label_of(texts[i])} overlaps ${label_of(texts[j])}.`, mobjects: [texts[i], texts[j]] });
    }
    // a thin stroke passing through the middle of a label
    for (const s of shapes) {
      if (!(s instanceof VMobject) || s.get_fill_opacity() > 0.3) continue;
      if (crosses(s, shrink(a, 0.25))) {
        issues.push({ rule: 'label-crosses-line', severity: 'warning', message: `${label_of(texts[i])} is crossed by a ${class_name(s.constructor)}.`, mobjects: [texts[i], s] });
        break;
      }
    }
    const h = (a.y1 - a.y0) * px1080;
    if (h > 0 && h < (o.min_text_px ?? 14)) issues.push({ rule: 'tiny-text', severity: 'warning', message: `${label_of(texts[i])} is only ${h.toFixed(0)} px tall at 1080p.`, mobjects: [texts[i]] });
    const bg = ManimColor.parse(o.background ?? config.background_color);
    const col = (texts[i] as any).get_fill_color?.() ?? texts[i].get_color();
    const cr = contrast_ratio(ManimColor.parse(col), bg);
    if (cr < (o.min_contrast ?? 3)) issues.push({ rule: 'low-contrast', severity: 'warning', message: `${label_of(texts[i])} has contrast ${cr.toFixed(1)}:1 against the background.`, mobjects: [texts[i]] });
  }
  if (units > (o.max_texts ?? 12)) issues.push({ rule: 'crowded', severity: 'warning', message: `${units} separate pieces of text on screen at once.`, mobjects: texts });
  return issues;
}
const shrink = (b: Box, f: number): Box => {
  const dx = (b.x1 - b.x0) * f, dy = (b.y1 - b.y0) * f;
  return { x0: b.x0 + dx, x1: b.x1 - dx, y0: b.y0 + dy, y1: b.y1 - dy };
};
/** Does the stroke of s pass through box b? (samples the Bezier curves) */
function crosses(s: VMobject, b: Box): boolean {
  if (s.get_stroke_width() === 0 || s.get_stroke_opacity() < 0.05) return false;
  const p = s.points;
  for (let i = 0; i + 12 <= p.length; i += 12) {
    for (let k = 0; k <= 6; k++) {
      const t = k / 6, u = 1 - t;
      const x = u * u * u * p[i] + 3 * u * u * t * p[i + 3] + 3 * u * t * t * p[i + 6] + t * t * t * p[i + 9];
      const y = u * u * u * p[i + 1] + 3 * u * u * t * p[i + 4] + 3 * u * t * t * p[i + 7] + t * t * t * p[i + 10];
      if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return true;
    }
  }
  return false;
}

/**
 * Lint the whole timeline: the settled state at the end of each segment,
 * plus pacing (text shown and removed too quickly). Leaves the player at frame 0.
 */
export function lint_timeline(player: ScenePlayer, o: LintOptions = {}): LintIssue[] {
  const out: LintIssue[] = [];
  const segs = player.scene.segments;
  const seen = new Set<string>();
  for (let i = 0; i < segs.length; i++) {
    const end = i + 1 < segs.length ? player.seg_starts[i + 1] - 1 : player.total_frames - 1;
    if (end < 0) continue;
    player.compute_frame(end);
    for (const is of lint_frame(player.scene, o)) {
      const key = is.rule + is.message;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...is, segment: i, time: end / player.fps });
    }
    const s = segs[i];
    if (!s.is_static && s.run_time < 0.25 && s.animations.some((a: any) => a.mobject && is_text(a.mobject))) {
      out.push({ rule: 'too-fast', severity: 'warning', message: `Text animates in ${s.run_time.toFixed(2)} s at ${s.t0.toFixed(1)} s - too fast to read.`, mobjects: [], segment: i, time: s.t0 });
    }
  }
  player.compute_frame(0);
  return out;
}
