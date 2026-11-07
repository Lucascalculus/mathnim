// The multilayer perceptron: units stacked in layers, every unit of one layer feeding every unit of the next (the
// links): inputs (teal), a hidden layer (cobalt), the outputs (ochre). Each hidden unit draws one line; together they
// bend the boundary. Seen from above at rest; in the world, the layers stand, the hidden one tallest.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink } from '../_kit';

const LAYERS: [number, number, string, number][] = [[0, 3, 'teal', 0.3], [2.6, 5, 'cobalt', 0.55], [5.2, 2, 'ochre', 0.4]];
const zs = (n: number) => Array.from({ length: n }, (_, i) => 1.8 + (i - (n - 1) / 2) * 0.85);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (const [x, n, pig, hh] of LAYERS) for (const z of zs(n)) S.push(cylinder_y(x, z, 0.28, 0, 0.06 + hh * u, 20, { pig, k: 1, tint: 0.45 }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    for (let l = 0; l < LAYERS.length - 1; l++) for (const a of zs(LAYERS[l][1])) for (const b of zs(LAYERS[l + 1][1])) ink(ctx, cam, [[LAYERS[l][0] + 0.3, 0.01, a], [LAYERS[l + 1][0] - 0.3, 0.01, b]], PIG.ink, 0.9, 0.35);
    render(ctx, cam, S);
  },
};
export default world;
