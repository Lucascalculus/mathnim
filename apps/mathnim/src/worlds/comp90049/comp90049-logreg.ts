// Logistic regression: one input across; the examples of class 1 (round) up at the top, class 0 (square) along the
// bottom; the model's probability of class 1 is the S-shaped curve (cobalt), and where it crosses one half (dashes) is
// the decision boundary. Seen from above at rest; in the world, the examples stand.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { along, frame, panel } from '../_kit';
import { form } from './_ml';

const X1 = [0.42, 0.55, 0.62, 0.7, 0.78, 0.86, 0.94], X0 = [0.06, 0.13, 0.2, 0.27, 0.35, 0.48, 0.58];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel(), S: Solid[] = [P.card];
    for (const x of X1) { const q = P.at(x, 0.92); S.push(form(q[0], q[2], 0, 0.1 + 0.2 * u, 0.12)); }
    for (const x of X0) { const q = P.at(x, 0.04); S.push(form(q[0], q[2], 1, 0.1 + 0.2 * u, 0.12)); }
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    P.axes(ctx, cam, 1, ['x', 'P']);
    P.line(ctx, cam, along((x) => 0.04 + 0.88 / (1 + Math.exp(-14 * (x - 0.5))), 0, 1, 60), PIG.cobalt, 2, 0.95);
    P.line(ctx, cam, [[0, 0.48], [1, 0.48]], PIG.ink, 0.9, 0.5, true);
    P.line(ctx, cam, [[0.5, 0], [0.5, 1]], PIG.ink, 1.2, 0.75, true);
  },
};
export default world;
