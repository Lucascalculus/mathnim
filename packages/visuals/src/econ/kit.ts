// Drawing helpers for the ECON90015 visuals (docs/lessons/econ90015): the MPC kit's plot panel,
// slider, segmented control and live labels, plus what economics diagrams add: regions between
// two curves (surplus, rent, deadweight loss) that follow trackers, a handle that drags a
// vertical line, and money written the way the lessons write it.
import { VMobject, type Mobject, type ValueTracker } from 'manim-web';
import { clamp, live_vm, poly_points, type P3, type Plot, type XY } from '../mpc/kit';

export * from '../mpc/kit';

/** Scene points of the region between top(x) and bottom(x) for x in [a, b], clipped to the plot box. */
export function between(P: Plot, top: (x: number) => number, bottom: (x: number) => number, a: number, b: number, n = 18): XY[] {
  if (b < a) [a, b] = [b, a];
  if (b - a < 1e-9) return [];
  const B = P.box;
  const pt = (x: number, y: number): XY => [clamp(P.X(x), B.x0, B.x1), clamp(P.Y(y), B.y0, B.y1)];
  const xs = Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  return [...xs.map((x) => pt(x, top(x))), ...[...xs].reverse().map((x) => pt(x, bottom(x)))];
}

/** A filled region whose outline (scene points) is recomputed when key() changes; empty when fewer than 3 points. */
export function live_fill(pts: () => readonly XY[], color: string, opacity: number, key: () => string): VMobject {
  const vm = VMobject({ fill_color: color, fill_opacity: opacity, stroke_width: 0, stroke_color: color });
  return live_vm(vm, () => {
    const p = pts();
    return p.length >= 3 ? poly_points([...p, p[0]]) : new Float64Array(0);
  }, key);
}

/** Keep m centred on where() (scene point), moved only when the point changes. */
export function follow<T extends Mobject>(m: T, where: () => readonly number[]): T {
  const upd = (x: any) => {
    const p = where();
    const k = `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
    if (x._at === k) return;
    x._at = k;
    x.move_to([p[0], p[1], 0]);
  };
  upd(m);
  m.add_updater(upd);
  return m;
}

/**
 * Drag a vertical line in a plot: the handle sits on the line x = t at data height `y` (a number, or a
 * function of x when the handle rides on a curve), and the line moves along the axis between lo and hi
 * in steps of `step` (data units).
 */
export function drag_x(ui: { add_handle(spec: any): unknown }, P: Plot, t: ValueTracker, y: number | ((x: number) => number), o: { lo: number; hi: number; step: number; label: string; on_end?: () => void }): unknown {
  const snap = (x: number) => clamp(o.lo + Math.round((x - o.lo) / o.step) * o.step, o.lo, o.hi);
  const h = (x: number) => P.Y(typeof y === 'function' ? y(x) : y);
  return ui.add_handle({
    get: (): P3 => [P.X(t.get_value()), h(t.get_value()), 0],
    set: (p: P3) => {
      const v = snap(P.data(p)[0]);
      if (v !== t.get_value()) t.set_value(v);
    },
    constraint: (p: P3): P3 => {
      const x = clamp(P.data(p)[0], o.lo, o.hi);
      return [P.X(x), h(x), 0];
    },
    step: P.X(o.step) - P.X(0),
    radius: 0.36,
    label: o.label,
    on_end: o.on_end,
  });
}

/** Money and counts as the lessons write them: 29,160 and −2,000 (a true minus sign). */
export const money = (v: number, signed = false): string => {
  const r = Math.round(v);
  const s = Math.abs(r).toLocaleString('en-US');
  return r < 0 ? `−${s}` : signed && r > 0 ? `+${s}` : s;
};
/** A number with at most `d` decimals, trailing zeros dropped. */
export const num = (v: number, d = 1): string => {
  const s = String(+v.toFixed(d));
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
};

/** Up to five round ticks from 0 to just below hi. */
export function round_ticks(hi: number, n = 4): number[] {
  const raw = hi / n, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = 0; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}
