// Q5, perfect competition in the long run: one firm (left) and its market (right), on the same price scale. Demand
// grows (D to D′): the price jumps (hollow ring), firms earn profits, new firms enter (S to S′, cobalt) until the price
// is back at the bottom of the firm's average cost (solid ring): in the long run, price = min ATC, zero profit.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame } from '../_kit';
import { along, panel } from './_econ';

const ATC = (q: number) => 0.25 + 1.3 * (q - 0.5) ** 2, MC = (q: number) => ATC(q) + 2.6 * q * (q - 0.5);
const D = (q: number) => 0.7 - 0.9 * q, D2 = (q: number) => 0.95 - 0.9 * q, Sp = (q: number) => 0.25 + 0.7 * (q - 0.5), S2 = (q: number) => 0.25 + 0.7 * (q - 0.778);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), F = panel(0, 0, 4.2, 4.1), M = panel(4.6, 0, 5.4, 4.1);
    void u;
    frame(cam, [F.card, M.card], w, h, [12, 12, 12, 24], [M.at(0.5, -0.32), F.at(0.5, -0.32)]);
    render(ctx, cam, [F.card, M.card]);
    F.axes(ctx, cam, 1, ['q', 'P']); M.axes(ctx, cam, 1);
    F.line(ctx, cam, along(ATC, 0.12, 0.92), PIG.ink, 1.5, 0.9);
    F.line(ctx, cam, along(MC, 0.3, 0.74), PIG.graphite_t, 1.5, 0.9);
    F.line(ctx, cam, [[0, 0.25], [1, 0.25]], PIG.viridian, 1.1, 0.85, true);
    M.line(ctx, cam, along(D, 0.05, 0.75, 4), PIG.graphite_t, 1.3, 0.7);
    M.line(ctx, cam, along(D2, 0.05, 1, 4), PIG.ink, 1.6, 0.9);
    M.line(ctx, cam, along(Sp, 0.1, 0.95, 4), PIG.graphite_t, 1.3, 0.7);
    M.line(ctx, cam, along(S2, 0.4, 1.02, 4), PIG.cobalt, 1.8, 0.95);
    M.line(ctx, cam, [[0, 0.25], [1.02, 0.25]], PIG.viridian, 1.1, 0.85, true);
    const m = cam.p(F.at(0.5, 0.25)); ring_dot(ctx, m[0], m[1], 4, PIG.viridian, 1, 1.3);
    const sr = cam.p(M.at(0.656, 0.36)); ring_dot(ctx, sr[0], sr[1], 4, PIG.ink, 0, 1.3);
    const lr = cam.p(M.at(0.778, 0.25)); ring_dot(ctx, lr[0], lr[1], 4.5, PIG.viridian, 1, 1.4);
    F.say(ctx, cam, 'ATC', 0.9, 0.42, PIG.ink, 10.5, 'left');
    F.say(ctx, cam, 'MC', 0.74, 0.86, PIG.graphite_t, 10.5, 'left');
    M.say(ctx, cam, 'D′', 0.96, 0.12, PIG.ink, 10.5, 'left');
    M.say(ctx, cam, 'S′', 1.0, 0.43, PIG.cobalt, 10.5, 'left');
    F.say(ctx, cam, say(st, 'a firm', '一家厂商'), 0.5, -0.3, PIG.graphite_t, 10.5, 'center', 500);
    M.say(ctx, cam, say(st, 'the market', '整个市场'), 0.5, -0.3, PIG.graphite_t, 10.5, 'center', 500);
  },
};
export default world;
