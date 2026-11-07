// Inscribed angles: every point on an arc sees a chord at the same angle. A chord AB (ink) on a disc; three points on
// the far arc (teal pins), each seeing it at the same angle θ; at the centre it is seen at 2θ (cobalt), the reason why.
// Seen from above at rest; in the world, the three points stand up as observers.
import { PIG, render, turned, cylinder_y, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';
import { angle, at, disc, in_angle, on_circle, type P2 } from './_math';

const R = 2, O: P2 = [0, 0], A = on_circle(O, R, (52 * Math.PI) / 180), B = on_circle(O, R, (128 * Math.PI) / 180);
const PS = [205, 262, 322].map((d) => on_circle(O, R, (d * Math.PI) / 180));
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top);
    const marks = (c: CanvasRenderingContext2D) => {
      for (const p of PS) { ink(c, cam, [at(A), at(p), at(B)], PIG.graphite_t, 1.1, 0.75); angle(c, cam, p, A, B, 0.42, PIG.teal); }
      ink(c, cam, [at(A), at(O), at(B)], PIG.cobalt, 1.3, 0.85);
      angle(c, cam, O, A, B, 0.38, PIG.cobalt, 0.28);
      ink(c, cam, [at(A), at(B)], PIG.ink, 2, 0.9);
    };
    const S: Solid[] = [disc(O, R, 0.05, { bias: -10 }, marks)];
    for (const p of PS) S.push(cylinder_y(p[0], p[1], 0.09, 0.05, 0.08 + 0.55 * u, 14, { pig: 'teal', k: 1, tint: 0.6 }));
    for (const p of [A, B]) S.push(cylinder_y(p[0], p[1], 0.07, 0.05, 0.07 + 0.12 * u, 12, { pig: 'ink', k: 1, tint: 0.5 }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    for (const p of PS) words(ctx, cam, 'θ', at(in_angle(p, A, B, 0.72), 0.052), PIG.teal, 12.5, 'center', 0.95, 650);
    words(ctx, cam, '2θ', at(in_angle(O, A, B, 0.7), 0.052), PIG.cobalt, 12.5, 'center', 0.95, 650);
  },
};
export default world;
