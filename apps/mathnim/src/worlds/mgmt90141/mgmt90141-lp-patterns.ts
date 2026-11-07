// Which of the six shapes is it? Six cards, one per kind of model, each with the picture of the limit that gives it
// away: a budget (costs under a cap), a proportion (a share of the whole), make or buy (two ways to get the same thing),
// overtime (extra hours on top of capacity), a blend (ingredients mixed to a recipe), a schedule (shifts that start
// each day). Seen from above at rest; in the world, the cards lift.
import { PIG, render, turned, type Solid, type V3 } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, words } from '../_kit';

const NAMES: [string, string][] = [['budget', '预算'], ['proportion', '占比'], ['make or buy', '自制或外购'], ['overtime', '加班'], ['blend', '配比'], ['schedule', '排班']];
const W = 1.9, D = 1.25, GX = 2.3, GZ = 1.85;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], y = 0.05 + 0.18 * u;
    NAMES.forEach((_, i) => { const x = (i % 3) * GX, z = Math.floor(i / 3) * GZ; S.push(card(x, z, x + W, z + D, { shade: 0.5 }, 0, y)); });
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, 0, GZ + D + 0.4]]);
    render(ctx, cam, S);
    const yy = y + 0.002;
    NAMES.forEach(([en, zh], i) => {
      const x = (i % 3) * GX, z = Math.floor(i / 3) * GZ, at = (a: number, b: number): V3 => [x + 0.2 + a * (W - 0.4), yy, z + 0.2 + b * (D - 0.4)];
      const bar = (a0: number, a1: number, b: number, pig: string, wd = 4, alpha = 0.85, dashed = false) => ink(ctx, cam, [at(a0, b), at(a1, b)], PIG[pig] ?? PIG.ink, wd, alpha, dashed);
      if (i === 0) { bar(0, 0.3, 0.5, 'cobalt'); bar(0.32, 0.55, 0.5, 'teal'); bar(0.57, 0.78, 0.5, 'ochre'); ink(ctx, cam, [at(0.88, 0.15), at(0.88, 0.85)], PIG.ink, 1.3, 0.85); }
      if (i === 1) { bar(0, 0.35, 0.5, 'cobalt'); bar(0.35, 1, 0.5, 'graphite_t', 4, 0.4); ink(ctx, cam, [at(0.35, 0.15), at(0.35, 0.85)], PIG.ink, 1, 0.8, true); }
      if (i === 2) { arrow3(ctx, cam, at(0.05, 0.25), at(0.8, 0.25), PIG.cobalt, 1.4, 0.9); arrow3(ctx, cam, at(0.05, 0.75), at(0.8, 0.75), PIG.ochre, 1.4, 0.9, true); ink(ctx, cam, [at(0.92, 0.1), at(0.92, 0.9)], PIG.ink, 2.4, 0.8); }
      if (i === 3) { bar(0, 0.62, 0.5, 'cobalt'); bar(0.64, 0.92, 0.5, 'ochre', 4, 0.8); ink(ctx, cam, [at(0.63, 0.15), at(0.63, 0.85)], PIG.ink, 1, 0.8); }
      if (i === 4) { bar(0.1, 0.9, 0.2, 'teal', 5, 0.75); bar(0.1, 0.9, 0.5, 'ochre', 5, 0.75); bar(0.1, 0.9, 0.8, 'violet', 5, 0.75); }
      if (i === 5) for (let k = 0; k < 5; k++) bar(k * 0.13, k * 0.13 + 0.45, 0.08 + k * 0.21, 'cobalt', 2.6, 0.8);
      words(ctx, cam, say(st, en, zh), [x + W / 2, 0.05, z + D + 0.32], PIG.ink, 10.5, 'center', 0.9, 500);
    });
  },
};
export default world;
