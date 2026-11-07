// Predicted Q3, a firm in the short and the long run: each plant size has its own short-run average cost, a U (grey);
// in the long run the firm picks the plant for its output, so its long-run average cost is the curve beneath them all
// (cobalt), the envelope each U just touches. Seen from above at rest.
import { PIG, render, turned } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { frame } from '../_kit';
import { along, panel } from './_econ';

const L = (q: number) => 0.28 + 0.95 * (q - 0.52) ** 2, dL = (q: number) => 1.9 * (q - 0.52);
const SR = (k: number) => (q: number) => L(k) + dL(k) * (q - k) + 3.2 * (q - k) ** 2;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), P = panel();
    frame(cam, [P.card], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card]);
    P.axes(ctx, cam, 1, ['Q', 'AC']);
    for (const k of [0.16, 0.36, 0.56, 0.78]) P.line(ctx, cam, along(SR(k), Math.max(0.02, k - 0.3), Math.min(1, k + 0.3)).filter(([, p]) => p < 0.98), PIG.graphite_t, 1.2, 0.8);
    P.line(ctx, cam, along(L, 0.02, 1, 40), PIG.cobalt, 2.1, 0.95);
    P.say(ctx, cam, 'LRAC', 1.0, L(1.0) - 0.1, PIG.cobalt, 11, 'left');
    P.say(ctx, cam, 'SRAC', 0.07, 0.93, PIG.graphite_t, 10.5, 'left', 500);
  },
};
export default world;
