// E1 Verifiable rewards and GRPO: one prompt, a group of attempts; a program checks each (its reward, a column). Each
// attempt is pushed by how far it stands from the group's own average (dashes): above it, made more likely (teal,
// arrow up); below, less (arrow down). Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, ink, words } from './_ft';

const R = [1, 0.15, 1, 0.6, 0.1, 1, 0.3, 0.85];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [], n = R.length, avg = R.reduce((a, b) => a + b, 0) / n, H = 2.0, dx = 0.75;
    R.forEach((r, i) => S.push(box(i * dx, 0, -0.3, i * dx + 0.5, 0.05 + r * H, 0.3, r > avg ? { pig: 'teal', k: 1, tint: 0.5 } : { shade: 0.7 })));
    frame(cam, S, w, h, [12, 14, 12, 12], [[0, H + 0.75, 0], [n * dx + 1.9, 0, 0]]);
    render(ctx, cam, S);
    const ya = avg * H + 0.05;
    ink(ctx, cam, [[-0.2, ya, 0.31], [n * dx, ya, 0.31]], PIG.ink, 1.1, 0.8, true);
    words(ctx, cam, say(st, 'group average', '组内平均'), [n * dx + 0.1, ya - 0.07, 0.31], PIG.ink, 10.5, 'left', 0.85, 500);
    R.forEach((r, i) => {
      const x = i * dx + 0.25, t = 0.05 + r * H + 0.12, l = Math.abs(r - avg) * 0.9 + 0.12;
      if (r > avg) arrow3(ctx, cam, [x, t, 0.31], [x, t + l, 0.31], PIG.teal, 1.3, 0.9);
      else arrow3(ctx, cam, [x, t + l, 0.31], [x, t, 0.31], PIG.graphite_t, 1.1, 0.75);
    });
  },
};
export default world;
