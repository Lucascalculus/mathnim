// Is what we offer what customers need? The value proposition canvas: our offer as a square (products, pain relievers,
// gain creators; cobalt) and the customer as a circle (jobs, pains, gains; teal); the fit is when each reliever meets
// a pain and each creator a gain (arrows). Seen from above at rest; in the world, the two halves rise.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, wedge, words } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], hh = 0.05 + 0.25 * u, C: [number, number] = [5.3, 1.4], R = 1.4;
    S.push(card(0, 0, 2.8, 2.8, { pig: 'cobalt', k: 1, tint: 0.2 }, 0, hh));
    S.push(wedge(C, R, Math.PI / 2, Math.PI * 1.5, 0, hh, { pig: 'teal', k: 1, tint: 0.3 }), wedge(C, R, -Math.PI / 2, Math.PI / 6, 0, hh, { pig: 'teal', k: 1, tint: 0.2 }), wedge(C, R, Math.PI / 6, Math.PI / 2, 0, hh, { pig: 'teal', k: 1, tint: 0.45 }));
    frame(cam, S, w, h, [12, 12, 12, 22], [[1.4, 0, 3.3]]);
    render(ctx, cam, S);
    const y = hh + 0.004;
    ink(ctx, cam, [[0, y, 1.4], [2.8, y, 1.4]], PIG.ink, 1, 0.5); ink(ctx, cam, [[1.4, y, 0], [1.4, y, 1.4]], PIG.ink, 1, 0.5);
    arrow3(ctx, cam, [2.1, y, 0.7], [4.75, y, 0.6], PIG.ink, 1.3, 0.8);
    arrow3(ctx, cam, [2.1, y, 2.1], [4.75, y, 2.15], PIG.ink, 1.3, 0.8);
    words(ctx, cam, say(st, 'our offer', '我们提供的'), [1.4, 0.05, 3.2], PIG.cobalt, 10.5);
    words(ctx, cam, say(st, 'the customer', '顾客'), [C[0], 0.05, 3.2], PIG.teal, 10.5);
  },
};
export default world;
