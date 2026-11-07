// Slopes and rates of change: on y = x², secant lines from a point P to points ever closer to it (grey, darker as they
// close in) turn into the tangent at P (cobalt), whose slope is the derivative, 2x. Seen from above at rest, the plot.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { card, curve, frame, ink, on, words } from '../_kit';

const C: [number, number, number, number] = [0, 0, 6, 3.6];
const X0 = -0.6, X1 = 2.2, YMAX = 4.4;
const U = (x: number) => 0.06 + ((x - X0) / (X1 - X0)) * 0.9, V = (y: number) => 0.06 + (y / YMAX) * 0.88;
const pt = (x: number, y: number) => on(C, U(x), V(y));
// a line through (x, y) with slope m, cut to the plot
function line(x: number, y: number, m: number): [number, number, number][] {
  const xs: number[] = [];
  for (const yy of [0, YMAX]) xs.push(x + (yy - y) / m);
  const a = Math.max(X0, Math.min(...xs)), b = Math.min(X1, Math.max(...xs));
  return [pt(a, y + m * (a - x)), pt(b, y + m * (b - x))];
}
const PX = 0.7, QS = [2.0, 1.55, 1.15];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), S = [card(...C)];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, [on(C, 0.06, 0.95), on(C, 0.06, 0.06), on(C, 0.97, 0.06)], PIG.ink, 0.9, 0.7);
    QS.forEach((q, i) => ink(ctx, cam, line(PX, PX * PX, q + PX), PIG.graphite_t, 1.1, 0.35 + 0.2 * i));
    ink(ctx, cam, line(PX, PX * PX, 2 * PX), PIG.cobalt, 1.9, 0.95);
    ink(ctx, cam, curve(C, (u) => V(((u - 0.06) / 0.9 * (X1 - X0) + X0) ** 2), U(X0), U(X1), 72).filter((p) => p[2] >= C[1] + 0.05 * (C[3] - C[1])), PIG.ink, 1.8, 0.9);
    QS.forEach((q, i) => { const p = cam.p(pt(q, q * q)); ring_dot(ctx, p[0], p[1], 3.5, PIG.graphite_t, 0, 1.1 + 0.1 * i); });
    const p = cam.p(pt(PX, PX * PX)); ring_dot(ctx, p[0], p[1], 4.5, PIG.cobalt, 1, 1.4);
    words(ctx, cam, say(st, 'tangent', '切线'), pt(2.1, 2 * PX * (2.1 - PX) + PX * PX + 0.25), PIG.cobalt, 11, 'right');
    words(ctx, cam, say(st, 'secants', '割线'), pt(1.62, 4.15), PIG.graphite_t, 11, 'right', 0.9, 500);
    words(ctx, cam, 'P', pt(PX + 0.1, PX * PX - 0.42), PIG.cobalt, 11.5, 'left');
  },
};
export default world;
