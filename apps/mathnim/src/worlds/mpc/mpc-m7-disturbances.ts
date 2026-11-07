// M7 When the model is wrong: an unknown steady push (teal). Above, a controller that does not know about it stops
// short of the goal: an offset no tuning removes. Below, one that estimates the push (d̂, its ring filled) reaches
// the goal: integral action. Turning into the world, the estimate fills in.
import { PIG, box, dim2, label, render, ring_dot, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow, frame } from './_mpc';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), dz = 1.75, goal = 9.0;
    const S = [];
    for (const z of [0, dz]) S.push(box(2.4, 0, z - 0.45, 10, 0.08, z + 0.45, { shade: 0.6, bias: -1 }));
    S.push(box(goal - 0.82 - 0.95, 0.08, -0.28, goal - 0.95, 0.44, 0.28, { pig: 'cobalt', k: 1, tint: 0.55 }));
    S.push(box(goal - 0.82, 0.08, dz - 0.28, goal, 0.44, dz + 0.28, { pig: 'cobalt', k: 1, tint: 0.55 }));
    S.push(box(goal - 0.82, 0.08, -0.28, goal, 0.44, 0.28, { kind: 'wire', pig: 'cobalt', solid: 0, alpha: 0.6 }));
    frame(cam, S, w, h, [14, 18, 14, 18]);
    render(ctx, cam, S, () => {
      for (const z of [0, dz]) { const a = cam.p([goal, 0.081, z - 0.45]), b = cam.p([goal, 0.081, z + 0.45]); ctx.save(); ctx.strokeStyle = 'rgba(26,138,107,.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore(); }
    });
    for (const [z, x] of [[0, goal - 0.95], [dz, goal]] as const) arrow(ctx, cam.p([x - 2.45, 0.26, z]), cam.p([x - 0.95, 0.26, z]), PIG.teal, 1.6, 0.95);
    dim2(ctx, cam.p([goal - 0.95, 0.09, -0.45]), cam.p([goal, 0.09, -0.45]), say(st, 'offset', '偏差'), -12, 0.8);
    const e = cam.p([goal - 3.85, 0.26, dz]); ring_dot(ctx, e[0], e[1], 5, PIG.teal, 0.45 + 0.55 * u, 1.5);
    label(ctx, say(st, 'push estimated: d̂', '估计出推力 d̂'), e[0] - 9, e[1] + 4, PIG.teal, 11, 600, 'right');
  },
};
export default world;
