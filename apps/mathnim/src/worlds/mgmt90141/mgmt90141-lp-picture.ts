// What a plan is, and why the best one is at a corner: the plans allowed by the limits (the plate, each edge one
// limit, its line in grey). Lines of equal profit (dashes) slide outward as profit grows (arrow); the last plan they
// touch before leaving the plate is a corner (ring). Seen from above at rest; as the camera turns, the plate rises.
import { PIG, extrude, render, ring_dot, turned } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card_ink, frame, panel, type QP } from '../_kit';
import { BEST, CORNERS, edge_line } from './_mgmt';

const iso = (c: number): QP[] => [[Math.max(0, (c - 1) / 2), Math.min(1, c)], [Math.min(1.02, c / 2), Math.max(0, c - 2 * Math.min(1.02, c / 2))]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel(), hp = 0.02 + 0.22 * u;
    const plate = extrude(CORNERS.map(([q, p]) => P.at(q, p, 0.05)), [0, hp, 0], { pig: 'viridian', k: 1, tint: 0.3, shade: 0.6 });
    const over = card_ink(P, cam, u, (c, k) => {
      P.axes(c, cam, k, ['x₁', 'x₂']);
      for (let i = 1; i < CORNERS.length - 1; i++) edge_line(c, cam, P, CORNERS[i], CORNERS[i + 1], 0.45 * k);
    });
    frame(cam, [P.card, plate], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card, plate]);
    over(ctx);
    const y = 0.05 + hp + 0.002, c0 = 2 * BEST[0] + BEST[1];
    for (const c of [0.5, 0.95, 1.4]) P.line(ctx, cam, iso(c).map(([q, p]) => [q, p]), PIG.ink, 1, 0.45, true);
    P.line(ctx, cam, iso(c0), PIG.ink, 1.5, 0.9);
    arrow3(ctx, cam, P.at(0.2, 0.2, y), P.at(0.38, 0.29, y), PIG.ink, 1.2, 0.7);
    const b = cam.p(P.at(BEST[0], BEST[1], y)); ring_dot(ctx, b[0], b[1], 5.5, PIG.viridian, 1, 1.5);
  },
};
export default world;
