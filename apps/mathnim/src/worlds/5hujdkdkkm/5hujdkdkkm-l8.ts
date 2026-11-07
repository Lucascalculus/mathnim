// The network layer: carrying a packet across one network after another. Three different networks (plates of their
// own tint), joined by routers; the packet's way from one host to the other crosses them all (violet), hop by hop.
// Seen from above at rest; in the world, the routers stand.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { disc, frame, ink } from '../_kit';
import { host, packet, router } from './_it';

const NETS: [number, number, number, string][] = [[0.9, 1.2, 1.2, 'teal'], [3.6, 0.9, 1.25, 'ochre'], [6.3, 1.4, 1.15, 'cobalt']];
const PATH: [number, number][] = [[0.4, 1.5], [2.1, 0.9], [4.85, 1.15], [7.0, 1.6]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (const [x, z, r, pig] of NETS) S.push(disc([x, z], r, 0.03, { pig, k: 1, tint: 0.18, bias: -10 }));
    S.push(host(PATH[0][0], PATH[0][1], 0.12 + 0.35 * u), host(PATH[3][0], PATH[3][1], 0.12 + 0.35 * u), router(PATH[1][0], PATH[1][1], 0.08 + 0.3 * u), router(PATH[2][0], PATH[2][1], 0.08 + 0.3 * u));
    S.push(packet(3.5, 1.02, -0.09, 0.03));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, PATH.map(([x, z]) => [x, 0.035, z] as [number, number, number]), PIG.violet, 1.6, 0.85);
  },
};
export default world;
