// How things flow, and what a dummy is: suppliers (cobalt, as tall as what they can ship) send goods along routes to
// customers (ochre, as tall as what they need). Supply exceeds demand, so a dummy customer (dashes) takes the rest at
// no cost: it balances the table without moving anything. Seen from above at rest; in the world, the nodes stand up.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';

const SUP: [number, number][] = [[0.5, 0.75], [1.8, 0.5], [3.1, 0.9]], DEM: [number, number][] = [[0.2, 0.6], [1.4, 0.55], [2.6, 0.6]], DUMMY: [number, number] = [3.8, 0.4];
const FLOW: [number, number, number][] = [[0, 0, 1.6], [0, 1, 1], [1, 1, 1.2], [2, 2, 1.8], [2, 3, 1]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], XS = 0, XD = 4.6;
    for (const [z, s] of SUP) S.push(cylinder_y(XS, z, 0.34, 0, 0.06 + s * u, 22, { pig: 'cobalt', k: 1, tint: 0.5 }));
    for (const [z, d] of DEM) S.push(cylinder_y(XD, z, 0.34, 0, 0.06 + d * u, 22, { pig: 'ochre', k: 1, tint: 0.5 }));
    S.push(cylinder_y(XD, DUMMY[0], 0.34, 0, 0.06 + DUMMY[1] * u, 22, { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.7 }));
    frame(cam, S, w, h, [12, 22, 12, 12], [[XS, 0, -0.55], [XD + 1.4, 0, DUMMY[0]]]);
    render(ctx, cam, S);
    const zd = [...DEM.map(([z]) => z), DUMMY[0]];
    for (const [i, j, f] of FLOW) arrow3(ctx, cam, [XS + 0.4, 0.03, SUP[i][0]], [XD - 0.42, 0.03, zd[j]], j === 3 ? PIG.graphite_t : PIG.ink, f, j === 3 ? 0.6 : 0.8, j === 3);
    words(ctx, cam, say(st, 'supply', '供应'), [XS, 0.06 + u, -0.5], PIG.cobalt, 10.5);
    words(ctx, cam, say(st, 'demand', '需求'), [XD, 0.06 + 0.6 * u, -0.5], PIG.ochre, 10.5);
    words(ctx, cam, say(st, 'dummy', '虚拟'), [XD + 0.5, 0.06, DUMMY[0] + 0.12], PIG.graphite_t, 10.5, 'left', 0.95, 500);
  },
};
export default world;
