// Predicted Q1, a tax and a price cap, two cards. The tax (left) drives a wedge between what buyers pay and sellers
// keep (S to S + t, dashes): the government's revenue (cobalt) and the deadweight loss (ochre). The cap (right) holds
// the price below equilibrium: buyers want more than sellers offer, the shortage (bracket). The amounts rise in 3D.
import { PIG, render, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink } from '../_kit';
import { card_ink, panel } from './_econ';

const D = (q: number) => 0.92 - 0.9 * q, Sp = (q: number) => 0.08 + 0.8 * q, T = 0.25;
const QT = (0.92 - 0.08 - T) / 1.7, QE = 0.84 / 1.7, CAP = 0.32;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), A = panel(0, 0, 4.8, 4.1), B = panel(5.2, 0, 4.8, 4.1);
    const S = [A.card, B.card, A.plate([[0, Sp(QT)], [QT, Sp(QT)], [QT, D(QT)], [0, D(QT)]], 'cobalt', u), A.plate([[QT, D(QT)], [QT, Sp(QT)], [QE, D(QE)]], 'ochre', u, 0.32, 0.45)];
    const over = card_ink(A, cam, u, (c, k) => {
      A.axes(c, cam, k);
      A.line(c, cam, [[0, 0.92], [1, D(1)]], PIG.ink, 1.5, k);
      A.line(c, cam, [[0, 0.08], [1, Sp(1)]], PIG.ink, 1.5, k);
      A.line(c, cam, [[0, 0.08 + T], [0.84, Sp(0.84) + T]], PIG.graphite_t, 1.1, 0.85 * k, true);
    });
    frame(cam, S, w, h, [12, 12, 12, 24], [A.at(0.5, -0.3), B.at(0.5, -0.3)]);
    render(ctx, cam, S);
    over(ctx);
    B.axes(ctx, cam, 1);
    B.line(ctx, cam, [[0, 0.92], [1, D(1)]], PIG.ink, 1.5, 1);
    B.line(ctx, cam, [[0, 0.08], [1, Sp(1)]], PIG.ink, 1.5, 1);
    B.line(ctx, cam, [[0, CAP], [1.02, CAP]], PIG.cobalt, 1.6, 0.95);
    const qs = (CAP - 0.08) / 0.8, qd = (0.92 - CAP) / 0.9;
    ink(ctx, cam, [B.at(qs, CAP - 0.05), B.at(qs, CAP - 0.09), B.at(qd, CAP - 0.09), B.at(qd, CAP - 0.05)], PIG.ochre, 1.4, 0.95);
    A.say(ctx, cam, say(st, 'a tax', '征税'), 0.5, -0.28, PIG.graphite_t, 10.5, 'center', 500);
    B.say(ctx, cam, say(st, 'a price cap', '限价'), 0.5, -0.28, PIG.graphite_t, 10.5, 'center', 500);
    B.say(ctx, cam, say(st, 'shortage', '短缺'), (qs + qd) / 2, CAP - 0.2, PIG.ochre, 10.5);
  },
};
export default world;
