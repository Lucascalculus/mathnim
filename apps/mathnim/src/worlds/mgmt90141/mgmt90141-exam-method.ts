// How to spend two hours and a hundred marks: 1.2 minutes a mark. The two hours as a dial, cut in proportion to the
// marks: the compulsory question (cobalt) and the three optional ones you choose (teal, ochre, violet); beside it the
// four optional questions, the one you leave drawn in dashes. Seen from above at rest; in the world, the dial's parts.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words, wedge } from '../_kit';

const PARTS: [number, string][] = [[40, 'cobalt'], [20, 'teal'], [20, 'ochre'], [20, 'violet']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], R = 1.7;
    let a = -Math.PI / 2;
    PARTS.forEach(([m, pig], i) => { const da = (m / 100) * Math.PI * 2; S.push(wedge([0, 0], R, a + 0.015, a + da - 0.015, 0, 0.06 + (i === 0 ? 0.3 : 0.18) * u, { pig, k: 1, tint: 0.45 })); a += da; });
    ['teal', 'ochre', null, 'violet'].forEach((pig, i) => S.push(card(2.6 + i * 1.05, -0.55, 3.45 + i * 1.05, 0.65, pig ? { pig, k: 1, tint: 0.35 } : { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.6 }, 0, 0.05 + (pig ? 0.12 * u : 0))));
    frame(cam, S, w, h, [12, 12, 12, 22], [[0, 0, R + 0.5], [5.5, 0, R + 0.5]]);
    render(ctx, cam, S);
    words(ctx, cam, say(st, '120 minutes', '120 分钟'), [0, 0.05, R + 0.42], PIG.ink, 10.5);
    words(ctx, cam, say(st, 'choose 3 of 4', '四选三'), [4.17, 0.05, 1.1], PIG.ink, 10.5);
  },
};
export default world;
