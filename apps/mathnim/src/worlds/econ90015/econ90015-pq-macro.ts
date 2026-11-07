// Predicted Q8, GDP, inflation and money: the quantity equation MV = PY as two rectangles of equal area: the money in
// circulation M times how often it changes hands V (cobalt), and the price level P times real output Y (ochre). More
// money with V and Y fixed can only raise P. Seen from above at rest; in the world, the two stand as equal amounts.
import { PIG, extrude, render, turned, type V3 } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), hgt = 0.004 + 0.4 * u;
    const rect = (x0: number, z0: number, x1: number, z1: number, pig: string) => extrude([[x0, 0.05, z0], [x1, 0.05, z0], [x1, 0.05, z1], [x0, 0.05, z1]] as V3[], [0, hgt, 0], { pig, k: 1, tint: 0.4, shade: 0.6 });
    // M·V = 1.6 × 2.4 = 3.84 = P·Y = 2.4 × 1.6
    const S = [card(0, 0, 7.4, 3.4, { bias: -10 }), rect(0.6, 0.5, 2.2, 2.9, 'cobalt'), rect(4.2, 1.3, 6.6, 2.9, 'ochre')];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const y = 0.05 + hgt;
    words(ctx, cam, 'M', [1.4, 0.05, 3.25], PIG.cobalt, 12);
    words(ctx, cam, 'V', [0.38, 0.05, 1.8], PIG.cobalt, 12, 'right');
    words(ctx, cam, 'P', [4.0, 0.05, 2.2], PIG.ochre, 12, 'right');
    words(ctx, cam, 'Y', [5.4, 0.05, 3.25], PIG.ochre, 12);
    words(ctx, cam, '=', [3.2, y * 0.5, 2.1], PIG.ink, 18, 'center', 0.8, 500);
  },
};
export default world;
