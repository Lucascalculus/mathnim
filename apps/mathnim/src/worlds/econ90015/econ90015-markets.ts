// Q1, an import quota on wind turbines: demand Q = 120 − 2p, all supply imported (Q = 10p). A quota of 60 (cobalt, a
// wall across the market) lifts the price to 30 on the demand curve; between the buyers' price and the sellers' cost
// lies the quota rent (violet: the exporters keep it), and the trades the quota forbids are the deadweight loss
// (ochre). Seen from above at rest; as the camera turns, the amounts rise.
import { PIG, box, render, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame } from '../_kit';
import { card_ink, panel } from './_econ';

const q = (Q: number) => Q / 130, p = (P: number) => P / 62, QQ = q(60);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel();
    const wall = P.at(QQ, 0, 0.05), top = P.at(QQ, p(58), 0.05);
    const S = [P.card, P.plate([[0, p(6)], [QQ, p(6)], [QQ, p(30)], [0, p(30)]], 'violet', u), P.plate([[QQ, p(30)], [QQ, p(6)], [q(100), p(10)]], 'ochre', u, 0.32, 0.45),
      P.plate([[0, p(60)], [QQ, p(30)], [0, p(30)]], 'teal', u, 0.32, 0.16),
      box(wall[0] - 0.04, 0.05, top[2], wall[0] + 0.04, 0.05 + 0.02 + 0.5 * u, wall[2], { pig: 'cobalt', k: 1, tint: 0.6, shadow: u > 0.1 })];
    const over = card_ink(P, cam, u, (c, k) => {
      P.axes(c, cam, k);
      P.line(c, cam, [[0, p(60)], [q(120), 0]], PIG.ink, 1.6, k);
      P.line(c, cam, [[0, 0], [1, p(13)]], PIG.ink, 1.6, k);
      P.line(c, cam, [[0, p(30)], [QQ, p(30)]], PIG.ink, 0.9, 0.6 * k, true);
    });
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    over(ctx);
    P.say(ctx, cam, 'D', q(118), p(4.5));
    P.say(ctx, cam, 'S', 1.0, p(16.5));
    P.say(ctx, cam, say(st, 'quota', '配额'), QQ, p(61), PIG.cobalt, 11);
    P.say(ctx, cam, say(st, 'rent', '租金'), QQ / 2, p(16), PIG.violet, 11);
  },
};
export default world;
