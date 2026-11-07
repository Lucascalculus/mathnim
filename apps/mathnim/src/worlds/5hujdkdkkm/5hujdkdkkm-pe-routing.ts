// Routing: datagrams or virtual circuits, and distance vector. Routers on a graph, each link with its cost; one router
// (violet) builds its table from what its neighbours tell it (the arrows in): to each destination, a neighbour's
// distance plus the link to that neighbour, keeping the smallest. Seen from above at rest; in the world, the routers.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, words } from '../_kit';
import { link, router } from './_it';

const N: Record<string, [number, number]> = { A: [0, 1.2], B: [1.6, 0], C: [1.6, 2.4], D: [3.4, 1.2], E: [4.8, 0.2] };
const E: [string, string, number][] = [['A', 'B', 2], ['A', 'C', 5], ['B', 'D', 3], ['C', 'D', 1], ['D', 'E', 4], ['B', 'E', 8]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = Object.entries(N).map(([k, [x, z]]) => router(x, z, 0.08 + 0.3 * u, k === 'A' ? { pig: 'violet', k: 1, tint: 0.5 } : {}));
    S.push(card(-1.9, 0.6, -0.6, 2.6, { shade: 0.6 }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    for (const [a, b, c] of E) { link(ctx, cam, N[a], N[b], PIG.ink, 1.1, 0.55); words(ctx, cam, String(c), [(N[a][0] + N[b][0]) / 2 + 0.1, 0.02, (N[a][1] + N[b][1]) / 2 - 0.08], PIG.graphite_t, 9.5, 'center', 0.95, 500); }
    render(ctx, cam, S);
    arrow3(ctx, cam, [1.3, 0.03, 0.25], [0.3, 0.03, 0.9], PIG.violet, 1.2, 0.85); arrow3(ctx, cam, [1.3, 0.03, 2.15], [0.3, 0.03, 1.5], PIG.violet, 1.2, 0.85);
    ['A 0', 'B 2', 'C 5', 'D 5', 'E 9'].forEach((t, i) => words(ctx, cam, t, [-1.25, 0.052, 0.95 + i * 0.36], PIG.ink, 9.5, 'center', 0.85, 600));
    ink(ctx, cam, [[-1.75, 0.052, 0.75], [-0.75, 0.052, 0.75]], PIG.violet, 1.5, 0.8);
  },
};
export default world;
