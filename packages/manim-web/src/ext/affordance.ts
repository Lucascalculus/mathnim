// Affordances for interactive scenes (web extension): make every draggable
// thing visible and self-explaining without changing the scene itself.
//
// Drawn on a transparent overlay canvas above the scene canvas:
// * a pulsing halo on each handle until it has been used, then a quiet ring;
// * arrows showing the directions the handle can move (from its constraint);
// * a "Drag me" label (the handle's label) until first use;
// * while hovering or dragging: the allowed path as a dashed line;
// * a coach mark: a ghost hand that demonstrates the drag once.
//
// Interactive items (draggables, drop zones, stamps, scrubbers, cutters) draw
// their own cues through `draw_affordance(ctx)` with the helpers of an
// AffordanceCtx (halo, dashed outline, label kept inside the canvas...).
//
//   const ui = new Interaction(player);
//   const aff = new AffordanceLayer(ui, { color: '#2563EB' });
//   aff.coach();                       // show the drag once
import type { Point3D, Point3DLike } from '../utils/vector';
import type { AffordanceCtx, DragHandle, Interaction, InteractiveItem } from './interact';
import { prefers_reduced_motion } from './juice';

export interface AffordanceOptions {
  color?: string;
  /** Text next to unused handles; `{label}` is replaced by the handle label. */
  hint?: string;
  /** Halo radius in CSS pixels. */
  radius?: number;
}

type XY = [number, number];

export class AffordanceLayer {
  ui: Interaction;
  overlay: HTMLCanvasElement;
  o: Required<AffordanceOptions>;
  private raf = 0;
  private used = new WeakSet<DragHandle>();
  private used_items = new WeakSet<InteractiveItem>();
  private used_kinds = new Set<string>();
  private coach_t0 = -1;
  private coach_path: XY[] | null = null;
  private coach_ms = 2600;
  private coach_knife = false;
  private coach_still = false;
  private t0 = performance.now();
  /** Treat every handle and item as used (e.g. the learner acted through another control): no more "drag me" cues. */
  mark_all_used(): void {
    for (const h of this.ui.handles) this.used.add(h);
    for (const it of this.ui.items) {
      this.used_items.add(it);
      this.used_kinds.add(it.kind);
    }
  }

