// Can you write four? Two hours, four answers of 600 to 750 words: four sheets, each planned in three parts (the
// short ink lines at its head) then written; the fourth still being written. Seen from above at rest; in the world, the
// finished ones are stacked thicker.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], dx = 1.85;
    for (let i = 0; i < 4; i++) S.push(card(i * dx, 0, i * dx + 1.5, 2.1, { shade: 0.6 }, 0, 0.04 + (i < 3 ? 0.15 : 0.04) * u));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    for (let i = 0; i < 4; i++) {
      const y = 0.042 + (i < 3 ? 0.15 : 0.04) * u, x0 = i * dx + 0.18, rows = i < 3 ? 9 : 4;
      ['cobalt', 'teal', 'ochre'].forEach((pig, k) => ink(ctx, cam, [[x0, y, 0.25], [x0 + 0.3, y, 0.25]].map(([x, yy, z]) => [x + k * 0.4, yy, z] as [number, number, number]), PIG[pig], 2.4, 0.85));
      for (let r = 0; r < rows; r++) ink(ctx, cam, [[x0, y, 0.55 + r * 0.16], [x0 + (r === rows - 1 ? 0.6 : 1.14), y, 0.55 + r * 0.16]], PIG.graphite_t, 1, 0.45);
      words(ctx, cam, String(i + 1), [i * dx + 1.38, y, 2.0], PIG.graphite_t, 9.5, 'right', 0.9);
    }
  },
};
export default world;
