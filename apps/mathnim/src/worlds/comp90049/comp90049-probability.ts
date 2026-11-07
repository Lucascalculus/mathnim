// Probability and maximum likelihood from the definition: ten coin flips, seven heads (cobalt) and three tails. The
// likelihood of what we saw, for each possible chance of heads θ (the curve), is highest at θ = 0.7 (ring): the
// maximum-likelihood estimate is the observed share. Seen from above at rest; in the world, the coins stand.
import { PIG, cylinder_y, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { along, frame, panel } from '../_kit';

const FLIPS = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel(0, 0, 6, 3.6), S: Solid[] = [P.card];
    FLIPS.forEach((f, i) => S.push(cylinder_y(0.6 + i * 0.52, -0.7, 0.2, 0, 0.05 + 0.3 * u * (f ? 1 : 0.4), 20, f ? { pig: 'cobalt', k: 1, tint: 0.5 } : { shade: 0.6 })));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    P.axes(ctx, cam, 1, ['θ', 'L']);
    const L = (t: number) => t ** 7 * (1 - t) ** 3 / (0.7 ** 7 * 0.3 ** 3) * 0.9;
    P.line(ctx, cam, along(L, 0, 1, 60), PIG.cobalt, 2, 0.95);
    P.line(ctx, cam, [[0.7, 0], [0.7, 0.9]], PIG.ink, 0.9, 0.6, true);
    const p = cam.p(P.at(0.7, 0.9)); ring_dot(ctx, p[0], p[1], 5, PIG.cobalt, 1, 1.4);
    P.say(ctx, cam, '0.7', 0.7, -0.12, PIG.ink, 11);
  },
};
export default world;
