// The drill: a table of the methods (rows) against what each needs and assumes (columns, the marks), and practice in
// the exam's three parts, A, B and C (cards). Seen from above at rest; in the world, the cards lift.
import { PIG, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';

const MARKS = [[1, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 1], [0, 0, 1, 1], [1, 0, 0, 1], [0, 1, 1, 1]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 4.4, 4.0, { shade: 0.6 })];
    ['A', 'B', 'C'].forEach((_, i) => S.push(card(5.1 + i * 1.3, 1.0, 6.2 + i * 1.3, 2.9, { pig: ['cobalt', 'teal', 'ochre'][i], k: 1, tint: 0.2 }, 0, 0.05 + (0.1 + 0.08 * i) * u)));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const y = 0.052;
    MARKS.forEach((row, i) => {
      const z = 0.55 + i * 0.55;
      ink(ctx, cam, [[0.3, y, z], [1.5, y, z]], PIG.graphite_t, 1.2, 0.55);
      row.forEach((m, j) => { const p = cam.p([2.0 + j * 0.6, y, z]); ring_dot(ctx, p[0], p[1], 2.8, PIG.cobalt, m, 1); });
    });
    ['A', 'B', 'C'].forEach((t, i) => words(ctx, cam, t, [5.65 + i * 1.3, 0.05 + (0.1 + 0.08 * i) * u, 2.1], PIG[['cobalt', 'teal', 'ochre'][i]], 15, 'center', 0.9, 650));
  },
};
export default world;
