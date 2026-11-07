// Predicted Q2, pollution: across, how much is emitted. Each extra tonne does more damage (MD, ochre); cutting one
// more tonne costs firms more the less they emit (MAC, cobalt). The best amount is where they cross (ring), and a tax
// at that height (dashes, across) or a cap at that amount (dashes, down) or permits for it all reach the same point.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame } from '../_kit';
import { panel } from './_econ';

const MAC = (e: number) => 0.92 - 0.85 * e, MD = (e: number) => 0.05 + 0.75 * e, ES = 0.87 / 1.6;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), P = panel();
    frame(cam, [P.card], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card]);
    P.axes(ctx, cam, 1, [say(st, 'emissions', '排放'), '']);
    P.line(ctx, cam, [[0, MAC(0)], [1.0, MAC(1.0)]], PIG.cobalt, 1.8, 0.95);
    P.line(ctx, cam, [[0, MD(0)], [1.0, MD(1.0)]], PIG.ochre, 1.8, 0.95);
    P.line(ctx, cam, [[0, MD(ES)], [ES, MD(ES)]], PIG.ink, 1.1, 0.8, true);
    P.line(ctx, cam, [[ES, MD(ES)], [ES, 0]], PIG.ink, 1.1, 0.8, true);
    const e = cam.p(P.at(ES, MD(ES))); ring_dot(ctx, e[0], e[1], 5, PIG.ink, 1, 1.4);
    P.say(ctx, cam, 'MAC', 0.04, MAC(0) + 0.04, PIG.cobalt, 10.5, 'left');
    P.say(ctx, cam, 'MD', 1.02, MD(1.0) - 0.02, PIG.ochre, 10.5, 'left');
    P.say(ctx, cam, say(st, 'tax', '税'), 0.03, MD(ES) + 0.04, PIG.ink, 10.5, 'left');
    P.say(ctx, cam, say(st, 'cap', '配额'), ES + 0.03, 0.04, PIG.ink, 10.5, 'left');
  },
};
export default world;
