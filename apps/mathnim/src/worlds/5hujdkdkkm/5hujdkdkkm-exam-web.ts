// Opening a page with no DNS cached, and over a single connection: the client (left) and servers (right), time running
// down. First the name lookup (dashes, to the DNS server), then the handshake, then the page, then each of its objects
// one after another on the same connection (violet): count the round trips. Seen from above at rest.
import { PIG, render, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, words } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), C = card(0, 0, 6.2, 5.2, { bias: -10 }), y = 0.052, A = 0.9, D = 3.0, B = 5.4;
    frame(cam, [C], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [C]);
    for (const x of [A, D, B]) ink(ctx, cam, [[x, y, 0.55], [x, y, 5.0]], PIG.ink, 1.2, 0.75);
    arrow3(ctx, cam, [A, y, 0.7], [D, y, 0.95], PIG.graphite_t, 1.1, 0.8, true); arrow3(ctx, cam, [D, y, 1.0], [A, y, 1.25], PIG.graphite_t, 1.1, 0.8, true);
    for (let k = 0; k < 4; k++) { const z = 1.45 + k * 0.85; arrow3(ctx, cam, [A, y, z], [B, y, z + 0.35], k ? PIG.violet : PIG.ink, 1.2, 0.85); arrow3(ctx, cam, [B, y, z + 0.4], [A, y, z + 0.75], k ? PIG.violet : PIG.ink, 1.2, 0.85); }
    words(ctx, cam, say(st, 'client', '客户端'), [A, y, 0.4], PIG.ink, 10.5);
    words(ctx, cam, 'DNS', [D, y, 0.4], PIG.graphite_t, 10.5, 'center', 0.95, 500);
    words(ctx, cam, say(st, 'server', '服务器'), [B, y, 0.4], PIG.ink, 10.5);
  },
};
export default world;
