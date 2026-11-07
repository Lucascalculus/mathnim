// Self-supervised learning: make the labels from the data itself. A sentence (tokens, cards) with one word hidden
// (dashes, ?): predicting it from the words round it (arrows) needs no person to label anything, and teaches what words
// mean. Seen from above at rest; in the world, the context stands up round the hole.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';

const N = 7, HOLE = 4;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (let i = 0; i < N; i++) {
      const x = i * 0.95, near = Math.abs(i - HOLE) === 1;
      S.push(box(x, 0, 0, x + 0.75, 0.06 + (near ? 0.35 : 0.15) * u, 0.75, i === HOLE ? { kind: 'wire', pig: 'cobalt', solid: 0, alpha: 0.9 } : { pig: near ? 'teal' : undefined, k: 1, tint: 0.4, shade: 0.6 }));
    }
    frame(cam, S, w, h, [12, 22, 12, 12], [[0, 0, -0.7]]);
    render(ctx, cam, S);
    const c = HOLE * 0.95 + 0.375;
    arrow3(ctx, cam, [c - 0.95, 0.1, -0.15], [c - 0.2, 0.1, -0.15], PIG.teal, 1.3, 0.85);
    arrow3(ctx, cam, [c + 0.95, 0.1, -0.15], [c + 0.2, 0.1, -0.15], PIG.teal, 1.3, 0.85);
    words(ctx, cam, '?', [c, 0.06, 0.5], PIG.cobalt, 15, 'center', 0.9, 650);
  },
};
export default world;
