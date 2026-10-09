// Figures for "The pizza deal": pizzas, the slice-and-rearrange construction,
// radius-squares. Placement is shared by every scene (left half: figure,
// right half: words and numbers).
import { Arc, Circle, Dot, Line, MathTex, Polygon, Sector, Square, Text, VGroup, add } from 'manim-web';
import { C } from '../best-angle/theme';

export const P = {
  cheese: '#F2C063',
  cheese2: '#EAA945',
  crust: '#C98A2E',
  /** crust colour dark enough for text on white (contrast >= 4.5) */
  crustText: '#8A5A12',
  pepperoni: '#D9573B',
  box: '#FFFFFF',
};
/** Figure centre (left half) and text column (right half). */
export const FIG: [number, number, number] = [-3.3, -0.2, 0];
export const COL_X = 3.4;

export const say = (s: string, size = 28, color = C.ink) => Text(s, { font_size: size, color, font: 'sans-serif' });
export const T = (s: string, size = 36, color = C.ink) => MathTex(s, { font_size: size, color });
/** Shrink to at most w wide. */
export function fit<M extends { width: number; scale_to_fit_width(w: number): unknown }>(m: M, w = 6): M {
  if (m.width > w) m.scale_to_fit_width(w);
  return m;
}

/** A pizza: cheese, crust, pepperoni at fixed spots (golden-angle spiral). */
export function pizza(r: number, center: number[] = [0, 0, 0], o: { slices?: number; toppings?: boolean } = {}) {
  const g = VGroup(Circle({ radius: r, stroke_color: P.crust, stroke_width: Math.max(4, 7 * r), fill_color: P.cheese, fill_opacity: 1 }));
  if (o.toppings !== false) {
    const n = Math.max(5, Math.round(9 * r * r));
    for (let i = 0; i < n; i++) {
      const rr = 0.72 * r * Math.sqrt((i + 0.5) / n), a = i * 2.39996;
      g.add(Dot([rr * Math.cos(a), rr * Math.sin(a), 0], { radius: 0.11 * Math.min(1, r) + 0.03, color: P.pepperoni }));
    }
  }
  if (o.slices) for (let i = 0; i < o.slices; i++) {
    const a = (i * 2 * Math.PI) / o.slices;
    g.add(Line([0, 0, 0], [r * Math.cos(a), r * Math.sin(a), 0], { color: '#FFFFFF', stroke_width: 2.5 }));
  }
  return g.move_to(center);
}

/**
 * n slices of a circle of radius r, moved a fraction u (0..1) from the circle
 * (centred at `from`) to the rearranged near-rectangle (centred at `to`).
 * Even slices end with their crust down, odd slices crust up, so the bottom
 * edge is one half of the crust and the top edge the other half.
 */
export function slices(n: number, u: number, r: number, from: number[], to: number[]) {
  n = Math.max(2, 2 * Math.round(n / 2));
  const th = (2 * Math.PI) / n;
  const s = 2 * r * Math.sin(th / 2), h = r * Math.cos(th / 2);
  const width = (n / 2) * s + s / 2;
  const x0 = to[0] - width / 2, y0 = to[1] - h / 2;
  const e = u * u * (3 - 2 * u); // smoothstep
  const g = VGroup();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(i / 2);
    const up = i % 2 === 0; // tip up, crust at the bottom
    const tip1 = up ? [x0 + k * s + s / 2, y0 + h, 0] : [x0 + k * s + s, y0, 0];
    const a0 = (i + 0.5) * th;
    let a1 = up ? -Math.PI / 2 : Math.PI / 2;
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    const a = a0 + (a1 - a0) * e;
    const tip = [from[0] + (tip1[0] - from[0]) * e, from[1] + (tip1[1] - from[1]) * e, 0];
    const fill = i % 2 === 0 ? P.cheese : P.cheese2;
    const sector = Sector({ radius: r, angle: th, start_angle: a - th / 2, fill_color: fill, fill_opacity: 1, stroke_color: '#FFFFFF', stroke_width: n > 24 ? 1 : 2 });
    sector.shift(tip);
    const crust = Arc({ radius: r, start_angle: a - th / 2, angle: th, stroke_color: P.crust, stroke_width: 6 }).shift(tip);
    g.add(sector, crust);
  }
  return g;
}
/** Width of the rearranged shape (tends to πr). */
export const rearranged_width = (n: number, r: number) => {
  n = Math.max(2, 2 * Math.round(n / 2));
  const s = 2 * r * Math.sin(Math.PI / n);
  return (n / 2) * s + s / 2;
};

/** A radius-square: side r, drawn from the circle's centre. */
export function radius_square(r: number, center: number[], color = C.accent) {
  return Square({ side_length: r, color, fill_opacity: 0.16, stroke_width: 3 }).move_to(add(center, [r / 2, r / 2, 0]));
}
/** The square around a circle (4r²) and the diamond inside it (2r²). */
export function bounds(r: number, center: number[]) {
  const outer = Square({ side_length: 2 * r, color: C.coral, stroke_width: 3, fill_opacity: 0.06 }).move_to(center);
  const inner = Polygon(add(center, [r, 0, 0]), add(center, [0, r, 0]), add(center, [-r, 0, 0]), add(center, [0, -r, 0]), { color: C.good, stroke_width: 3, fill_opacity: 0.1 });
  return { outer, inner };
}
/** A 1x1 grid of squares of side `unit` covering [x0, x0+w] x [y0, y0+h]. */
export function grid(unit: number, x0: number, y0: number, w: number, h: number) {
  const g = VGroup();
  for (let x = 0; x <= w + 1e-9; x += unit) g.add(Line([x0 + x, y0, 0], [x0 + x, y0 + h, 0], { color: C.faint, stroke_width: 1.5 }));
  for (let y = 0; y <= h + 1e-9; y += unit) g.add(Line([x0, y0 + y, 0], [x0 + w, y0 + y, 0], { color: C.faint, stroke_width: 1.5 }));
  return g;
}
/** Menu card: a pizza offer with its price. */
export function offer(title: string, pizzas: { r: number; at: number[] }[], price: string, center: number[]) {
  const card = VGroup();
  const box = Polygon([-2.9, -2.4, 0], [2.9, -2.4, 0], [2.9, 2.4, 0], [-2.9, 2.4, 0], { stroke_color: C.faint, stroke_width: 2, fill_color: '#FFFFFF', fill_opacity: 1 });
  card.add(box);
  for (const p of pizzas) card.add(pizza(p.r, p.at));
  card.add(say(title, 30).move_to([0, 1.85, 0]));
  card.add(say(price, 30, C.good).move_to([0, -1.9, 0]));
  return card.shift(center);
}
