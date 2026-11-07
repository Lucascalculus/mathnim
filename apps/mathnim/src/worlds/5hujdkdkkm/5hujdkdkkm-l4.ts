// Channel capacity and multiplexing: how fast one line can go, and how many share it. One link two ways: by frequency
// (three parallel lanes, each user its own band, all the time) and by time (one lane, the users taking turns in
// slots). Seen from above at rest; in the world, the lanes rise.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

const USERS = ['violet', 'teal', 'ochre'], L = 6.4;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], hh = 0.05 + 0.2 * u;
    USERS.forEach((pig, i) => S.push(box(0, 0, i * 0.42, L, hh, i * 0.42 + 0.36, { pig, k: 1, tint: 0.45 })));
    for (let k = 0; k < 12; k++) S.push(box(k * (L / 12) + 0.02, 0, 1.9, (k + 1) * (L / 12) - 0.02, hh, 2.5, { pig: USERS[k % 3], k: 1, tint: 0.45 }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[-2.3, 0, 0.7], [-2.3, 0, 2.3]]);
    render(ctx, cam, S);
    words(ctx, cam, say(st, 'by frequency', '频分'), [-0.2, hh, 0.7], PIG.ink, 10.5, 'right');
    words(ctx, cam, say(st, 'by time', '时分'), [-0.2, hh, 2.3], PIG.ink, 10.5, 'right');
  },
};
export default world;
