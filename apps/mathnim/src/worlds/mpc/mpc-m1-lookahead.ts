// M1 Look ahead, then act: the MPC loop drawn as time. Each row is one moment: the cart (solid) and the plan it makes
// (dashes, N steps, slowing for the wall). The next row starts where the first step of this plan ends: the cart
// applies the first step only, then plans again. From above the rows make the staircase of the receding horizon;
// turning into the world they rise, moments stacked in time.
import { PIG, box, label, render, seg, stroke_prov, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow, frame } from './_mpc';

const AT = [1.6, 3.2, 4.55, 5.65, 6.5];          // where the cart is at each moment (the first step of each plan)
const AHEAD = [1.6, 1.35, 1.1, 0.85];            // the plan's steps, slowing toward the wall
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), rows = 4, dz = 1.45, lift = 0.62 * u;
    const S = [];
    for (let k = 0; k < rows; k++) {
      const z = k * dz, y = k * lift;
      S.push(box(0.4, y, z - 0.42, 10, y + 0.07, z + 0.42, { shade: 0.6, bias: -1 }));
      S.push(box(AT[k] - 0.82, y + 0.07, z - 0.28, AT[k], y + 0.42, z + 0.28, { pig: 'cobalt', k: 1, tint: 0.55 }));
      let q = AT[k];
      AHEAD.forEach((d, i) => { q += d * (1 - 0.08 * k); if (q < 9.9) S.push(box(q - 0.82, y + 0.07, z - 0.28, q, y + 0.42, z + 0.28, { kind: 'wire', pig: 'cobalt', solid: 0, alpha: 0.85 - i * 0.15 })); });
    }
    S.push(box(10, 0, -0.6, 10.16, 0.9 + (rows - 1) * lift, (rows - 1) * dz + 0.6, { pig: 'ochre', k: 1, tint: 0.3, bias: -0.5 }));
    frame(cam, S, w, h, [40, 14, 14, 14]);
    render(ctx, cam, S);
    // the first step of each plan is where the next moment starts
    for (let k = 0; k < rows - 1; k++) {
      const a = cam.p([AT[k + 1] - 0.41, k * lift + 0.43, k * dz + 0.3]), b = cam.p([AT[k + 1] - 0.41, (k + 1) * lift + 0.43, (k + 1) * dz - 0.3]);
      stroke_prov(ctx, seg(ctx, a[0], a[1], b[0], b[1]), PIG.cobalt, 1, 1.2, 0.8);
    }
    // time runs down the rows (in the plan); up the stack (in the world)
    const t0 = cam.p([0.0, 0, -0.1]), t1 = cam.p([0.0, (rows - 1) * lift, (rows - 1) * dz + 0.1]);
    arrow(ctx, t0, t1, PIG.graphite_t, 1, 0.8);
    label(ctx, say(st, 'time', '时间'), t0[0] - 5, t0[1] + (t1[1] > t0[1] ? -6 : 14), PIG.graphite_t, 11, 500, 'right');
  },
};
export default world;
