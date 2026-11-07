// Sharing one channel: medium access control and Ethernet. Five stations on one cable; two start sending at once and
// their frames meet in the middle (the burst, ochre): a collision. Listen before sending, stop when you hear a clash,
// wait a random time and try again. Seen from above at rest; in the world, the stations stand.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink } from '../_kit';
import { host, link, packet } from './_it';

const XS = [0, 1.6, 3.2, 4.8, 6.4];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = XS.map((x, i) => host(x, i % 2 ? -1.0 : 1.0, 0.12 + 0.35 * u));
    S.push(packet(2.3, 0, 0), packet(3.9, 0, Math.PI));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    link(ctx, cam, [-0.5, 0], [6.9, 0], PIG.ink, 2.2, 0.7);
    XS.forEach((x, i) => link(ctx, cam, [x, 0], [x, i % 2 ? -0.75 : 0.75], PIG.ink, 1, 0.6));
    render(ctx, cam, S);
    const c: [number, number] = [3.1, 0];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ink(ctx, cam, [[c[0] + 0.12 * Math.cos(a), 0.1, c[1] + 0.12 * Math.sin(a)], [c[0] + 0.32 * Math.cos(a), 0.1, c[1] + 0.32 * Math.sin(a)]], PIG.ochre, 1.6, 0.95); }
  },
};
export default world;
