// How to get someone who sells several brands to sell more of mine: a salesperson (the figure) shares their effort
// among four brands (blocks, the arrows as thick as the effort); what pulls it toward mine (cobalt): the incentive
// (coins) and making my brand easy to sell. Seen from above at rest; in the world, the brands and the coins stand.
import { PIG, box, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { person } from './_mktg';

const BR: [number, number, number, boolean][] = [[3.2, -1.5, 1.0, false], [3.6, -0.4, 3.2, true], [3.6, 0.7, 1.2, false], [3.2, 1.8, 0.8, false]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    S.push(...person(0, 0.15, { pig: 'teal', k: 1, tint: 0.3 }, 0.12 + 0.8 * u));
    for (const [x, z, , mine] of BR) S.push(box(x - 0.35, 0, z - 0.35, x + 0.35, 0.1 + 0.45 * u, z + 0.35, mine ? { pig: 'cobalt', k: 1, tint: 0.5 } : { shade: 0.6 }));
    for (let k = 0; k < 4; k++) S.push(cylinder_y(4.6, -0.4, 0.22, k * (0.02 + 0.07 * u), k * (0.02 + 0.07 * u) + 0.02 + 0.05 * u, 18, { pig: 'ochre', k: 1, tint: 0.55 }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[4.9, 0, 0.2]]);
    render(ctx, cam, S);
    for (const [x, z, f, mine] of BR) arrow3(ctx, cam, [0.3, 0.03, 0.15 + (z - 0.15) * 0.1], [x - 0.45, 0.03, z], mine ? PIG.cobalt : PIG.ink, f, mine ? 0.9 : 0.55);
    words(ctx, cam, say(st, 'mine', '我的'), [3.6, 0.1 + 0.45 * u, -0.85], PIG.cobalt, 10.5);
  },
};
export default world;
