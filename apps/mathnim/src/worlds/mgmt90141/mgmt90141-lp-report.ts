// What the answer report tells you besides the plan: loosen a binding limit by one unit (its line moves out, dashes)
// and the plate grows by a sliver (teal); the best corner moves (hollow ring to solid) and the profit rises by the
// limit's shadow price. Seen from above at rest; as the camera turns, the plate and its sliver rise.
import { PIG, extrude, render, ring_dot, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card_ink, frame, panel, type QP } from '../_kit';
import { BEST, CORNERS, edge_line } from './_mgmt';

const NEW: QP = [0.748, 0.532], SLIVER: QP[] = [[0.42, 0.74], [0.568, 0.712], NEW, BEST];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel(), hp = 0.02 + 0.22 * u;
    const plate = extrude(CORNERS.map(([q, p]) => P.at(q, p, 0.05)), [0, hp, 0], { pig: 'viridian', k: 1, tint: 0.3, shade: 0.6 });
    const sliver = extrude(SLIVER.map(([q, p]) => P.at(q, p, 0.05)), [0, hp, 0], { pig: 'teal', k: 1, tint: 0.5, shade: 0.6 });
    const over = card_ink(P, cam, u, (c, k) => {
      P.axes(c, cam, k, ['x₁', 'x₂']);
      for (let i = 1; i < CORNERS.length - 1; i++) edge_line(c, cam, P, CORNERS[i], CORNERS[i + 1], 0.4 * k);
      edge_line(c, cam, P, [0.52, 0.76], [0.88, 0.4], 0);
      P.line(c, cam, [[0.3, 0.98], [0.98, 0.3]], PIG.ink, 1.2, 0.8 * k, true);
    });
    frame(cam, [P.card, plate, sliver], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card, plate, sliver]);
    over(ctx);
    const y = 0.05 + hp + 0.002;
    const a = cam.p(P.at(BEST[0], BEST[1], y)); ring_dot(ctx, a[0], a[1], 4.5, PIG.viridian, 0, 1.4);
    const b = cam.p(P.at(NEW[0], NEW[1], y)); ring_dot(ctx, b[0], b[1], 5, PIG.viridian, 1, 1.5);
    arrow3(ctx, cam, P.at(BEST[0] + 0.05, BEST[1] + 0.03, y), P.at(NEW[0] + 0.04, NEW[1] - 0.06, y), PIG.ink, 1.1, 0.75);
    P.say(ctx, cam, say(st, 'shadow price', '影子价格'), 0.87, 0.5, PIG.ink, 10.5, 'left');
  },
};
export default world;
