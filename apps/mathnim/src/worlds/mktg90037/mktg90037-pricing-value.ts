// How to charge by value: one latte, five prices within a kilometre (5.90, 7.30, 6.50, 5.50, 3.00); the beans and the
// milk cost the same (the ochre floor under every cup). The difference is what each buyer thinks it is worth, where
// they are and what sits beside it. Seen from the front at rest.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

const PRICES = [5.9, 7.3, 6.5, 5.5, 3.0], K = 0.32;
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    PRICES.forEach((p, i) => { const x = i * 1.15; S.push(cylinder_y(x, 0, 0.38, 0, 0.7, 24, { pig: 'ochre', k: 1, tint: 0.4 }), cylinder_y(x, 0, 0.38, 0.7, p * K, 24, { pig: 'teal', k: 1, tint: 0.2 + 0.06 * p })); });
    frame(cam, S, w, h, [12, 22, 12, 12], [[0, 7.3 * K + 0.5, 0]]);
    render(ctx, cam, S);
    PRICES.forEach((p, i) => words(ctx, cam, p.toFixed(2), [i * 1.15, p * K + 0.15, 0.4], PIG.ink, 10.5, 'center', 0.9, 600));
  },
};
export default world;
