// Direct manipulation: drag points on the canvas, with constraints.
//
//   const ui = new Interaction(canvas, { onChange: redraw });
//   ui.addHandle({
//     get: () => state.P,                       // current world position
//     set: (p) => { state.P = onCircle(p); },   // apply a (constrained) drag
//     radius: 0.35,                             // hit radius in world units
//   });
//
// Handles report hover/drag state (`ui.hot`, `ui.active`) so the scene can
// highlight what is under the pointer.
import { FRAME_W, FRAME_H } from './core.js';

export class Interaction {
  constructor(canvas, o = {}) {
    this.canvas = canvas;
    this.handles = [];
    this.onChange = o.onChange ?? (() => {});
    this.hot = null;
    this.active = null;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('pointerleave', () => { if (!this.active) this.setHot(null); });
  }
  addHandle(h) {
    this.handles.push({ radius: 0.35, ...h });
    return this;
  }
  toWorld(e) {
    const r = this.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width - 0.5) * FRAME_W, (0.5 - (e.clientY - r.top) / r.height) * FRAME_H];
  }
  pick(p) {
    let best = null, bestD = Infinity;
    for (const h of this.handles) {
      const q = h.get();
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < h.radius && d < bestD) { best = h; bestD = d; }
    }
    return best;
  }
  setHot(h) {
    if (h === this.hot) return;
    this.hot = h;
    this.canvas.style.cursor = h ? (this.active ? 'grabbing' : 'grab') : 'default';
    this.onChange();
  }
  down(e) {
    const p = this.toWorld(e);
    const h = this.pick(p);
    if (!h) return;
    this.active = h;
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = 'grabbing';
    h.set(p);
    this.onChange();
  }
  move(e) {
    const p = this.toWorld(e);
    if (this.active) {
      this.active.set(p);
      this.onChange();
    } else this.setHot(this.pick(p));
  }
  up(e) {
    if (!this.active) return;
    this.active = null;
    this.canvas.style.cursor = this.hot ? 'grab' : 'default';
    this.onChange();
  }
}