  constructor(ui: Interaction, o: AffordanceOptions = {}) {
    this.ui = ui;
    this.o = { color: o.color ?? '#2563EB', hint: o.hint ?? 'Drag {label}', radius: o.radius ?? 18 };
    const c = ui.canvas;
    const parent = c.parentElement!;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'mw-affordance';
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', border: '0', aspectRatio: 'auto' });
    // host pages may style every canvas (backgrounds, borders); the overlay must stay see-through
    this.overlay.style.setProperty('background', 'transparent', 'important');
    c.insertAdjacentElement('afterend', this.overlay);
    const prev = ui.on_change;
    ui.on_change = () => {
      for (const h of ui.handles) if (h.active || h.focused) this.used.add(h);
      if (ui.handles.some((h) => h.active) || ui.items.some((it) => it.active)) this.coach_t0 = -1;
      prev();
    };
    const loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.overlay.remove();
  }
  /** Scene point -> overlay CSS pixels. */
  private px(p: Point3D | Point3DLike): XY {
    const cam = this.ui.player.scene.camera as any;
    const r = this.ui.canvas.getBoundingClientRect();
    return [((p[0] - cam.frame_center[0]) / cam.frame_width + 0.5) * r.width, (0.5 - (p[1] - cam.frame_center[1]) / cam.frame_height) * r.height];
  }
  /** Directions a handle can move: 0 (fixed), 1 (a line: unit vector) or 2 (free). */
  private freedom(h: DragHandle): { dims: number; dir: XY } {
    const p = h.position();
    const s = h.spec;
    // one-parameter handles move along the curve value -> position
    if (s.tracker && s.from_value) {
      const v = s.tracker.get_value(), dv = (s.step ?? 0.1) * 2;
      for (const sign of [1, -1]) {
        const q = s.from_value(v + sign * dv) as number[];
        const d: XY = [(q[0] - p[0]) * sign, (q[1] - p[1]) * sign];
        const l = Math.hypot(...d);
        if (l > 1e-6) return { dims: 1, dir: [d[0] / l, d[1] / l] };
      }
      return { dims: 0, dir: [1, 0] };
    }
    const c = s.constraint;
    if (!c) return { dims: 2, dir: [1, 0] };
    const e = 0.25;
    const a = c([p[0] + e, p[1], p[2]]), b = c([p[0], p[1] + e, p[2]]);
    const va: XY = [a[0] - p[0], a[1] - p[1]], vb: XY = [b[0] - p[0], b[1] - p[1]];
    const la = Math.hypot(...va), lb = Math.hypot(...vb);
    if (la < 1e-6 && lb < 1e-6) {
      // at an end of its range: look the other way
      const a2 = c([p[0] - e, p[1], p[2]]), b2 = c([p[0], p[1] - e, p[2]]);
      const v2: XY = Math.hypot(a2[0] - p[0], a2[1] - p[1]) > Math.hypot(b2[0] - p[0], b2[1] - p[1]) ? [a2[0] - p[0], a2[1] - p[1]] : [b2[0] - p[0], b2[1] - p[1]];
      const l2 = Math.hypot(...v2);
      return l2 < 1e-6 ? { dims: 0, dir: [1, 0] } : { dims: 1, dir: [v2[0] / l2, v2[1] / l2] };
    }
    const cross = Math.abs(va[0] * vb[1] - va[1] * vb[0]);
    if (la > 1e-6 && lb > 1e-6 && cross > 0.2 * la * lb) return { dims: 2, dir: [1, 0] };
    const v = la >= lb ? va : vb, l = Math.max(la, lb);
    return { dims: 1, dir: [v[0] / l, v[1] / l] };
  }
  /** Sample the path a handle can travel (for the dashed preview and the coach mark). */
  private path(h: DragHandle): Point3D[] {
    const s = h.spec;
    if (s.tracker && s.from_value && s.to_value) {
      const v = s.tracker.get_value();
      const out: Point3D[] = [];
      // walk outwards until the constraint stops moving the point
      for (const sign of [-1, 1]) {
        let prev = h.position();
        for (let k = 1; k <= 60; k++) {
          const q = s.from_value(v + sign * k * (s.step ?? 0.1) * 2) as Point3D;
          const cq = s.constraint ? s.constraint(q as Point3D) : (q as Point3D);
          const vv = s.to_value(cq);
          const pq = s.from_value(vv) as Point3D;
          if (Math.hypot(pq[0] - prev[0], pq[1] - prev[1]) < 1e-4) break;
          if (sign < 0) out.unshift(pq);
          else out.push(pq);
          prev = pq;
        }
        if (sign < 0) out.push(h.position());
      }
      return out;
    }
    const { dims, dir } = this.freedom(h);
    if (dims !== 1) return [];
    const p = h.position();
    const out: Point3D[] = [];
    for (let k = -40; k <= 40; k++) {
      const q: Point3D = [p[0] + dir[0] * k * 0.15, p[1] + dir[1] * k * 0.15, p[2]];
      out.push(s.constraint ? s.constraint(q) : q);
    }
    return out;
  }
  /**
   * Demonstrate a drag with a ghost hand (runs ~2.4 s): the first handle by
   * default, else the first item with a coach path (a draggable goes to its
   * zone, a knife swipes with a dashed trail, a stamp taps).
   */
  coach(h: DragHandle | InteractiveItem | undefined = this.ui.handles[0] ?? this.ui.items.find((it) => it.enabled !== false && !!it.coach_path)): void {
    if (!h) return;
    if (!('spec' in h)) {
      const path = h.coach_path?.();
      if (!path || path.points.length < 2) return;
      this.coach_path = path.points.map((q) => this.px(q));
      this.coach_ms = path.ms ?? 2600;
      this.coach_knife = !!path.knife;
      this.coach_still = prefers_reduced_motion();
      this.coach_t0 = performance.now();
      return;
    }
    this.coach_ms = 2600;
    this.coach_knife = false;
    this.coach_still = false;
    const p = h.position();
    const { dims, dir } = this.freedom(h);
    const amp = 1.2;
    let a: Point3D, b: Point3D;
    if (dims === 2) {
      a = [p[0] - amp * 0.6, p[1] - amp * 0.4, 0];
      b = [p[0] + amp * 0.6, p[1] + amp * 0.4, 0];
    } else {
      const raw = (sg: number): Point3D => [p[0] + sg * dir[0] * amp, p[1] + sg * dir[1] * amp, 0];
      const c = h.spec.constraint ?? ((q: Point3D) => q);
      a = c(raw(-1));
      b = c(raw(1));
    }
    this.coach_path = [this.px(p), this.px(b), this.px(p), this.px(a), this.px(p)];
    this.coach_t0 = performance.now();
  }

