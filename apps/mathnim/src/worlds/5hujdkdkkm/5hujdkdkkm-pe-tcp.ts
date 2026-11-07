// A TCP connection: why the client does not bind, and the sender's two windows. The byte stream as a strip: sent and
// acknowledged (dark), in flight, not yet sent. The receiver allows so much (teal bracket), the network so much (cobalt
// bracket); the sender may have only the smaller in flight. Seen from above at rest; in the world, the in-flight bytes.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const N = 18, ACKED = 5, RW = 9, CW = 6, D = 0.36;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (let i = 0; i < N; i++) { const fl = i >= ACKED && i < ACKED + CW; S.push(box(i * D, 0, 0, i * D + D - 0.04, 0.05 + (fl ? 0.35 : 0.05) * u, 0.6, i < ACKED ? { pig: 'violet', k: 1, tint: 0.6 } : fl ? { pig: 'violet', k: 1, tint: 0.3 } : { shade: 0.6 })); }
    frame(cam, S, w, h, [12, 22, 12, 12], [[0, 0, -1.2], [0, 0, 1.6]]);
    render(ctx, cam, S);
    const br = (a: number, b: number, z: number, pig: typeof PIG.ink) => { const y = 0.03; ink(ctx, cam, [[a * D, y, z + (z < 0 ? 0.15 : -0.15)], [a * D, y, z], [b * D - 0.04, y, z], [b * D - 0.04, y, z + (z < 0 ? 0.15 : -0.15)]], pig, 1.4, 0.9); };
    br(ACKED, ACKED + RW, -0.35, PIG.teal); br(ACKED, ACKED + CW, 0.95, PIG.cobalt);
    words(ctx, cam, say(st, 'receiver window', '接收窗口'), [(ACKED + RW / 2) * D, 0.03, -0.5], PIG.teal, 10.5);
    words(ctx, cam, say(st, 'congestion window', '拥塞窗口'), [(ACKED + CW / 2) * D, 0.03, 1.35], PIG.cobalt, 10.5);
  },
};
export default world;
