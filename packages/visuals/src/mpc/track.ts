// The MPC course's engine kit: the cart on its rail, drawn as the course has always drawn it (the manim Track in
// kit.ts): a grey rail with a tick every metre and a number every other, "10 m" at the end; a hatched wall with a dark
// face; a flag on a pole; a rounded cart on two wheels; the plan's positions as dots on the rail; an arrow as long as
// the speed. Sizes are in the manim frame's units (`u`: px per unit, from the track's width), so the picture keeps its
// proportions at any size. They are marks in a flat plot (x in metres), so labels avoid them and the lint sees them.
import { Drawn, Dots, Plot, read, type Val, type XY } from '@mathnim/engine';
import { resolve_color } from '@mathnim/look';

/** The track's width in manim units (the old scenes put p 4..10 m on x 0.95..6.45). */
const UNITS_WIDE = 5.5;
/** Height of the track's plot above the rail, in the same units (room for the arrow over the cart). */
const UNITS_TALL = 1.33;
/** px per manim unit for marks on this track. */
export const unit_of = (P: Plot): number => P.data.w / UNITS_WIDE;

/** A track from p[0] to p[1] metres: ticks every metre, a number every other (and the unit after the last). */
export function track_plot(o: { id?: string; p: [number, number]; numbers?: number[] }): Plot {
  const ticks = Array.from({ length: Math.floor(o.p[1] - o.p[0] + 1e-9) + 1 }, (_, i) => Math.ceil(o.p[0]) + i).filter((v) => v <= o.p[1] + 1e-9);
  return new Plot({
    id: o.id ?? 'track', x: o.p, y: [0, UNITS_TALL], x_ticks: ticks, x_numbers: o.numbers ?? ticks.filter((v) => v % 2 === 0), x_unit: '\\,\\mathrm{m}',
    grid: false, axes: 'x', aspect: UNITS_WIDE / UNITS_TALL, number_tex: true, data_box: true,
    tick_marks: { x: 'out', len: 5.5, numbered_len: 9.7 }, style: { color: 'muted', text: 'muted', width: 2.1, size: 13.5 },
  });
}

/** The cart: its front bumper at p (metres); a rounded body on two wheels. */
export function cart_mark(p: Val<number>, o: { id?: string; color?: string } = {}): Drawn {
  return new Drawn((env, P) => {
    const g = env.g, u = unit_of(P), rail = P.Y(0);
    const w = 0.9 * u, h = 0.42 * u, r = 0.11 * u, xf = P.X(read(p)), cx = xf - w / 2;
    const y1 = rail - 2 * r + 0.02 * u, y0 = y1 - h;
    g.fillStyle = resolve_color(o.color ?? 'cobalt', env.look);
    g.beginPath();
    g.roundRect(cx - w / 2, y0, w, h, Math.min(0.1 * u, h / 3));
    g.fill();
    g.fillStyle = env.look.palette.ink;
    for (const f of [-0.28, 0.28]) {
      g.beginPath();
      g.arc(cx + f * w, rail - r, r, 0, Math.PI * 2);
      g.fill();
    }
    return { x: cx - w / 2, y: y0, w, h: rail - y0 };
  }, { id: o.id ?? 'cart', role: 'noun:cart', z: 4 });
}

/** The wall at p (metres): a grey block with its hatching and a dark face. */
export function wall_mark(at: number, o: { id?: string } = {}): Drawn {
  return new Drawn((env, P) => {
    const g = env.g, u = unit_of(P), x = P.X(at), rail = P.Y(0), p = env.look.palette;
    const b = { x, y: rail - 0.95 * u, w: 0.32 * u, h: 1.0 * u };
    g.fillStyle = p.faint;
    g.fillRect(b.x, b.y, b.w, b.h);
    // 45° hatching, clipped to the block
    g.save();
    g.beginPath();
    g.rect(b.x, b.y, b.w, b.h);
    g.clip();
    g.strokeStyle = p.muted;
    g.lineWidth = 1.4;
    g.beginPath();
    for (let s = -b.h; s < b.w; s += 0.16 * u) {
      g.moveTo(b.x + s, b.y + b.h);
      g.lineTo(b.x + s + b.h, b.y);
    }
    g.stroke();
    g.restore();
    g.strokeStyle = p.ink;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(x, b.y);
    g.lineTo(x, b.y + b.h);
    g.stroke();
    return b;
  }, { id: o.id ?? 'wall', role: 'noun:wall', z: 3 });
}

/** The flag (the target) at p (metres): a pole and its cloth. */
export function flag_mark(at: number, o: { id?: string } = {}): Drawn {
  return new Drawn((env, P) => {
    const g = env.g, u = unit_of(P), x = P.X(at), rail = P.Y(0), top = rail - 0.8 * u;
    g.strokeStyle = env.look.palette.ink;
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(x, rail);
    g.lineTo(x, top);
    g.stroke();
    g.fillStyle = env.look.palette.viridian;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x - 0.34 * u, top + 0.13 * u);
    g.lineTo(x, top + 0.26 * u);
    g.closePath();
    g.fill();
    return { x: x - 0.34 * u, y: top, w: 0.34 * u, h: rail - top };
  }, { id: o.id ?? 'flag', role: 'noun:goal', z: 3 });
}

/** Positions (metres) as dots on the rail (a plan's predictions). */
export function position_dots(ps: Val<number[]>, o: { id?: string; role?: string; color?: string } = {}): Dots {
  // (radius and height in manim units, as the old ghosts: 0.05 and 0.04 above the rail)
  return new Dots(() => read(ps).map((q): XY => [q, 0.04]), { id: o.id ?? 'plan_dots', role: o.role ?? 'noun:plan', r: 3.5, style: { fill_alpha: 0.85, ...(o.color ? { color: o.color } : {}) } });
}

/** An arrow above the cart, from a little behind its front, as long as its speed (as the old live_arrow). */
export function speed_arrow(p: Val<number>, v: Val<number>, o: { id?: string } = {}): Drawn {
  return new Drawn((env, P) => {
    const vv = read(v);
    if (vv < 0.04) return null;
    const g = env.g, u = unit_of(P), y = P.Y(0) - 1.18 * u, x0 = P.X(read(p)) - 0.45 * u, x1 = x0 + Math.max(0.02, vv * 0.6) * u;
    const tip = 0.16 * u, col = env.look.palette.ink;
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = 2.8;
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1 - tip * 0.8, y);
    g.stroke();
    g.beginPath();
    g.moveTo(x1, y);
    g.lineTo(x1 - tip, y - tip * 0.5);
    g.lineTo(x1 - tip, y + tip * 0.5);
    g.closePath();
    g.fill();
    return { x: x0, y: y - tip * 0.5, w: x1 - x0, h: tip };
  }, { id: o.id ?? 'speed', role: 'noun:speed', z: 4 });
}
