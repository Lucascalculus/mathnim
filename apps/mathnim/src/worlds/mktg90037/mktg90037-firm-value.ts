// How to know value was really created: a profitable firm can still destroy value. Its profit (cobalt) against the
// cost of the capital it uses (ochre, taller): economic value added is the difference, here below zero (dashes under
// the ground line). Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [], P = 1.6, K = 2.2;
    S.push(box(0, 0, -0.35, 0.8, P, 0.35, { pig: 'cobalt', k: 1, tint: 0.45 }), box(1.3, 0, -0.35, 2.1, K, 0.35, { pig: 'ochre', k: 1, tint: 0.4 }));
    S.push(box(2.6, -(K - P), -0.35, 3.4, -0.01, 0.35, { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.8 }));
    frame(cam, S, w, h, [12, 14, 12, 14], [[0.4, -1.1, 0], [-0.4, 0, 0], [4.0, 0, 0]]);
    render(ctx, cam, S);
    ink(ctx, cam, [[-0.3, 0, 0.36], [3.7, 0, 0.36]], PIG.ink, 1, 0.75);
    words(ctx, cam, say(st, 'profit', '利润'), [0.4, -0.35, 0.35], PIG.cobalt, 10.5);
    words(ctx, cam, say(st, 'cost of capital', '资本成本'), [1.7, -0.35, 0.35], PIG.ochre, 10.5);
    words(ctx, cam, 'EVA', [3.0, -(K - P) - 0.35, 0.35], PIG.ink, 10.5, 'center', 0.85);
  },
};
export default world;
