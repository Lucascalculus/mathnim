// Computing check bits, CRC and Hamming codes: a Hamming(7,4) code word, bits at positions 1 to 7; the parity bits sit
// at 1, 2 and 4 (teal), each checking the positions whose number contains it (the arcs, for the bit at 1: 1, 3, 5, 7).
// One flipped bit (ochre) fails exactly the checks that add up to its position. Seen from above at rest.
import { PIG, box, render, turned, type Solid, type V3 } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const D = 0.9, BAD = 5;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (let p = 1; p <= 7; p++) { const par = (p & (p - 1)) === 0; S.push(box(p * D, 0, 0, p * D + 0.7, 0.06 + (par ? 0.35 : 0.15) * u, 0.7, p === BAD ? { pig: 'ochre', k: 1, tint: 0.6 } : par ? { pig: 'teal', k: 1, tint: 0.5 } : { pig: 'violet', k: 1, tint: 0.2 })); }
    frame(cam, S, w, h, [12, 22, 12, 22], [[D, 0, -1.4], [D, 0, 1.2]]);
    render(ctx, cam, S);
    const arcTo = (a: number, b: number, hgt: number, pig: typeof PIG.ink) => { const pts: V3[] = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([(a + (b - a) * t) * D + 0.35, 0.03, -0.1 - Math.sin(Math.PI * t) * hgt]); } ink(ctx, cam, pts, pig, 1.1, 0.75); };
    for (const q of [3, 5, 7]) arcTo(1, q, 0.25 + 0.12 * q, PIG.teal);
    for (let p = 1; p <= 7; p++) words(ctx, cam, String(p), [p * D + 0.35, 0.03, 1.05], PIG.ink, 10.5, 'center', 0.8, 600);
  },
};
export default world;
