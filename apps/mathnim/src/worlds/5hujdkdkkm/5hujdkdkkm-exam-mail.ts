// Mail and media: SMTP, and lossy compression. Above, a letter pushed from the sender's server to the receiver's by
// SMTP. Below, an image compressed with loss: the fine grid (left) kept as coarser blocks (right), details the eye
// would not miss thrown away. Seen from above at rest; in the world, the blocks rise by their shade.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { host } from './_it';

const IMG = (i: number, j: number) => 0.5 + 0.45 * Math.sin(i * 0.9 + 0.4) * Math.cos(j * 0.7 - 0.3) + 0.1 * Math.sin(i * 3.1 + j * 2.3);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [host(0.4, 0, 0.12 + 0.35 * u), host(4.6, 0, 0.12 + 0.35 * u)], n = 8, d = 0.2;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = IMG(i, j); S.push(box(j * d, 0, 1.0 + i * d, j * d + d - 0.02, 0.03 + v * 0.3 * u, 1.0 + i * d + d - 0.02, { pig: 'violet', k: 1, tint: 0.1 + 0.6 * v, shadow: false })); }
    for (let i = 0; i < n; i += 2) for (let j = 0; j < n; j += 2) { const v = (IMG(i, j) + IMG(i + 1, j) + IMG(i, j + 1) + IMG(i + 1, j + 1)) / 4, q = Math.round(v * 3) / 3; S.push(box(3.2 + j * d, 0, 1.0 + i * d, 3.2 + j * d + 2 * d - 0.03, 0.03 + q * 0.3 * u, 1.0 + i * d + 2 * d - 0.03, { pig: 'violet', k: 1, tint: 0.1 + 0.6 * q, shadow: false })); }
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [0.9, 0.03, 0], [4.1, 0.03, 0], PIG.violet, 1.5, 0.9);
    words(ctx, cam, 'SMTP', [2.5, 0.03, -0.25], PIG.violet, 10, 'center', 0.95, 650);
    arrow3(ctx, cam, [1.8, 0.03, 1.8], [3.05, 0.03, 1.8], PIG.ink, 1.3, 0.8);
  },
};
export default world;
