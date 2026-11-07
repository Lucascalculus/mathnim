// The chance of landing between two values: the normal curve as a solid bell of thin slices (seen from the front);
// the slices between a and b are cobalt: their share of the whole bell is the probability. In the world, the bell's
// depth: the probability as a volume.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const N = 41, X0 = -3, X1 = 3, A = -0.6, B = 1.3, H = 2.4;
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [], dx = (X1 - X0) / N;
    for (let i = 0; i < N; i++) {
      const x = X0 + (i + 0.5) * dx, hh = H * Math.exp(-x * x / 2), on = x >= A && x <= B;
      S.push(box(x - dx / 2 + 0.008, 0, -0.5, x + dx / 2 - 0.008, Math.max(0.02, hh), 0.5, on ? { pig: 'cobalt', k: 1, tint: 0.5, shade: 0.6 } : { shade: 0.6 }));
    }
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, -0.5, 0]]);
    render(ctx, cam, S);
    ink(ctx, cam, [[X0 - 0.2, 0, 0.5], [X1 + 0.2, 0, 0.5]], PIG.ink, 1, 0.7);
    words(ctx, cam, 'a', [A, -0.38, 0.5], PIG.cobalt, 12, 'center', 0.95, 650);
    words(ctx, cam, 'b', [B, -0.38, 0.5], PIG.cobalt, 12, 'center', 0.95, 650);
  },
};
export default world;
