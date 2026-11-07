// Predicted Q7, Malthus with numbers, and leaving the trap: income per person over centuries. For most of history it
// wavers round subsistence (the trap); then technology outruns population and income takes off (cobalt). As the camera
// turns, the area under it rises: the living standard as a landscape.
import { PIG, render, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame } from '../_kit';
import { along, card_ink, panel } from './_econ';

const Y = (t: number) => 0.16 + 0.025 * Math.sin(t * 34) + (t > 0.68 ? 2.4 * (t - 0.68) ** 1.55 : 0);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel(), pts = along(Y, 0, 1, 80);
    const S = [P.card, P.plate([[0, 0], ...pts, [1, 0]], 'cobalt', u, 0.22, 0.2)];
    const over = card_ink(P, cam, u, (c, k) => {
      P.axes(c, cam, k, [say(st, 'time', '时间'), '']);
      P.line(c, cam, pts, PIG.cobalt, 2, k);
    });
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    over(ctx);
    P.say(ctx, cam, say(st, 'the trap', '陷阱'), 0.32, 0.3, PIG.graphite_t, 10.5, 'center', 500);
    P.say(ctx, cam, say(st, 'escape', '走出'), 0.86, 0.62, PIG.cobalt, 10.5, 'right');
  },
};
export default world;
