// What customers say, or what they will want? From the firm (block), a short arrow to the need customers state today
// (solid, teal) and a long dashed one to the need they cannot yet name (dashes, further out): responsive or proactive.
// Seen from above at rest; in the world, the needs stand up.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { person } from './_mktg';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    S.push(box(-0.6, 0, -0.6, 0.6, 0.15 + 0.5 * u, 0.6, { shade: 0.6 }));
    S.push(box(2.3, 0, -1.55, 3.1, 0.1 + 0.4 * u, -0.75, { pig: 'teal', k: 1, tint: 0.5 }));
    S.push(box(5.4, 0, 0.6, 6.2, 0.1 + 0.4 * u, 1.4, { kind: 'wire', pig: 'teal', solid: 0, alpha: 0.85 }));
    S.push(...person(3.6, -1.15, { pig: 'teal', k: 1, tint: 0.25 }, 0.12 + 0.6 * u));
    frame(cam, S, w, h, [12, 12, 12, 22], [[2.7, 0, -2.1], [5.8, 0, 1.95], [7.0, 0, 1.95], [4.6, 0, 1.95]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [0.7, 0.03, -0.35], [2.2, 0.03, -1.1], PIG.ink, 1.4, 0.85);
    arrow3(ctx, cam, [0.7, 0.03, 0.3], [5.3, 0.03, 1.0], PIG.ink, 1.4, 0.75, true);
    words(ctx, cam, say(st, 'what they say', '说出来的'), [2.7, 0.03, -1.85], PIG.teal, 10.5);
    words(ctx, cam, say(st, 'what they will want', '将来要的'), [5.8, 0.03, 1.85], PIG.teal, 10.5);
  },
};
export default world;
