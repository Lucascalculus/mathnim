// Q3, pricing by who you are: two kinds of customer, demand Q₁ = 24 − p (cobalt) and Q₂ = 16 − p (teal), and a
// constant cost of 6. If the seller can tell them apart it sets each kind its own price, where its MR meets MC: 15 for
// the keen ones, 11 for the others (rings), each with its own profit (plates). Seen from above at rest.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame } from '../_kit';
import { card_ink, panel } from './_econ';

const s = (x: number) => x / 26, MC = s(6), A: [number, number] = [s(9), s(15)], B: [number, number] = [s(5), s(11)];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel();
    const S = [P.card, P.plate([[0, MC], [A[0], MC], A, [0, A[1]]], 'cobalt', u, 0.22, 0.32), P.plate([[0, MC], [B[0], MC], B, [0, B[1]]], 'teal', u, 0.42, 0.42)];
    S[2].bias = 1;
    const over = card_ink(P, cam, u, (c, k) => {
      P.axes(c, cam, k);
      P.line(c, cam, [[0, s(24)], [s(24), 0]], PIG.cobalt, 1.6, k);
      P.line(c, cam, [[0, s(16)], [s(16), 0]], PIG.teal, 1.6, k);
      P.line(c, cam, [[0, MC], [1.0, MC]], PIG.ink, 1.2, k);
      for (const [x, y] of [A, B]) P.line(c, cam, [[x, y], [x, 0]], PIG.graphite_t, 0.8, 0.5 * k, true);
    });
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    over(ctx);
    for (const [[x, y], pig] of [[A, PIG.cobalt], [B, PIG.teal]] as const) { const p = cam.p(P.at(x, y)); ring_dot(ctx, p[0], p[1], 4.5, pig, 1, 1.4); }
    P.say(ctx, cam, 'p₁', -0.06, A[1] - 0.02, PIG.cobalt, 11, 'right');
    P.say(ctx, cam, 'p₂', -0.06, B[1] - 0.02, PIG.teal, 11, 'right');
    P.say(ctx, cam, 'D₁', s(23), s(2.6), PIG.cobalt, 11, 'left');
    P.say(ctx, cam, 'D₂', s(15.2), s(2.6), PIG.teal, 11, 'left');
    P.say(ctx, cam, 'MC', 1.02, MC - 0.02, PIG.ink, 10.5, 'left');
  },
};
export default world;
