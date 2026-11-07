// Who creates value, the factory or the customer? Along the line from the factory (block) through the product (cube)
// to the customer (figure), value (teal) appears only where the product is used: value in use, co-created by the
// customer. Seen from above at rest; in the world, the value rises round the customer.
import { PIG, box, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { person } from './_mktg';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    S.push(box(-0.7, 0, -0.55, 0.7, 0.2 + 0.6 * u, 0.55, { shade: 0.6 }), box(0.25, 0.2 + 0.6 * u, -0.45, 0.5, 0.2 + 1.0 * u, -0.2, { shade: 0.6 }));
    S.push(box(2.3, 0, -0.25, 2.8, 0.1 + 0.3 * u, 0.25, { pig: 'cobalt', k: 1, tint: 0.45 }));
    S.push(cylinder_y(5.0, 0, 0.95, 0, 0.02 + 0.1 * u, 40, { pig: 'teal', k: 1, tint: 0.45 }));
    const p = person(5.0, 0, { pig: 'teal', k: 1, tint: 0.3 }, 0.1 + 0.8 * u); for (const s of p) { for (const q of s.pts) q[1] += 0.02 + 0.1 * u; s.c[1] += 0.1; } S.push(...p);
    S.push(box(4.55, 0.12 + 0.1 * u, 0.3, 4.85, 0.2 + 0.3 * u, 0.6, { pig: 'cobalt', k: 1, tint: 0.45 }));
    frame(cam, S, w, h, [12, 12, 12, 22], [[5.0, 0, 1.45], [6.1, 0, 1.45], [3.9, 0, 1.45]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [0.85, 0.03, 0], [2.15, 0.03, 0], PIG.ink, 1.2, 0.75);
    arrow3(ctx, cam, [2.95, 0.03, 0], [3.95, 0.03, 0], PIG.ink, 1.2, 0.75);
    words(ctx, cam, say(st, 'value in use', '使用中的价值'), [5.0, 0.03, 1.35], PIG.teal, 10.5);
  },
};
export default world;
