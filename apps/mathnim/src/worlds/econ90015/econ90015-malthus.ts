// Q6, the Malthusian trap: across, income per person; the birth rate rises with it (cobalt), the death rate falls
// (ochre). Where they cross, population holds still (ring, y*). Richer than that, births outrun deaths, more people
// share the land and income falls back; poorer, the reverse (arrows): every gain ends at y*.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame } from '../_kit';
import { along, panel } from './_econ';

const B = (y: number) => 0.18 + 0.55 * y, Dd = (y: number) => 0.85 - 0.75 * y + 0.18 * y * y;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), P = panel();
    frame(cam, [P.card], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card]);
    P.axes(ctx, cam, 1, [say(st, 'income', '人均收入'), '']);
    P.line(ctx, cam, along(B, 0.02, 1), PIG.cobalt, 1.8, 0.95);
    P.line(ctx, cam, along(Dd, 0.02, 1), PIG.ochre, 1.8, 0.95);
    let a = 0, b = 1;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (B(m) < Dd(m)) a = m; else b = m; }
    const ys = (a + b) / 2;
    P.line(ctx, cam, [[ys, B(ys)], [ys, 0]], PIG.graphite_t, 0.8, 0.6, true);
    const e = cam.p(P.at(ys, B(ys))); ring_dot(ctx, e[0], e[1], 5, PIG.ink, 1, 1.4);
    arrow3(ctx, cam, P.at(0.08, 0.06), P.at(ys - 0.07, 0.06), PIG.ink, 1.3, 0.8);
    arrow3(ctx, cam, P.at(0.95, 0.06), P.at(ys + 0.07, 0.06), PIG.ink, 1.3, 0.8);
    P.say(ctx, cam, 'y*', ys, -0.11, PIG.ink, 11.5);
    P.say(ctx, cam, say(st, 'births', '出生率'), 0.98, B(0.98) + 0.05, PIG.cobalt, 10.5, 'right');
    P.say(ctx, cam, say(st, 'deaths', '死亡率'), 0.03, Dd(0.03) + 0.05, PIG.ochre, 10.5, 'left');
  },
};
export default world;
