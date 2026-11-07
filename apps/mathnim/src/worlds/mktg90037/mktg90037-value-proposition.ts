// Can you say your promise in one sentence? One line on a card, in three parts that must fit together: for whom
// (teal), the need they have (ochre), and the benefit only we give (cobalt). Seen from above at rest.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';

const PARTS: [number, number, string, string, string][] = [[0.4, 1.9, 'for whom', '为谁', 'teal'], [2.1, 4.0, 'the need', '需要', 'ochre'], [4.2, 6.6, 'our benefit', '好处', 'cobalt']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 7.0, 2.6, { shade: 0.6 }, 0, 0.05 + 0.2 * u)];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const y = 0.052 + 0.2 * u;
    for (const [a, b, en, zh, pig] of PARTS) {
      ink(ctx, cam, [[a, y, 1.15], [b, y, 1.15]], PIG[pig], 7, 0.75);
      words(ctx, cam, say(st, en, zh), [(a + b) / 2, y, 1.85], PIG[pig], 11);
    }
    ink(ctx, cam, [[6.75, y, 1.15], [6.8, y, 1.15]], PIG.ink, 3, 0.8);
  },
};
export default world;
