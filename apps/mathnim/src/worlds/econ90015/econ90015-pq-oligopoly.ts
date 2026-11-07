// Predicted Q5, two sellers: who moves first, and why a cartel falls apart. On the plane of the two outputs: firm 2's
// best response (ochre). Moving together (Cournot) they meet where both responses cross (grey ring); a leader who
// moves first picks its best point on firm 2's response (cobalt ring); a cartel shares the monopoly output (dashed
// ring), but each has a reason to produce more (arrow): it breaks down.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame } from '../_kit';
import { panel } from './_econ';

const K = 0.95;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), P = panel(0, 0, 5.2, 4.1);
    frame(cam, [P.card], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card]);
    P.axes(ctx, cam, 1, ['q₁', 'q₂']);
    P.line(ctx, cam, [[0, K * 0.5], [K, 0]], PIG.ochre, 1.8, 0.95);
    P.line(ctx, cam, [[K * 0.5, 0], [0, K]], PIG.graphite_t, 1.2, 0.6, true);
    const dot = (q1: number, q2: number, pig: typeof PIG.ink, fill: number, r = 4.5) => { const p = cam.p(P.at(K * q1, K * q2)); ring_dot(ctx, p[0], p[1], r, pig, fill, 1.4); };
    dot(1 / 3, 1 / 3, PIG.graphite_t, 1, 4);
    dot(0.5, 0.25, PIG.cobalt, 1, 5);
    dot(0.25, 0.25, PIG.ink, 0, 4.5);
    arrow3(ctx, cam, P.at(K * 0.27, K * 0.25), P.at(K * 0.37, K * 0.25), PIG.ink, 1.2, 0.8);
    P.say(ctx, cam, say(st, 'leader', '先动'), K * 0.53, K * 0.31, PIG.cobalt, 10.5, 'left');
    P.say(ctx, cam, say(st, 'cartel', '卡特尔'), K * 0.22, K * 0.17, PIG.ink, 10.5, 'right');
  },
};
export default world;
