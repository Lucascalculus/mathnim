// TeX, typeset once by MathJax (through manim-web's wrapper, which turns it into plain SVG paths) and cached as Path2D
// in TeX units (1 unit = 1 pt at 10 pt type); drawn at any size and colour. The baseline is TeX's y = 0.
import { init_tex, tex_ready, tex_to_svg } from 'manim-web/utils/tex/mathjax';
import { look } from '@mathnim/look';

export interface TexShape {
  /** Width, ascent above the baseline and descent below it, in TeX units. */
  w: number;
  asc: number;
  desc: number;
  /** x offset of the first ink (the viewBox's left). */
  x0: number;
  paths: string[];
  rects: [number, number, number, number][];
  /** A `\\color` given in the TeX, per path and per rect (null: the colour it is drawn with). */
  path_fill: (string | null)[];
  rect_fill: (string | null)[];
  /** Path2D per path (made on first draw; Path2D comes from the canvas library in node). */
  _p2d?: Path2D[];
}
const cache = new Map<string, TexShape>();
export const tex_loaded = (): boolean => tex_ready();
export const load_tex = (): Promise<void> => init_tex();

export function tex_shape(src: string): TexShape {
  let s = cache.get(src);
  if (s) return s;
  const svg = tex_to_svg(src, 'align*');
  const vb = /viewBox='([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)'/.exec(svg);
  const [vx, vy, vw, vh] = vb ? vb.slice(1).map(Number) : [0, -8, 10, 10];
  const pm = [...svg.matchAll(/<path d='([^']*)'(?: fill='([^']*)')?/g)];
  const rm = [...svg.matchAll(/<rect x='([-\d.]+)' y='([-\d.]+)' height='([-\d.]+)' width='([-\d.]+)'(?: fill='([^']*)')?\/>/g)];
  const paths = pm.map((m) => m[1]), path_fill = pm.map((m) => m[2] ?? null);
  const rects = rm.map((m) => [+m[1], +m[2], +m[4], +m[3]] as [number, number, number, number]), rect_fill = rm.map((m) => m[5] ?? null);
  s = { w: vw, asc: -vy, desc: vy + vh, x0: vx, paths, rects, path_fill, rect_fill };
  if (cache.size > 2000) cache.clear();
  cache.set(src, s);
  return s;
}
/** px per TeX unit for text of size `px` (TeX sets 10 pt type in a 10-unit em). */
export const tex_scale = (px: number): number => (px * look().type.tex_scale) / 10;
export function tex_size(src: string, px: number): { w: number; asc: number; desc: number } {
  const s = tex_shape(src), k = tex_scale(px);
  return { w: s.w * k, asc: s.asc * k, desc: s.desc * k };
}
/** Draw TeX with its left edge at x and its baseline at y. */
export function draw_tex(g: CanvasRenderingContext2D, src: string, x: number, y: number, px: number, color: string): void {
  const s = tex_shape(src), k = tex_scale(px);
  const P = (globalThis as { Path2D?: typeof Path2D }).Path2D;
  if (!P) return;
  s._p2d ??= s.paths.map((d) => new P(d));
  g.save();
  g.translate(x - s.x0 * k, y);
  g.scale(k, k);
  s._p2d.forEach((p, i) => {
    g.fillStyle = s.path_fill[i] ?? color;
    g.fill(p);
  });
  s.rects.forEach(([rx, ry, rw, rh], i) => {
    g.fillStyle = s.rect_fill[i] ?? color;
    g.fillRect(rx, ry, rw, rh);
  });
  g.restore();
}
