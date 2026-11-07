// C3 QLoRA and shipping adapters: the base model's weights stored in 4 bits, a grid of blocks that take only a few
// values (NF4, four shades shown), and beside it a shelf of small adapters (violet), one plugged in: one frozen base,
// many fine-tunes. Seen from above, the coarse grid; in the world, its few levels as heights.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from './_ft';

const LEVEL = (i: number, j: number) => Math.abs(Math.round(1.5 + 1.5 * Math.sin(i * 1.7 + j * 0.9) * Math.cos(j * 1.3 - i * 0.4)));
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], n = 7, s = 0.5;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const l = LEVEL(i, j); S.push(box(i * s, 0, j * s, i * s + s - 0.04, 0.05 + l * 0.12 * u, j * s + s - 0.04, { pig: 'ink', k: 1, tint: 0.05 + l * 0.1, shade: 0.5 })); }
    for (let k = 0; k < 3; k++) S.push(card(4.6, k * 1.1, 5.9, k * 1.1 + 0.8, { pig: 'violet', k: 1, tint: 0.35 + k * 0.1 }, 0, 0.08));
    S.push(card(n * s + 0.12, 2.4, n * s + 0.42, 3.4, { pig: 'violet', k: 1, tint: 0.7 }, 0, 0.09));
    frame(cam, S, w, h, [12, 12, 12, 22]);
    render(ctx, cam, S);
    words(ctx, cam, say(st, '4-bit base', '4 位底座'), [n * s / 2, 0.06, n * s + 0.45], PIG.graphite_t, 10.5, 'center', 0.95, 500);
    words(ctx, cam, say(st, 'adapters', '适配器'), [5.25, 0.1, 3.75], PIG.violet, 10.5);
  },
};
export default world;
