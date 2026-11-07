// The shortest Ethernet frame, 1 Gbps over 1 km with CSMA/CD: distance across, time down. A sends; its signal reaches
// the far end B just as B starts to send; B's signal (the collision) comes back to A at twice the travel time. A must
// still be sending then to notice, so a frame must last that long (the violet bar down A's side). Seen from above.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, words } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), A = 0.8, B = 5.2, T0 = 0.6, TAU = 1.6, y = 0.052;
    const S: Solid[] = [card(0, 0, 6.0, 4.4, { bias: -10 }), box(A - 0.3, 0.05, T0, A - 0.08, 0.05 + 0.02 + 0.3 * u, T0 + 2 * TAU, { pig: 'violet', k: 1, tint: 0.6 })];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, [[A, y, 0.35], [A, y, 4.2]], PIG.ink, 1.2, 0.75); ink(ctx, cam, [[B, y, 0.35], [B, y, 4.2]], PIG.ink, 1.2, 0.75);
    arrow3(ctx, cam, [A, y, T0], [B, y, T0 + TAU], PIG.violet, 1.4, 0.9);
    arrow3(ctx, cam, [B, y, T0 + TAU], [A, y, T0 + 2 * TAU], PIG.ochre, 1.4, 0.9);
    words(ctx, cam, 'A', [A, y, 0.25], PIG.ink, 11.5); words(ctx, cam, 'B', [B, y, 0.25], PIG.ink, 11.5);
    words(ctx, cam, '2τ', [A - 0.4, y, T0 + TAU + 0.1], PIG.violet, 12, 'right', 0.95, 650);
    words(ctx, cam, say(st, '1 km', '1 公里'), [(A + B) / 2, y, 0.25], PIG.graphite_t, 10, 'center', 0.95, 500);
  },
};
export default world;
