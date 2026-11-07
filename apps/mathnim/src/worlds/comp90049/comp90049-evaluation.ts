// Evaluation: split the data three ways (the bar: train cobalt, validation teal, test ochre, kept aside until the end),
// and count what the model got right and wrong in the confusion matrix (four tiles: the diagonal right, rising tall in
// 3D; the others its two kinds of mistake). Seen from above at rest.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from '../_kit';

const SPLIT: [number, string, string, string][] = [[0.6, 'train', '训练', 'cobalt'], [0.2, 'validation', '验证', 'teal'], [0.2, 'test', '测试', 'ochre']];
const CM = [[0.82, 0.18], [0.25, 0.75]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], L = 7.0;
    let x = 0;
    for (const [f, , , pig] of SPLIT) { S.push(card(x, 0, x + f * L - 0.06, 0.6, { pig, k: 1, tint: 0.4 }, 0, 0.06 + 0.12 * u)); x += f * L; }
    const c = 1.15;
    CM.forEach((row, i) => row.forEach((v, j) => S.push(card(2.0 + j * (c + 0.08), 1.5 + i * (c + 0.08), 2.0 + j * (c + 0.08) + c, 1.5 + i * (c + 0.08) + c, i === j ? { pig: 'viridian', k: 1, tint: 0.2 + 0.4 * v } : { pig: 'ochre', k: 1, tint: 0.15 + 0.4 * v }, 0, 0.05 + 0.6 * v * u))));
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, 0, -0.45]]);
    render(ctx, cam, S);
    x = 0;
    for (const [f, en, zh, pig] of SPLIT) { words(ctx, cam, say(st, en, zh), [x + f * L / 2, 0.06 + 0.12 * u, -0.18], PIG[pig], 10.5); x += f * L; }
  },
};
export default world;
