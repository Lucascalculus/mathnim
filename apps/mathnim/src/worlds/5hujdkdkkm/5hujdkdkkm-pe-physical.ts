// Cables and signals: fibre or copper, and how many bits a symbol carries. A signal that can sit at four levels (the
// lines) carries two bits in each symbol (00, 01, 10, 11): the same symbol rate, twice the bits. Seen from the front at
// rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const LV = [2, 0, 3, 1, 3, 2, 0, 1], D = 0.7, H = 0.42, NAME = ['00', '01', '10', '11'];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    LV.forEach((l, i) => S.push(box(i * D, 0, -0.2, i * D + D - 0.05, 0.12 + l * H + 0.08, 0.2, { pig: 'violet', k: 1, tint: 0.2 + l * 0.15 })));
    frame(cam, S, w, h, [40, 12, 12, 12], [[-0.6, 0, 0]]);
    render(ctx, cam, S);
    for (let l = 0; l < 4; l++) { const y = 0.12 + l * H + 0.08; ink(ctx, cam, [[-0.1, y, 0.21], [LV.length * D, y, 0.21]], PIG.ink, 0.8, 0.35, true); words(ctx, cam, NAME[l], [-0.2, y - 0.07, 0.21], PIG.ink, 10, 'right', 0.85, 600); }
  },
};
export default world;
