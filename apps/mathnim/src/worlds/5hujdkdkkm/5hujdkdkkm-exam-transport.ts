// Finding a process, and RPC over UDP or TCP: a host with its ports (the doors along its side), each a process; a
// segment arrives addressed to one port (violet) and is handed to the process behind it. A short request and reply
// needs no connection: UDP. Seen from above at rest; in the world, the host stands.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { packet } from './_it';

const PORTS = ['22', '53', '80', '443'];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [box(0.9, 0, 0.1, 2.2, 0.12 + 0.4 * u, 3.1, { shade: 0.6 })];
    PORTS.forEach((_, i) => S.push(box(2.2, 0, 0.35 + i * 0.75, 2.45, 0.08 + 0.3 * u, 0.75 + i * 0.75, i === 1 ? { pig: 'violet', k: 1, tint: 0.6 } : { shade: 0.6 })));
    S.push(packet(4.4, 0.35 + 0.75 + 0.2, Math.PI, 0));
    frame(cam, S, w, h, [12, 12, 12, 12], [[5.4, 0, 1.3]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [4.1, 0.08, 1.3], [2.55, 0.08, 1.3], PIG.violet, 1.4, 0.9);
    PORTS.forEach((p, i) => words(ctx, cam, p, [2.55, 0.03, 0.62 + i * 0.75], i === 1 ? PIG.violet : PIG.graphite_t, 10, 'left', 0.95, i === 1 ? 650 : 500));
  },
};
export default world;
