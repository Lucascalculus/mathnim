// An encrypted file read from the middle: modes of operation. The file as blocks, each encrypted in a chain (CBC: each
// block mixed with the one before, the ochre links). To read block k you need only block k and the cipher block before
// it (violet), not everything from the start. Seen from above at rest; in the world, the blocks rise.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';

const N = 7, K = 4;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], D = 0.95;
    for (let i = 0; i < N; i++) S.push(box(i * D, 0, 0, i * D + 0.75, 0.06 + (i === K || i === K - 1 ? 0.4 : 0.15) * u, 0.75, i === K ? { pig: 'violet', k: 1, tint: 0.6 } : i === K - 1 ? { pig: 'violet', k: 1, tint: 0.3 } : { shade: 0.6 }));
    frame(cam, S, w, h, [12, 22, 12, 22], [[0, 0, -0.6], [0, 0, 1.4]]);
    render(ctx, cam, S);
    for (let i = 0; i < N - 1; i++) arrow3(ctx, cam, [i * D + 0.6, 0.03, -0.18], [(i + 1) * D + 0.15, 0.03, -0.18], PIG.ochre, 1.1, i === K - 1 ? 0.95 : 0.5);
    words(ctx, cam, say(st, 'read from here', '从这里读'), [K * D + 0.375, 0.03, 1.25], PIG.violet, 10.5);
  },
};
export default world;
