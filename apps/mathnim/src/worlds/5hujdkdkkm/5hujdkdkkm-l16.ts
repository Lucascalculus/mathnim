// Email and streaming. Mail (left): the sender's program hands the letter to its mail server, which pushes it to the
// receiver's server (SMTP), where it waits to be fetched. Streaming (right): the player keeps a buffer (the tube)
// filling faster than it drains, so playback never waits. Seen from above at rest; in the world, the parts stand.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { host, person } from './_it';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    S.push(...person(0, 0.8, { pig: 'teal', k: 1, tint: 0.3 }, 0.12 + 0.7 * u), host(1.6, 0.8, 0.12 + 0.45 * u), host(3.2, 0.8, 0.12 + 0.45 * u), ...person(4.6, 0.8, { pig: 'teal', k: 1, tint: 0.3 }, 0.12 + 0.7 * u));
    S.push(box(1.6, 0, 2.2, 4.6, 0.06 + 0.2 * u, 2.7, { kind: 'wire', pig: 'violet', solid: 1, alpha: 0.6 }), box(1.62, 0, 2.24, 3.7, 0.05 + 0.18 * u, 2.66, { pig: 'violet', k: 1, tint: 0.5 }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[3.1, 0, 3.2]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [0.25, 0.03, 0.8], [1.2, 0.03, 0.8], PIG.ink, 1.2, 0.75);
    arrow3(ctx, cam, [2.0, 0.03, 0.8], [2.8, 0.03, 0.8], PIG.violet, 1.6, 0.9);
    arrow3(ctx, cam, [4.4, 0.03, 0.8], [3.6, 0.03, 0.8], PIG.ink, 1.2, 0.75, true);
    words(ctx, cam, 'SMTP', [2.4, 0.03, 0.55], PIG.violet, 10, 'center', 0.95, 650);
    arrow3(ctx, cam, [0.6, 0.03, 2.45], [1.5, 0.03, 2.45], PIG.violet, 1.6, 0.9);
    arrow3(ctx, cam, [4.7, 0.03, 2.45], [5.5, 0.03, 2.45], PIG.ink, 1.1, 0.7);
    words(ctx, cam, say(st, 'buffer', '缓冲'), [3.1, 0.06 + 0.2 * u, 3.1], PIG.violet, 10.5);
  },
};
export default world;
