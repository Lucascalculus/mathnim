// Naive Bayes: counting, and smoothing. For each class (round, cobalt; square, ochre), how often each word appears
// (bars, seen from the front). One word never appeared with the square class: a zero would wipe out every product, so
// one is added to every count (the dashed block, +1): Laplace smoothing. Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

const A = [5, 2, 4, 1], B = [1, 4, 0, 3], U = 0.32;
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    A.forEach((n, i) => { const x = i * 1.6; S.push(box(x, 0, -0.25, x + 0.5, Math.max(0.02, n * U), 0.25, { pig: 'cobalt', k: 1, tint: 0.45 })); S.push(box(x + 0.6, 0, -0.25, x + 1.1, Math.max(0.02, B[i] * U), 0.25, { pig: 'ochre', k: 1, tint: 0.45 })); });
    S.push(box(2 * 1.6 + 0.6, 0.01, -0.25, 2 * 1.6 + 1.1, U, 0.25, { kind: 'wire', pig: 'ochre', solid: 0, alpha: 0.85 }));
    frame(cam, S, w, h, [12, 14, 12, 14], [[0, 5.4 * U, 0], [0, -0.3, 0]]);
    render(ctx, cam, S);
    words(ctx, cam, '+1', [2 * 1.6 + 0.85, U + 0.12, 0.25], PIG.ochre, 12, 'center', 0.95, 650);
    words(ctx, cam, '0', [2 * 1.6 + 0.85, -0.3, 0.25], PIG.ochre, 11, 'center', 0.9, 600);
  },
};
export default world;
