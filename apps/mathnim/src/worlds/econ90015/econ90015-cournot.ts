// Q4, two firms guessing each other: firm 1's best output for each output of firm 2 (BR₁, cobalt) and firm 2's
// (BR₂, ochre). Each answering the other in turn (dashes) walks to where both answers agree: the Cournot equilibrium
// (ring), where neither wants to change. Seen from above at rest, the plane of the two outputs.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { frame } from '../_kit';
import { panel, type QP } from './_econ';

const K = 0.95, BR1 = (q2: number) => 0.5 * (1 - q2), BR2 = (q1: number) => 0.5 * (1 - q1);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), P = panel(0, 0, 5.2, 4.1);
    frame(cam, [P.card], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card]);
    P.axes(ctx, cam, 1, ['q₁', 'q₂']);
    P.line(ctx, cam, [[K * 0.5, 0], [0, K]], PIG.cobalt, 1.8, 0.95);
    P.line(ctx, cam, [[0, K * 0.5], [K, 0]], PIG.ochre, 1.8, 0.95);
    const walk: QP[] = [];
    let a = 0.88, b = 0;
    walk.push([K * a, 0]);
    for (let i = 0; i < 5; i++) { b = BR2(a); walk.push([K * a, K * b]); a = BR1(b); walk.push([K * a, K * b]); }
    P.line(ctx, cam, walk, PIG.graphite_t, 1, 0.75, true);
    const e = cam.p(P.at(K / 3, K / 3)); ring_dot(ctx, e[0], e[1], 5, PIG.ink, 1, 1.4);
    P.say(ctx, cam, 'BR₁', 0.04, K * 0.94, PIG.cobalt, 11, 'left');
    P.say(ctx, cam, 'BR₂', K * 0.94, 0.05, PIG.ochre, 11, 'center');
  },
};
export default world;
