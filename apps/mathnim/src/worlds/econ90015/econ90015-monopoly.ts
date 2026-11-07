// Q2, a monopoly, then a tax on each sale: demand D, marginal revenue MR (twice as steep), constant marginal cost MC.
// The monopolist sells where MR = MC and charges what demand will bear (ring): its profit (cobalt) and the deadweight
// loss against competition (ochre). The tax lifts MC to MC + t (dashes) and the price with it (hollow ring), by less
// than the tax. Seen from above at rest; as the camera turns, the amounts rise.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame } from '../_kit';
import { card_ink, panel } from './_econ';

const D = (q: number) => 0.9 - 0.8 * q, MC = 0.2, T = 0.15, QM = 0.4375, PM = D(QM), QT = (0.9 - MC - T) / 1.6;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel();
    const S = [P.card, P.plate([[0, MC], [QM, MC], [QM, PM], [0, PM]], 'cobalt', u), P.plate([[QM, PM], [QM, MC], [0.875, MC]], 'ochre', u, 0.32, 0.45)];
    const over = card_ink(P, cam, u, (c, k) => {
      P.axes(c, cam, k);
      P.line(c, cam, [[0, 0.9], [1.0, D(1.0)]], PIG.ink, 1.6, k);
      P.line(c, cam, [[0, 0.9], [0.5625, 0]], PIG.graphite_t, 1.3, 0.9 * k);
      P.line(c, cam, [[0, MC], [1.02, MC]], PIG.ink, 1.3, k);
      P.line(c, cam, [[0, MC + T], [1.02, MC + T]], PIG.graphite_t, 1.1, 0.85 * k, true);
      P.line(c, cam, [[QM, 0], [QM, PM]], PIG.graphite_t, 0.8, 0.5 * k, true);
    });
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    over(ctx);
    const m = cam.p(P.at(QM, PM)); ring_dot(ctx, m[0], m[1], 4.5, PIG.cobalt, 1, 1.4);
    const t = cam.p(P.at(QT, D(QT))); ring_dot(ctx, t[0], t[1], 4, PIG.ink, 0, 1.3);
    P.say(ctx, cam, 'D', 0.13, D(0.13) + 0.03, PIG.ink, 11, 'left');
    P.say(ctx, cam, 'MR', 0.58, 0.04, PIG.graphite_t, 10.5, 'left');
    P.say(ctx, cam, 'MC', 1.04, MC - 0.02, PIG.ink, 10.5, 'left');
    P.say(ctx, cam, 'MC + t', 1.04, MC + T - 0.02, PIG.graphite_t, 10.5, 'left', 500);
  },
};
export default world;
