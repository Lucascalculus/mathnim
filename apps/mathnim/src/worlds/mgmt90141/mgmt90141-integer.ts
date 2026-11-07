// Why you cannot just round, and what a yes/no variable is: the allowed plans (the plate) and the whole-number plans
// on it (pegs). The best plan of the plate is a fractional corner (hollow ring); rounding it lands outside the plate
// (ochre cross); the best whole-number plan is elsewhere (solid ring). In the world, the pegs stand up.
import { PIG, cylinder_y, extrude, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card_ink, frame, ink, panel, type QP } from '../_kit';

const SX = 5.2, SY = 4.2, C: QP[] = [[0, 0], [0, 3.5], [2.0, 3.5], [3.7, 2.45], [4.5, 0]];
const inside = (x: number, y: number) => y <= 3.5 + 1e-9 && y <= 3.5 - 0.6176 * (x - 2) + 1e-9 && y <= 2.45 - 3.0625 * (x - 3.7) + 1e-9;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel(), hp = 0.02 + 0.08 * u, S: Solid[] = [P.card];
    S.push(extrude(C.map(([x, y]) => P.at(x / SX, y / SY, 0.05)), [0, hp, 0], { pig: 'viridian', k: 1, tint: 0.25, shade: 0.6 }));
    for (let x = 0; x <= 5; x++) for (let y = 0; y <= 4; y++) if (inside(x, y)) { const q = P.at(x / SX, y / SY); S.push(cylinder_y(q[0], q[2], 0.07, 0.05 + hp, 0.05 + hp + 0.03 + 0.3 * u, 10, { pig: 'ink', k: 1, tint: 0.3, shadow: false })); }
    const over = card_ink(P, cam, u, (c, k) => {
      P.axes(c, cam, k, ['x₁', 'x₂']);
      for (let x = 0; x <= 5; x++) for (let y = 0; y <= 4; y++) if (!inside(x, y)) { const q = cam.p(P.at(x / SX, y / SY)); c.save(); c.fillStyle = `rgba(26,27,31,${0.25 * k})`; c.beginPath(); c.arc(q[0], q[1], 1.6, 0, 7); c.fill(); c.restore(); }
    });
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    over(ctx);
    const y = 0.05 + hp + 0.002;
    const lp = cam.p(P.at(3.7 / SX, 2.45 / SY, y)); ring_dot(ctx, lp[0], lp[1], 5, PIG.viridian, 0, 1.4);
    const io = cam.p(P.at(4 / SX, 1 / SY, y + 0.03 + 0.3 * u)); ring_dot(ctx, io[0], io[1], 5.5, PIG.viridian, 1, 1.5);
    const r = P.at(4 / SX, 2 / SY, 0.052), d = 0.09;
    ink(ctx, cam, [[r[0] - d, r[1], r[2] - d], [r[0] + d, r[1], r[2] + d]], PIG.ochre, 1.8, 0.95);
    ink(ctx, cam, [[r[0] - d, r[1], r[2] + d], [r[0] + d, r[1], r[2] - d]], PIG.ochre, 1.8, 0.95);
    P.say(ctx, cam, say(st, 'rounded', '四舍五入'), 4.12 / SX, 2.2 / SY, PIG.ochre, 10.5, 'left');
  },
};
export default world;
