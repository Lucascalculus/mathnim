// Draw-your-prediction overlay: the learner sketches a curve (or places a
// point) on top of the scene; strokes are kept in data coordinates.
import type { XY } from '@mathnim/core';

export interface SketchMapping {
  /** CSS-pixel position in the overlay -> data coordinates. */
  to_data(px: number, py: number): XY;
  /** Data coordinates -> CSS-pixel position. */
  to_px(x: number, y: number): XY;
}

export class SketchPad {
  canvas: HTMLCanvasElement;
  points: XY[] = [];
  mode: 'curve' | 'point' = 'curve';
  color = '#2f5bd3';
  /** Drawing area in data coordinates (shaded and framed until the learner draws). */
  area: { x: [number, number]; y: [number, number] } | null = null;
  placeholder = '';
  private demo_t0 = -1;
  private raf = 0;
  on_change: () => void = () => {};
  private drawing = false;
  private map: SketchMapping;
  constructor(canvas: HTMLCanvasElement, map: SketchMapping) {
    this.canvas = canvas;
    this.map = map;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', () => this.up());
    canvas.addEventListener('pointercancel', () => this.up());
    new ResizeObserver(() => this.redraw()).observe(canvas);
  }
  set_mapping(map: SketchMapping): void {
    this.map = map;
    this.redraw();
  }
  private local(e: PointerEvent): XY {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  /** Animate a ghost stroke across the area once, to show what to do. */
  demo(): void {
    this.demo_t0 = performance.now();
    cancelAnimationFrame(this.raf);
    const loop = () => {
      this.redraw();
      if (this.demo_t0 >= 0) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  private down(e: PointerEvent): void {
    this.demo_t0 = -1;
    this.canvas.setPointerCapture(e.pointerId);
    const [px, py] = this.local(e);
    if (this.mode === 'point') {
      this.points = [this.map.to_data(px, py)];
    } else {
      this.drawing = true;
      this.points = [this.map.to_data(px, py)];
    }
    this.redraw();
    this.on_change();
  }
  private move(e: PointerEvent): void {
    if (!this.drawing) return;
    const [px, py] = this.local(e);
    const p = this.map.to_data(px, py);
    const last = this.points[this.points.length - 1];
    // keep the curve a function of x: drop points that go backwards
    if (!last || p[0] > last[0]) this.points.push(p);
    this.redraw();
  }
  private up(): void {
    if (this.drawing) {
      this.drawing = false;
      this.on_change();
    }
  }
  clear(): void {
    this.points = [];
    this.truth = null;
    this.redraw();
    this.on_change();
  }
  /** Also draw the true curve (after checking) for comparison. */
  truth: XY[] | null = null;
  redraw(): void {
    const c = this.canvas, dpr = globalThis.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
    }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    const path = (pts: XY[], color: string, width: number, dash: number[] = []) => {
      if (!pts.length) return;
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const [px, py] = this.map.to_px(x, y);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      });
      g.setLineDash(dash);
      g.strokeStyle = color;
      g.lineWidth = width;
      g.lineCap = g.lineJoin = 'round';
      g.stroke();
    };
    if (this.area) {
      const [x0, x1] = this.area.x, [y0, y1] = this.area.y;
      const [ax, ay] = this.map.to_px(x0, y1), [bx, by] = this.map.to_px(x1, y0);
      const empty = !this.points.length && !this.truth;
      g.save();
      g.fillStyle = this.color;
      g.globalAlpha = empty ? 0.07 : 0.03;
      g.fillRect(ax, ay, bx - ax, by - ay);
      g.globalAlpha = empty ? 0.8 : 0.3;
      g.setLineDash([7, 6]);
      g.lineWidth = 1.5;
      g.strokeStyle = this.color;
      g.strokeRect(ax, ay, bx - ax, by - ay);
      g.setLineDash([]);
      if (empty && this.placeholder) {
        // up to two centred lines that fit the area
        g.globalAlpha = 0.9;
        g.textAlign = 'center';
        g.fillStyle = this.color;
        const w = bx - ax - 16;
        const [first, ...rest] = this.placeholder.split(': ');
        const lines = rest.length ? [first, rest.join(': ')] : [first];
        let size = 15;
        g.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
        while (size > 10 && Math.max(...lines.map((l) => g.measureText(l).width)) > w) {
          size--;
          g.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
        }
        lines.forEach((l, i) => g.fillText(i === 0 ? l : l.charAt(0).toUpperCase() + l.slice(1), (ax + bx) / 2, ay + 22 + i * (size + 5)));
      }
      // ghost stroke demo: a pen sweeping left to right
      if (empty && this.demo_t0 >= 0) {
        const u = (performance.now() - this.demo_t0) / 2400;
        if (u > 1.15) this.demo_t0 = -1;
        else {
          const k = Math.min(1, u);
          const pts: XY[] = [];
          for (let i = 0; i <= 40 * k; i++) {
            const t = i / 40;
            pts.push([ax + (bx - ax) * (0.05 + 0.9 * t), ay + (by - ay) * (0.75 - 0.45 * Math.sin(Math.PI * t) * (1 - 0.3 * t))]);
          }
          g.globalAlpha = 0.45 * Math.min(1, (1.15 - u) * 5);
          g.lineWidth = 3;
          g.lineCap = 'round';
          g.setLineDash([2, 7]);
          g.beginPath();
          pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.stroke();
          const [hx, hy] = pts[pts.length - 1];
          g.setLineDash([]);
          g.globalAlpha = 0.9 * Math.min(1, (1.15 - u) * 5);
          g.beginPath();
          g.arc(hx, hy, 6, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
    }
    if (this.truth) path(this.truth, 'rgba(31,138,91,0.9)', 3, [8, 6]);
    if (this.mode === 'point' && this.points.length) {
      const [px, py] = this.map.to_px(...this.points[0]);
      g.beginPath();
      g.arc(px, py, 7, 0, Math.PI * 2);
      g.fillStyle = this.color;
      g.fill();
    } else path(this.points, this.color, 3.5);
  }
}
