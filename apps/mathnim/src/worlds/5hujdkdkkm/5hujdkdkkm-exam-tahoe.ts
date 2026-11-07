// Congestion control, TCP Tahoe after a timeout: the window grows (slow start, then one per round trip); at the
// timeout it falls all the way to one segment, the threshold is set to half of where it was (dashes), and slow start
// climbs again to the threshold before growing slowly. Seen from above at rest.
import { PIG, render, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, panel, type QP } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), P = panel();
    frame(cam, [P.card], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card]);
    P.axes(ctx, cam, 1, [say(st, 'round trips', '往返次数'), 'cwnd']);
    const pts: QP[] = [[0, 0.05], [0.08, 0.1], [0.16, 0.2], [0.24, 0.4], [0.32, 0.8], [0.4, 0.86], [0.48, 0.92], [0.48, 0.05], [0.56, 0.1], [0.64, 0.2], [0.72, 0.4], [0.76, 0.46], [0.84, 0.52], [0.92, 0.58], [1.0, 0.64]];
    P.line(ctx, cam, [[0, 0.46], [1.02, 0.46]], PIG.ink, 1, 0.6, true);
    P.line(ctx, cam, pts, PIG.violet, 2, 0.95);
    P.say(ctx, cam, say(st, 'timeout', '超时'), 0.5, 0.97, PIG.ochre, 10.5, 'left');
    P.say(ctx, cam, 'ssthresh', 0.03, 0.5, PIG.ink, 10, 'left', 500);
  },
};
export default world;
