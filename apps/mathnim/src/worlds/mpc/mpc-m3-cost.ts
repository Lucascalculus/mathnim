// M3 The cost: weights are prices. A balance: on one pan the price of missing the goal (Q, cobalt coins), on the other
// the price of effort (R, ochre); the beam leans toward what costs more. Seen at rest straight from the front, an
// elevation: how high each is stacked; turning into the world, the coins' size too.
import { PIG, cylinder_y, extrude, label, render, turned, type V3 } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame } from './_mpc';

const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), lean = 0.085, top = (x: number) => 1.02 - lean * x;
    const beam = extrude([[-3, top(-3) - 0.1, -0.5], [3, top(3) - 0.1, -0.5], [3, top(3), -0.5], [-3, top(-3), -0.5]], [0, 0, 1.0]);
    const post = extrude([[-0.55, 0, -0.35], [0.55, 0, -0.35], [0, top(0) - 0.1, -0.35]], [0, 0, 0.7]);
    const S = [post, beam];
    const stack = (x: number, r: number, n: number, pig: string) => { for (let i = 0; i < n; i++) S.push(cylinder_y(x, 0, r, top(x) + i * 0.13, top(x) + i * 0.13 + 0.11, 24, { pig, k: 1, tint: 0.5 + 0.03 * i, shade: 0.7, bias: 0.6 + 0.01 * i })); };
    stack(-2.1, 0.62, 7, 'cobalt');
    stack(2.1, 0.42, 3, 'ochre');
    frame(cam, S, w, h, [16, 30, 16, 12], [[-2.1, top(-2.1) + 7 * 0.13 + 0.5, 0], [2.1, top(2.1) + 3 * 0.13 + 0.5, 0]]);
    render(ctx, cam, S);
    const lb = (t: string, q: V3, pig: number[]) => { const p = cam.p(q); label(ctx, t, p[0], p[1], pig as [number, number, number], 12, 650, 'center'); };
    lb(say(st, 'Q · missing the goal', 'Q · 离目标多远'), [-2.1, top(-2.1) + 7 * 0.13 + 0.3, 0], PIG.cobalt);
    lb(say(st, 'R · effort', 'R · 用多大力'), [2.1, top(2.1) + 3 * 0.13 + 0.3, 0], PIG.ochre);
  },
};
export default world;