  private draw(): void {
    const c = this.overlay, dpr = globalThis.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
    }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    const t = (performance.now() - this.t0) / 1000;
    const col = this.o.color;
    for (const h of this.ui.handles) {
      const [x, y] = this.px(h.position());
      const fresh = !this.used.has(h);
      const R = this.o.radius * (h.active ? 1.25 : h.hot || h.focused ? 1.15 : 1);
      // allowed path while hovering / dragging / focused
      if (h.hot || h.active || h.focused) {
        const pts = this.path(h).map((q) => this.px(q));
        if (pts.length > 1) {
          g.save();
          g.setLineDash([6, 6]);
          g.strokeStyle = col;
          g.globalAlpha = 0.55;
          g.lineWidth = 2;
          g.beginPath();
          pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
          g.stroke();
          g.restore();
        }
      }
      // pulsing halo while unused, quiet ring afterwards
      if (fresh && !h.active) {
        for (const phase of [0, 0.5]) {
          const k = (t * 0.8 + phase) % 1;
          g.beginPath();
          g.arc(x, y, R * (1 + k * 1.2), 0, Math.PI * 2);
          g.strokeStyle = col;
          g.globalAlpha = 0.45 * (1 - k);
          g.lineWidth = 2.5;
          g.stroke();
        }
      }
      g.globalAlpha = h.active ? 0.22 : 0.12;
      g.beginPath();
      g.arc(x, y, R, 0, Math.PI * 2);
      g.fillStyle = col;
      g.fill();
      g.globalAlpha = 0.9;
      g.lineWidth = h.focused ? 3 : 2;
      g.strokeStyle = col;
      g.stroke();
      // direction arrows
      const { dims, dir } = this.freedom(h);
      const dirs: XY[] = dims === 2 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : dims === 1 ? [dir, [-dir[0], -dir[1]]] : [];
      g.globalAlpha = 0.9;
      g.fillStyle = col;
      for (const [dx, dy] of dirs) {
        const ux = dx, uy = -dy; // screen y is down
        const bx = x + ux * (R + 7), by = y + uy * (R + 7);
        g.beginPath();
        g.moveTo(bx + ux * 7, by + uy * 7);
        g.lineTo(bx - uy * 5, by + ux * 5);
        g.lineTo(bx + uy * 5, by - ux * 5);
        g.closePath();
        g.fill();
      }
      // label until first use (only on the first unused handle, to avoid clutter)
      if (fresh && !h.active && h === this.ui.handles.find((x) => !this.used.has(x))) {
        pill(g, this.o.hint.replace('{label}', h.spec.label ?? 'me'), x, y, R, r.width, r.height, col);
      }
      g.globalAlpha = 1;
    }
    this.draw_items(g, t, r.width, r.height);
    this.draw_coach(g, performance.now());
  }
  /** Cues of interactive items (each draws itself with the ctx helpers). */
  private draw_items(g: CanvasRenderingContext2D, t: number, W: number, H: number): void {
    const items = this.ui.items;
    if (!items.length) return;
    const col = this.o.color;
    const cam = this.ui.player.scene.camera as any;
    const reduced = prefers_reduced_motion();
    const seen = new Set<unknown>();
    // one text hint on screen at a time: an unused handle already shows one
    let hinted = this.ui.handles.some((h) => !this.used.has(h));
    const base: AffordanceCtx = {
      g, t, color: col, width: W, height: H, fresh: false, lead: false, show_hint: false, reduced_motion: reduced,
      ppu: W / cam.frame_width,
      px: (p) => this.px(p),
      once: (key) => (seen.has(key) ? false : (seen.add(key), true)),
      halo: (x, y, R0, o = {}) => {
        const R = R0 * (o.active ? 1.12 : o.focused ? 1.06 : 1);
        if (o.pulse) {
          for (const phase of reduced ? [0.35] : [0, 0.5]) {
            const k = reduced ? phase : (t * 0.8 + phase) % 1;
            g.beginPath();
            g.arc(x, y, R * (1 + k * 0.6), 0, Math.PI * 2);
            g.strokeStyle = col;
            g.globalAlpha = 0.45 * (1 - k);
            g.lineWidth = 2.5;
            g.stroke();
          }
        }
        g.globalAlpha = o.active ? 0.2 : 0.1;
        g.beginPath();
        g.arc(x, y, R, 0, Math.PI * 2);
        g.fillStyle = col;
        g.fill();
        g.globalAlpha = 0.9;
        g.lineWidth = o.focused ? 3 : 2;
        g.strokeStyle = col;
        g.stroke();
        g.globalAlpha = 1;
      },
      outline: (pts, o = {}) => {
        if (pts.length < 2) return;
        g.save();
        g.setLineDash(o.dash ?? [7, 6]);
        g.lineDashOffset = o.dash_offset ?? 0;
        g.strokeStyle = o.color ?? col;
        g.fillStyle = o.color ?? col;
        g.lineWidth = o.width ?? 2;
        g.beginPath();
        pts.forEach((q, i) => {
          const [px, py] = this.px(q);
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        });
        if (o.closed ?? true) g.closePath();
        if (o.fill_alpha) {
          g.globalAlpha = o.fill_alpha;
          g.fill();
        }
        g.globalAlpha = o.alpha ?? 0.7;
        g.stroke();
        g.restore();
      },
      label: (text, x, y, o = {}) => {
        if (o.avoid !== undefined) pill(g, text, x, y, o.avoid, W, H, o.color ?? col, o.below);
        else pill_at(g, text, x, y, W, H, o.color ?? col);
      },
      arrows: (x, y, R, dirs) => {
        g.globalAlpha = 0.9;
        g.fillStyle = col;
        for (const [ux, uy] of dirs) {
          const bx = x + ux * R, by = y + uy * R;
          g.beginPath();
          g.moveTo(bx + ux * 7, by + uy * 7);
          g.lineTo(bx - uy * 5, by + ux * 5);
          g.lineTo(bx + uy * 5, by - ux * 5);
          g.closePath();
          g.fill();
        }
        g.globalAlpha = 1;
      },
    };
    const led = new Set<string>();
    for (const it of items) if (it.active || it.focused) {
      this.used_items.add(it);
      this.used_kinds.add(it.kind);
    }
    for (const it of items) {
      if (it.enabled === false || !it.draw_affordance) continue;
      const fresh = !this.used_items.has(it) && !this.used_kinds.has(it.kind);
      const lead = fresh && !led.has(it.kind);
      if (lead) led.add(it.kind);
      const show_hint = fresh && !hinted && !!it.hint;
      if (show_hint) hinted = true;
      g.save();
      try {
        it.draw_affordance({ ...base, fresh, lead, show_hint });
      } finally {
        g.restore();
        g.globalAlpha = 1;
      }
    }
  }
  private draw_coach(g: CanvasRenderingContext2D, now: number): void {
    if (this.coach_t0 < 0 || !this.coach_path) return;
    const dur = this.coach_ms;
    const u = (now - this.coach_t0) / dur;
    if (u >= 1) {
      this.coach_t0 = -1;
      return;
    }
    const path = this.coach_path;
    const segs = path.length - 1;
    // reduced motion: a still hand at the end of the path (and the whole knife line)
    const s = this.coach_still ? segs - 1e-9 : Math.min(segs - 1e-9, u * segs);
    const i = Math.floor(s), f = s - i;
    const e = this.coach_still ? 1 : f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
    const [x0, y0] = path[i], [x1, y1] = path[i + 1];
    const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e;
    const fade = Math.min(1, u * 8, (1 - u) * 8);
    if (this.coach_knife) {
      // the cut the hand is drawing: a dashed trail from the start to the hand
      g.save();
      g.setLineDash([9, 7]);
      g.lineDashOffset = this.coach_still ? 0 : -(now - this.coach_t0) / 25;
      g.strokeStyle = this.o.color;
      g.globalAlpha = 0.85 * fade;
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(path[0][0], path[0][1]);
      for (let k = 1; k <= i; k++) g.lineTo(path[k][0], path[k][1]);
      g.lineTo(x, y);
      g.stroke();
      g.restore();
    }
    g.save();
    g.globalAlpha = 0.9 * fade;
    drawHand(g, x - 1.5, y + 1.5);
    g.restore();
  }
}

