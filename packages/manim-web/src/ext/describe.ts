// Scene description (web extension): what is on screen, as data and as text.
// Grounds the AI tutor in the current picture ("the red dot at (2, 1)"),
// gives screen readers a text alternative, and lets tests assert on layout.
import { Mobject } from '../mobject/mobject';
import { VMobject } from '../mobject/types/vectorized_mobject';
import type { Scene } from '../scene/scene';
import { class_name, is_text } from './lint';

export interface ObjectDescription {
  id: string;
  type: string;
  /** Text or TeX content, or a number's value. */
  content?: string | number;
  center: [number, number];
  size: [number, number];
  color: string;
  filled: boolean;
  /** ValueTracker values and other numeric state worth reporting. */
  value?: number;
  children?: ObjectDescription[];
}
export interface SceneDescription {
  time: number;
  frame: { center: [number, number]; width: number; height: number };
  objects: ObjectDescription[];
  trackers: { id: string; value: number }[];
}

const ids = new WeakMap<Mobject, string>();
let counter = 0;
/** Stable id for a mobject (its `name` if set, otherwise Type#n). */
export function mobject_id(m: Mobject): string {
  let id = ids.get(m);
  if (!id) {
    const named = m.name && m.name !== m.constructor.name ? m.name : null;
    id = named ?? `${class_name(m.constructor)}#${++counter}`;
    ids.set(m, id);
  }
  return id;
}
const r = (x: number, d = 2) => +x.toFixed(d);

function describe(m: Mobject, depth: number, max_depth: number): ObjectDescription | null {
  const w = m.width, h = m.height;
  if (!Number.isFinite(w) || (w === 0 && h === 0 && !m.submobjects.length)) return null;
  const c = m.get_center();
  const d: ObjectDescription = {
    id: mobject_id(m), type: class_name(m.constructor), center: [r(c[0]), r(c[1])], size: [r(w), r(h)],
    color: m.get_color().to_hex(), filled: m instanceof VMobject ? m.get_fill_opacity() > 0.3 : false,
  };
  const content = (m as any).tex_string ?? (m as any).original_text;
  if (typeof content === 'string') d.content = content;
  if (typeof (m as any).get_value === 'function') {
    const v = (m as any).get_value();
    if (typeof v === 'number') d.value = r(v, 4);
  }
  if (!is_text(m) && depth < max_depth && m.submobjects.length) {
    const kids = m.submobjects.map((s) => describe(s, depth + 1, max_depth)).filter((x): x is ObjectDescription => !!x);
    if (kids.length) d.children = kids;
  }
  return d;
}

/** Structured description of what is currently on screen. */
export function describe_scene(scene: Scene, o: { max_depth?: number } = {}): SceneDescription {
  const cam = scene.camera as any;
  const trackers: { id: string; value: number }[] = [];
  const objects: ObjectDescription[] = [];
  for (const m of scene.mobjects) {
    if (class_name(m.constructor).endsWith('ValueTracker')) {
      trackers.push({ id: mobject_id(m), value: r((m as any).get_value(), 4) });
      continue;
    }
    const d = describe(m, 0, o.max_depth ?? 2);
    if (d) objects.push(d);
  }
  return { time: r(scene.time, 2), frame: { center: [r(cam.frame_center[0]), r(cam.frame_center[1])], width: r(cam.frame_width), height: r(cam.frame_height) }, objects, trackers };
}

const where = (c: [number, number], f: SceneDescription['frame']): string => {
  const x = (c[0] - f.center[0]) / (f.width / 2), y = (c[1] - f.center[1]) / (f.height / 2);
  const h = x < -0.33 ? 'left' : x > 0.33 ? 'right' : '';
  const v = y > 0.33 ? 'top' : y < -0.33 ? 'bottom' : '';
  return v || h ? `${v}${v && h ? '-' : ''}${h}` : 'centre';
};
/** Plain-language summary, one line per object (for tutors and screen readers). */
export function describe_text(scene: Scene): string {
  const d = describe_scene(scene, { max_depth: 1 });
  const lines = d.objects.map((o) => {
    const what = o.content !== undefined ? `${o.type} "${o.content}"` : o.value !== undefined ? `${o.type} ${o.value}` : o.type;
    const kids = o.children ? ` made of ${o.children.length} parts` : '';
    return `- ${what} [${o.id}], ${o.color}${o.filled ? ' filled' : ''}, ${where(o.center, d.frame)} at (${o.center.join(', ')}), ${o.size[0]}×${o.size[1]}${kids}`;
  });
  if (d.trackers.length) lines.push(`Parameters: ${d.trackers.map((t) => `${t.id} = ${t.value}`).join(', ')}`);
  return lines.join('\n');
}

