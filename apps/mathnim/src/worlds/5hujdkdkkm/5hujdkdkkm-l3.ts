// The physical layer: how bits travel on a wire. The wire (a long slab) carries a signal that is high or low in each
// bit's slot (the raised blocks, seen from the front): 1 0 1 1 0 0 1 0. Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const BITS = [1, 0, 1, 1, 0, 0, 1, 0], D = 0.7;
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [box(-0.3, 0, -0.25, BITS.length * D + 0.3, 0.12, 0.25, { shade: 0.6 })];
    BITS.forEach((b, i) => S.push(box(i * D, 0.12, -0.18, i * D + D, 0.12 + (b ? 0.9 : 0.2), 0.18, { pig: 'violet', k: 1, tint: b ? 0.6 : 0.2, shade: 0.6 })));
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, 1.5, 0], [0, -0.4, 0]]);
    render(ctx, cam, S);
    const sig: [number, number, number][] = [];
    BITS.forEach((b, i) => { const y = 0.12 + (b ? 0.9 : 0.2) + 0.12; sig.push([i * D, y, 0.19], [i * D + D, y, 0.19]); });
    ink(ctx, cam, sig, PIG.ink, 1.4, 0.85);
    BITS.forEach((b, i) => words(ctx, cam, String(b), [i * D + D / 2, 1.38, 0.19], PIG.ink, 12, 'center', 0.85, 650));
  },
};
export default world;
