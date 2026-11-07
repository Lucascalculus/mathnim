// Bias and fairness: two groups of applicants (pegs), the model's yes in dark: six in ten for one group, three in ten
// for the other. Where the gap comes from (the data, the labels, the model), how to measure it (here, the rate of yes)
// and what to do about it. Seen from above at rest; in the world, the chosen stand up.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

const GROUPS: [number, number, string, string, string][] = [[0, 6, 'group A', 'A 组', 'cobalt'], [3.4, 3, 'group B', 'B 组', 'teal']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (const [x0, yes, , , pig] of GROUPS) for (let i = 0; i < 10; i++) {
      const x = x0 + (i % 5) * 0.55, z = Math.floor(i / 5) * 0.75, chosen = i < yes;
      S.push(cylinder_y(x, z, 0.18, 0, 0.06 + (chosen ? 0.6 : 0.15) * u, 16, chosen ? { pig, k: 1, tint: 0.6 } : { pig, k: 1, tint: 0.12 }));
    }
    frame(cam, S, w, h, [12, 12, 12, 22], [[1.1, 0, 1.6]]);
    render(ctx, cam, S);
    for (const [x0, yes, en, zh, pig] of GROUPS) words(ctx, cam, `${say(st, en, zh)} · ${yes}/10`, [x0 + 1.1, 0.06, 1.55], PIG[pig], 10.5);
  },
};
export default world;
