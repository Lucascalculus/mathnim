// Predicted Q4, an entry fee plus a price per unit (a two-part tariff): sell each unit at marginal cost (the line) and
// charge the whole consumer surplus as the fee to get in (cobalt): the seller takes everything the buyer would gain.
// Seen from above at rest; as the camera turns, the fee rises as an amount.
import { PIG, render, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame } from '../_kit';
import { card_ink, panel } from './_econ';

const D = (q: number) => 0.92 - 0.9 * q, MC = 0.22, QC = (0.92 - MC) / 0.9;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel();
    const S = [P.card, P.plate([[0, D(0)], [QC, MC], [0, MC]], 'cobalt', u, 0.4, 0.42)];
    const over = card_ink(P, cam, u, (c, k) => {
      P.axes(c, cam, k);
      P.line(c, cam, [[0, D(0)], [1.0, D(1.0)]], PIG.ink, 1.6, k);
      P.line(c, cam, [[0, MC], [1.02, MC]], PIG.ink, 1.3, k);
    });
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    over(ctx);
    P.say(ctx, cam, say(st, 'entry fee', '入场费'), QC * 0.3, MC + 0.2, PIG.cobalt, 11);
    P.say(ctx, cam, say(st, 'price = MC', '单价 = MC'), 0.98, MC - 0.1, PIG.ink, 10.5, 'right');
    P.say(ctx, cam, 'D', 1.02, D(1.0) + 0.03, PIG.ink, 11, 'left');
  },
};
export default world;
