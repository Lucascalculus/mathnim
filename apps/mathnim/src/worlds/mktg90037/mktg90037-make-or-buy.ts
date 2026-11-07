// What to make and what to buy: the firm's chain of activities (blocks in a row); the ones that build its advantage it
// does itself (cobalt), the rest it buys from outside suppliers (dashes, fed by arrows from a supplier). Seen from above
// at rest; in the world, what it makes stands taller.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';

const MAKE = [true, false, true, true, false];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], dx = 1.25;
    MAKE.forEach((m, i) => S.push(box(i * dx, 0, 0, i * dx + 1.0, 0.08 + (m ? 0.5 : 0.15) * u, 0.9, m ? { pig: 'cobalt', k: 1, tint: 0.45 } : { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.75 })));
    S.push(box(1.6, 0, 2.3, 4.6, 0.08 + 0.25 * u, 3.0, { pig: 'ochre', k: 1, tint: 0.3 }));
    frame(cam, S, w, h, [12, 22, 12, 12], [[2.9, 0, -0.55]]);
    render(ctx, cam, S);
    MAKE.forEach((m, i) => { if (!m) arrow3(ctx, cam, [i * dx + 0.5, 0.03, 2.25], [i * dx + 0.5, 0.03, 1.0], PIG.ochre, 1.3, 0.85); });
    for (let i = 0; i < MAKE.length - 1; i++) arrow3(ctx, cam, [i * dx + 1.02, 0.03, 0.45], [(i + 1) * dx - 0.02, 0.03, 0.45], PIG.ink, 1, 0.5);
    words(ctx, cam, say(st, 'make', '自己做'), [1.5 * dx, 0.03, -0.3], PIG.cobalt, 10.5);
    words(ctx, cam, say(st, 'buy', '买'), [3.1, 0.08 + 0.25 * u, 2.75], PIG.ochre, 10.5);
  },
};
export default world;
