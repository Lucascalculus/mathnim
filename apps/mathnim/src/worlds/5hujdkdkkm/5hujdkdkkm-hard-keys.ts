// The arithmetic of keys by hand, RSA and Diffie–Hellman: the paint-mixing picture of Diffie–Hellman. A common colour
// everyone sees (ochre); Alice and Bob each mix in a secret (cobalt, teal) and swap the mixtures in the open; each adds
// their own secret again, and both end with the same colour (violet) that no onlooker can mix. Seen from above.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], pot = (x: number, z: number, pig: string, tint = 0.5) => S.push(cylinder_y(x, z, 0.32, 0, 0.08 + 0.35 * u, 22, { pig, k: 1, tint }));
    pot(2.5, 0, 'ochre');
    pot(0, 1.4, 'cobalt'); pot(5, 1.4, 'teal');
    pot(1.0, 2.6, 'cobalt', 0.3); pot(4.0, 2.6, 'teal', 0.3);
    pot(1.0, 4.0, 'violet', 0.55); pot(4.0, 4.0, 'violet', 0.55);
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const A = (a: [number, number], b: [number, number], pig = PIG.ink, dashed = false) => arrow3(ctx, cam, [a[0], 0.03, a[1]], [b[0], 0.03, b[1]], pig, 1.1, 0.7, dashed);
    A([2.2, 0.25], [1.15, 2.25]); A([2.8, 0.25], [3.85, 2.25]); A([0.2, 1.7], [0.85, 2.3], PIG.cobalt); A([4.8, 1.7], [4.15, 2.3], PIG.teal);
    A([1.35, 2.75], [3.7, 3.85], PIG.ink, true); A([3.65, 2.75], [1.3, 3.85], PIG.ink, true);
    A([0.15, 1.75], [0.8, 3.7], PIG.cobalt); A([4.85, 1.75], [4.2, 3.7], PIG.teal);
  },
};
export default world;
