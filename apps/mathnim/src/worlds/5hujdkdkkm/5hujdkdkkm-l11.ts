// The transport layer: a reliable connection over an unreliable network. Between a process on one host and a process on
// the other (each at its port, the notch), a pipe through the network (the tube) in which segments arrive in order,
// numbered, whatever the hops in between lose or shuffle. Seen from above at rest; in the world, the hosts stand.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';
import { host, link, packet, router } from './_it';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [host(0, 1.0, 0.15 + 0.45 * u), host(6.4, 1.0, 0.15 + 0.45 * u)];
    for (const [x, z] of [[1.9, 0.1], [3.2, 1.9], [4.5, 0.2], [2.6, 1.0]] as [number, number][]) S.push(router(x, z, 0.06 + 0.15 * u));
    S.push(box(0.4, 0, 0.82, 6.0, 0.03, 1.18, { kind: 'wire', pig: 'violet', solid: 1, alpha: 0.5 }));
    [1, 2, 3, 4].forEach((n, i) => S.push(packet(1.4 + i * 1.15, 1.0, 0, 0.03)));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    for (const [a, b] of [[[1.9, 0.1], [3.2, 1.9]], [[3.2, 1.9], [4.5, 0.2]], [[1.9, 0.1], [4.5, 0.2]], [[2.6, 1.0], [1.9, 0.1]], [[2.6, 1.0], [3.2, 1.9]]] as [number, number][][]) link(ctx, cam, a, b, PIG.graphite_t, 1, 0.4);
    render(ctx, cam, S);
    [1, 2, 3, 4].forEach((n, i) => words(ctx, cam, String(n), [1.4 + i * 1.15, 0.2, 0.72], PIG.violet, 10, 'center', 0.9, 650));
    ink(ctx, cam, [[0.34, 0.15 + 0.45 * u + 0.002, 0.92], [0.34, 0.15 + 0.45 * u + 0.002, 1.08]], PIG.ink, 2, 0.8);
  },
};
export default world;
