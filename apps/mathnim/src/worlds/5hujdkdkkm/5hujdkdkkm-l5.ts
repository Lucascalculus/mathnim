// The data link layer: reliable between two neighbours. Frames go from one machine to the next (violet); one is lost on
// the way (dashes), its acknowledgement never comes, the timer runs out and it is sent again; each frame that arrives
// is acknowledged (teal, back). Seen from above at rest; in the world, the machines stand.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { host, link, packet } from './_it';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [host(0, 0.6, 0.12 + 0.35 * u), host(6, 0.6, 0.12 + 0.35 * u)];
    S.push(packet(1.4, 0.35, 0), packet(2.6, 0.35, 0, 0, { kind: 'wire', pig: 'violet', solid: 0, alpha: 0.85 }), packet(3.9, 0.35, 0, 0, { tint: 0.6 }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    link(ctx, cam, [0.4, 0.6], [5.6, 0.6], PIG.ink, 1.3, 0.6);
    render(ctx, cam, S);
    arrow3(ctx, cam, [4.9, 0.03, 0.95], [3.4, 0.03, 0.95], PIG.teal, 1.3, 0.85);
    arrow3(ctx, cam, [2.5, 0.03, 0.95], [1.0, 0.03, 0.95], PIG.teal, 1.3, 0.85);
    words(ctx, cam, '✕', [2.6, 0.2, 0.1], PIG.ochre, 13, 'center', 0.95, 650);
    words(ctx, cam, 'ACK', [3.2, 0.03, 1.32], PIG.teal, 10, 'center');
  },
};
export default world;
