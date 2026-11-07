// Allocating address blocks, CIDR allocation and aggregation: a range of addresses as a strip of 16 cells; blocks are
// handed out in powers of two, each starting on a multiple of its own size (customers in colour); two neighbouring
// blocks that together form one aligned block can be announced as one route (the bracket). Seen from above at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const BLOCKS: [number, number, string | undefined][] = [[0, 8, 'cobalt'], [8, 4, 'teal'], [12, 2, 'ochre'], [14, 2, 'violet']], D = 0.42;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (const [a, n, pig] of BLOCKS) for (let i = a; i < a + n; i++) S.push(box(i * D, 0, 0, i * D + D - 0.04, 0.06 + Math.log2(n) * 0.1 * u, 0.7, { pig, k: 1, tint: 0.45 }));
    frame(cam, S, w, h, [12, 22, 12, 22], [[0, 0, -0.7], [0, 0, 1.3]]);
    render(ctx, cam, S);
    const y = 0.03;
    ink(ctx, cam, [[12 * D, y, -0.1], [12 * D, y, -0.3], [16 * D - 0.04, y, -0.3], [16 * D - 0.04, y, -0.1]], PIG.ink, 1.3, 0.85);
    words(ctx, cam, '/31 + /31 = /30', [14 * D, y, -0.45], PIG.ink, 10, 'center', 0.85, 600);
    for (const [a, n, pig] of BLOCKS) words(ctx, cam, '/' + (32 - Math.log2(n)), [(a + n / 2) * D, y, 1.15], pig ? PIG[pig] : PIG.ink, 10, 'center', 0.95, 650);
  },
};
export default world;
