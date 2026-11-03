// The MPC course's engine kit: the cart on its rail as marks in a flat plot (positions in metres along x). The rail
// is the plot's x axis (its ticks are metres); the cart, the wall, the flag and the predicted positions are marks, so
// labels avoid them and the lint sees them. Colours come from the look's nouns: the cart and its plan are cobalt,
// the wall ochre, the flag viridian.
import { Drawn, Dots, Plot, read, rgba, type Val, type XY } from '@mathnim/engine';

/** A track from p[0] to p[1] metres (x ticks every metre, numbers every `every`). */
export function track_plot(o: { id?: string; p: [number, number]; ticks?: number[] }): Plot {
  const ticks = o.ticks ?? Array.from({ length: Math.floor(o.p[1] - o.p[0]) + 1 }, (_, i) => Math.ceil(o.p[0]) + i).filter((v) => v <= o.p[1]);
  return new Plot({ id: o.id ?? 'track', x: o.p, y: [0, 1], x_ticks: ticks, grid: false, axes: 'x', aspect: 7, phone_aspect: 4.6, x_label: 'p\\;(\\mathrm{m})' });
}

/** The cart: its front bumper at p (metres); a rounded body behind it on two wheels. */
export function cart_mark(p: Val<number>, o: { id?: string } = {}): Drawn {
  return new Drawn((env, P) => {
    const g = env.g, x1 = P.X(read(p)), base = P.Y(0) - 1;
    const len = Math.max(26, Math.min(46, P.data.w * 0.08)), h = Math.max(13, len * 0.42), r = h * 0.28;
    const x0 = x1 - len, y0 = base - h - 5;
    g.fillStyle = env.look.palette.cobalt;
    g.beginPath();
    g.roundRect(x0, y0, len, h, r);
    g.fill();
    g.fillStyle = env.look.palette.ink;
    for (const wx of [x0 + len * 0.24, x0 + len * 0.76]) {
      g.beginPath();
      g.arc(wx, base - 3.5, 3.5, 0, Math.PI * 2);
      g.fill();
    }
    return { x: x0, y: y0, w: len, h: h + 5 };
  }, { id: o.id ?? 'cart', role: 'noun:cart', z: 4 });
}

/** The wall at p (metres): an ochre post with its hatching. */
export function wall_mark(at: number, o: { id?: string } = {}): Drawn {
  return new Drawn((env, P) => {
    const g = env.g, x = P.X(at), base = P.Y(0), top = P.data.y + 2, col = env.look.palette.ochre;
    g.fillStyle = col;
    g.fillRect(x, top, 5, base - top);
    g.strokeStyle = rgba(col, 0.55);
    g.lineWidth = 1.25;
    g.beginPath();
    for (let y = top + 4; y < base; y += 7) {
      g.moveTo(x + 5, y);
      g.lineTo(x + 11, y - 6);
    }
    g.stroke();
    return { x, y: top, w: 11, h: base - top };
  }, { id: o.id ?? 'wall', role: 'noun:wall', z: 3 });
}

/** The flag (the target) at p (metres). */
export function flag_mark(at: number, o: { id?: string } = {}): Drawn {
  return new Drawn((env, P) => {
    const g = env.g, x = P.X(at), base = P.Y(0), top = P.data.y + 4, col = env.look.palette.viridian;
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x, top);
    g.stroke();
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x - 13, top + 5);
    g.lineTo(x, top + 10);
    g.closePath();
    g.fill();
    return { x: x - 13, y: top, w: 14, h: base - top };
  }, { id: o.id ?? 'flag', role: 'noun:goal', z: 3 });
}

/** Positions (metres) shown as dots just above the rail (a plan's predictions). */
export function position_dots(ps: Val<number[]>, o: { id?: string; role?: string; r?: number } = {}): Dots {
  return new Dots(() => read(ps).map((q): XY => [q, 0.16]), { id: o.id ?? 'plan_dots', role: o.role ?? 'noun:plan', r: o.r ?? 3.6 });
}

/** An arrow from the cart's back, as long as its speed (metres per second → metres on the track). */
export function speed_arrow(p: Val<number>, v: Val<number>, o: { id?: string; scale?: number } = {}): Drawn {
  return new Drawn((env, P) => {
    const vv = read(v);
    if (vv < 0.04) return null;
    const g = env.g, y = P.data.y + 6, x0 = P.X(read(p)), x1 = P.X(read(p) + vv * (o.scale ?? 0.6));
    g.strokeStyle = env.look.palette.teal;
    g.fillStyle = env.look.palette.teal;
    g.lineWidth = 2.25;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1 - 5, y);
    g.stroke();
    g.beginPath();
    g.moveTo(x1, y);
    g.lineTo(x1 - 8, y - 4.5);
    g.lineTo(x1 - 8, y + 4.5);
    g.closePath();
    g.fill();
    return { x: x0, y: y - 5, w: x1 - x0, h: 10 };
  }, { id: o.id ?? 'speed', role: 'noun:speed', z: 4 });
}
