// Congestion control: everyone wants to send fast; what happens to the network. TCP's congestion window over time: it
// grows fast at first (slow start), then by one each round trip, and halves when a loss says the network is full: the
// sawtooth (violet). Seen from above at rest.
import { PIG, render, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, panel, type QP } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), P = panel();
    frame(cam, [P.card], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card]);
    P.axes(ctx, cam, 1, [say(st, 'time', '时间'), 'cwnd']);
    const pts: QP[] = [];
    let t = 0, c = 0.04;
    while (c < 0.6) { pts.push([t, c]); t += 0.035; c *= 1.6; }
    for (let k = 0; k < 3; k++) { pts.push([t, c]); const t1 = t + 0.22; pts.push([t1, c + 0.3]); t = t1; c = (c + 0.3) / 2; pts.push([t, c]); }
    pts.push([Math.min(1, t + 0.15), c + 0.2]);
    P.line(ctx, cam, pts, PIG.violet, 2, 0.95);
  },
};
export default world;