const FONT = (px: number) => `600 ${px}px Inter, ui-sans-serif, system-ui, sans-serif`;
/** Font size (13 px, down to 10 px) and text that fit in `max` pixels (ellipsis as a last resort). */
function fit_text(g: CanvasRenderingContext2D, text: string, max: number): { text: string; w: number } {
  for (let px = 13; px >= 10; px--) {
    g.font = FONT(px);
    const w = g.measureText(text).width + 16;
    if (w <= max) return { text, w };
  }
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width + 16 > max) t = t.slice(0, -1);
  return { text: t + '…', w: Math.min(max, g.measureText(t + '…').width + 16) };
}
/**
 * A hint pill next to a point (x, y) that keeps clear of radius R: right of
 * it, else left, else centred above (or `below`); always inside the canvas.
 */
function pill(g: CanvasRenderingContext2D, raw: string, x: number, y: number, R: number, W: number, H: number, color: string, below = false): void {
  const { text, w } = fit_text(g, raw, W - 8);
  let lx = x + R + 22, ly = y - R - 16;
  if (lx + w > W - 4) lx = x - R - 22 - w;
  // fits on neither side: centre it above (or below) the point, inside the canvas
  if (lx < 4 || below) {
    lx = x - w / 2;
    ly = below ? y + R + 10 : y - R - 34;
  }
  if (ly < 4) ly = y + R + 10;
  draw_pill(g, text, Math.min(Math.max(4, lx), W - w - 4), Math.min(Math.max(4, ly), H - 28), w, color);
}
/** A hint pill centred on (x, y), inside the canvas. */
function pill_at(g: CanvasRenderingContext2D, raw: string, x: number, y: number, W: number, H: number, color: string): void {
  const { text, w } = fit_text(g, raw, W - 8);
  draw_pill(g, text, Math.min(Math.max(4, x - w / 2), W - w - 4), Math.min(Math.max(4, y - 12), H - 28), w, color);
}
function draw_pill(g: CanvasRenderingContext2D, text: string, lx: number, ly: number, w: number, color: string): void {
  g.globalAlpha = 0.95;
  g.fillStyle = color;
  roundRect(g, lx, ly, w, 24, 12);
  g.fill();
  g.fillStyle = '#fff';
  g.fillText(text, lx + 8, ly + 16.5);
  g.globalAlpha = 1;
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
/** A simple pointing hand (index finger at x, y). */
function drawHand(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.translate(x, y);
  g.scale(1.1, 1.1);
  const path = new Path2D('M0 0 C0 -2 3 -2 3 0 L3 10 C3 8 6 8 6 10 L6 12 C6 10 9 10 9 12 L9 14 C9 12 12 12 12 14 L12 22 C12 28 8 31 4 31 L0 31 C-4 31 -6 28 -8 25 L-12 18 C-13 16 -10 14 -8 16 L-3 21 L-3 0 Z');
  g.shadowColor = 'rgba(0,0,0,0.25)';
  g.shadowBlur = 6;
  g.fillStyle = '#ffffff';
  g.fill(path);
  g.shadowBlur = 0;
  g.lineWidth = 1.6;
  g.strokeStyle = '#111113';
  g.stroke(path);
}
