// The Web and HTTP, how many round trips a page takes: client (left) and server (right), time running down. One round
// trip to open the connection, one for the page, then one more for each object it refers to (the arrows across and
// back). Seen from above at rest.
import { PIG, render, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, words } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), C = card(0, 0, 5.6, 4.6, { bias: -10 }), y = 0.052, A = 1.0, B = 4.6;
    frame(cam, [C], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [C]);
    ink(ctx, cam, [[A, y, 0.5], [A, y, 4.4]], PIG.ink, 1.3, 0.8); ink(ctx, cam, [[B, y, 0.5], [B, y, 4.4]], PIG.ink, 1.3, 0.8);
    const legs: [number, string][] = [[0.6, 'graphite_t'], [1.6, 'violet'], [2.6, 'violet'], [3.6, 'violet']];
    for (const [z, pig] of legs) { arrow3(ctx, cam, [A, y, z], [B, y, z + 0.38], PIG[pig], 1.2, 0.85, pig === 'graphite_t'); arrow3(ctx, cam, [B, y, z + 0.42], [A, y, z + 0.8], PIG[pig], 1.2, 0.85, pig === 'graphite_t'); }
    words(ctx, cam, say(st, 'client', '客户端'), [A, y, 0.35], PIG.ink, 10.5);
    words(ctx, cam, say(st, 'server', '服务器'), [B, y, 0.35], PIG.ink, 10.5);
    words(ctx, cam, 'RTT', [0.85, y, 1.25], PIG.graphite_t, 10, 'right', 0.9, 500);
    ink(ctx, cam, [[0.9, y, 0.6], [0.9, y, 1.4]], PIG.graphite_t, 1, 0.6);
  },
};
export default world;
