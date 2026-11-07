// Backpropagation: the network computes forward (ink, left to right); the error at the output flows back along the
// same links (ochre arrowheads, right to left), each weight getting its share by the chain rule. Seen from above at
// rest; in the world, the units stand.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, ink, words } from '../_kit';

const LAYERS: [number, number][] = [[0, 2], [2.4, 3], [4.8, 1]];
const zs = (n: number) => Array.from({ length: n }, (_, i) => 1.4 + (i - (n - 1) / 2) * 1.0);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    LAYERS.forEach(([x, n], l) => { for (const z of zs(n)) S.push(cylinder_y(x, z, 0.28, 0, 0.06 + 0.35 * u, 20, { pig: l === 2 ? 'ochre' : 'cobalt', k: 1, tint: 0.4 })); });
    frame(cam, S, w, h, [12, 12, 12, 12], [[6.0, 0, 1.4], [2.4, 0, -0.55], [2.4, 0, 3.2]]);
    const links: [[number, number], [number, number]][] = [];
    for (let l = 0; l < 2; l++) for (const a of zs(LAYERS[l][1])) for (const b of zs(LAYERS[l + 1][1])) links.push([[LAYERS[l][0] + 0.3, a], [LAYERS[l + 1][0] - 0.3, b]]);
    for (const [a, b] of links) ink(ctx, cam, [[a[0], 0.01, a[1]], [b[0], 0.01, b[1]]], PIG.ink, 0.9, 0.4);
    render(ctx, cam, S);
    // the error's way back: an arrowhead on each link, pointing to its input
    for (const [a, b] of links) { const m = (t: number): [number, number, number] => [b[0] + (a[0] - b[0]) * t, 0.02, b[1] + (a[1] - b[1]) * t]; arrow3(ctx, cam, m(0.38), m(0.52), PIG.ochre, 1.4, 0.95); }
    arrow3(ctx, cam, [0, 0.02, -0.4], [1.6, 0.02, -0.4], PIG.ink, 1.2, 0.7);
    words(ctx, cam, say(st, 'forward', '前向'), [1.8, 0.02, -0.32], PIG.ink, 10.5, 'left', 0.85, 500);
    arrow3(ctx, cam, [4.8, 0.02, 3.0], [3.2, 0.02, 3.0], PIG.ochre, 1.4, 0.9);
    words(ctx, cam, say(st, 'error, back', '误差往回'), [3.0, 0.02, 3.08], PIG.ochre, 10.5, 'right');
  },
};
export default world;
