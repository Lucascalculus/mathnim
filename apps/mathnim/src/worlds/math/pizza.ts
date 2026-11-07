// Pizza (the video lesson): one 16-inch pizza or two 8-inch ones? The two small ones (cobalt) laid on the big one
// (ochre) cover exactly half of it: twice as wide is four times the pizza. Seen from above at rest; in the world, the
// pizzas as discs of dough, the small ones lying on the big one.
import { PIG, render, turned } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';
import { disc } from './_math';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), th = 0.08 + 0.14 * u;
    const small = { pig: 'cobalt', k: 1, tint: 0.38, bias: 1 };
    const S = [disc([0, 0], 2, th, { pig: 'ochre', k: 1, tint: 0.4, bias: -1 }), disc([-1, 0], 0.985, th, small, undefined, th), disc([1, 0], 0.985, th, small, undefined, th)];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    words(ctx, cam, '8″', [-1, 2 * th, 0.14], PIG.cobalt, 13, 'center', 0.95, 650);
    words(ctx, cam, '8″', [1, 2 * th, 0.14], PIG.cobalt, 13, 'center', 0.95, 650);
    words(ctx, cam, '16″', [0, th, 1.5], PIG.ochre, 13, 'center', 0.95, 650);
  },
};
export default world;
