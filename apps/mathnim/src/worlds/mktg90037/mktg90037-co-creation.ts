// How customers and partners create value with us: the firm (cobalt), a customer (teal) and a partner (ochre) each
// bring blocks to one shared structure in the middle, built of all three colours. Seen from above at rest; in the
// world, the structure rises.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame } from '../_kit';
import { person } from './_mktg';

const SRC: [number, number, string][] = [[-2.2, -0.6, 'cobalt'], [2.2, -0.6, 'teal'], [0, 2.0, 'ochre']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    S.push(box(-2.6, 0, -1.0, -1.8, 0.15 + 0.5 * u, -0.2, { pig: 'cobalt', k: 1, tint: 0.4 }));
    S.push(...person(2.2, -0.6, { pig: 'teal', k: 1, tint: 0.4 }, 0.12 + 0.7 * u), ...person(0, 2.0, { pig: 'ochre', k: 1, tint: 0.4 }, 0.12 + 0.7 * u));
    const L = 0.06 + 0.16 * u;
    ['cobalt', 'teal', 'ochre', 'teal', 'cobalt', 'ochre'].forEach((pig, k) => { const r = 0.55 - k * 0.05; S.push(box(-r, k * L, -r + 0.2, r, (k + 1) * L - 0.01, r + 0.2, { pig, k: 1, tint: 0.45, bias: k * 0.01 })); });
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    for (const [x, z, pig] of SRC) arrow3(ctx, cam, [x * 0.7, 0.03, z * 0.7 + 0.06], [x * 0.3, 0.03, z * 0.3 + 0.14], PIG[pig], 1.4, 0.85);
  },
};
export default world;
