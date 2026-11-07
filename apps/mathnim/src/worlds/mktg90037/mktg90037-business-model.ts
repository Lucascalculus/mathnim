// How the whole business keeps its promise and makes money: the business model canvas, its nine parts as tiles in
// their places: partners, activities and resources (left), the value proposition at the centre (teal), relationships,
// channels and customers (right); costs (ochre) and revenues (cobalt) along the bottom. In the world, the tiles rise.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from '../_kit';

// x0, z0, x1, z1, pigment, height
const TILES: [number, number, number, number, string | undefined, number][] = [
  [0, 0, 1.4, 2.8, undefined, 0.15], [1.45, 0, 2.85, 1.375, undefined, 0.15], [1.45, 1.425, 2.85, 2.8, undefined, 0.15],
  [2.9, 0, 4.3, 2.8, 'teal', 0.45], [4.35, 0, 5.75, 1.375, undefined, 0.15], [4.35, 1.425, 5.75, 2.8, undefined, 0.15], [5.8, 0, 7.2, 2.8, undefined, 0.2],
  [0, 2.85, 3.575, 3.9, 'ochre', 0.25], [3.625, 2.85, 7.2, 3.9, 'cobalt', 0.35]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (const [x0, z0, x1, z1, pig, hh] of TILES) S.push(card(x0, z0, x1, z1, pig ? { pig, k: 1, tint: 0.38 } : { shade: 0.6 }, 0, 0.05 + hh * u));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    words(ctx, cam, say(st, 'value', '价值主张'), [3.6, 0.05 + 0.45 * u, 1.5], PIG.teal, 10.5);
    words(ctx, cam, say(st, 'costs', '成本'), [1.8, 0.05 + 0.25 * u, 3.47], PIG.ochre, 10.5);
    words(ctx, cam, say(st, 'revenue', '收入'), [5.4, 0.05 + 0.35 * u, 3.47], PIG.cobalt, 10.5);
  },
};
export default world;
