// UDP and TCP, the light and the steady. Two lanes between the same hosts: UDP sends datagrams as they come, no
// promises (spaced anyhow, one lost in dashes); TCP first shakes hands, then sends numbered segments in order, each
// acknowledged (teal ticks back). Seen from above at rest.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { host, link, packet } from './_it';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [host(0, 0.4, 0.12 + 0.3 * u), host(6.2, 0.4, 0.12 + 0.3 * u), host(0, 2.0, 0.12 + 0.3 * u), host(6.2, 2.0, 0.12 + 0.3 * u)];
    for (const [x, lost] of [[1.2, false], [1.9, false], [3.4, true], [4.3, false]] as [number, boolean][]) S.push(packet(x, 0.4, 0, 0, lost ? { kind: 'wire', pig: 'violet', solid: 0, alpha: 0.8 } : {}));
    for (let i = 0; i < 4; i++) S.push(packet(1.5 + i * 1.0, 2.0, 0));
    frame(cam, S, w, h, [40, 12, 12, 12]);
    link(ctx, cam, [0.4, 0.4], [5.8, 0.4], PIG.ink, 1.1, 0.5); link(ctx, cam, [0.4, 2.0], [5.8, 2.0], PIG.ink, 1.1, 0.5);
    render(ctx, cam, S);
    for (let i = 0; i < 4; i++) arrow3(ctx, cam, [1.8 + i * 1.0, 0.03, 2.38], [1.3 + i * 1.0, 0.03, 2.38], PIG.teal, 1.1, 0.8);
    words(ctx, cam, 'UDP', [-0.5, 0.03, 0.5], PIG.ink, 11, 'right', 0.9, 650);
    words(ctx, cam, 'TCP', [-0.5, 0.03, 2.1], PIG.ink, 11, 'right', 0.9, 650);
  },
};
export default world;
