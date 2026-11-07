// Shortest paths by hand, Dijkstra's algorithm: from the source (violet), settle the nearest unsettled router, update
// its neighbours, repeat; each router ends with its distance (the number) and the link it was reached by (violet): the
// tree of shortest paths. Seen from above at rest; in the world, each router stands as tall as its distance.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';
import { link, router } from './_it';

const N: Record<string, [number, number, number]> = { A: [0, 1.4, 0], B: [1.8, 0.2, 2], C: [1.8, 2.6, 4], D: [3.6, 1.4, 3], E: [5.4, 0.2, 6], F: [5.4, 2.6, 5] };
const E: [string, string, number, boolean][] = [['A', 'B', 2, true], ['A', 'C', 4, true], ['B', 'D', 1, true], ['C', 'D', 2, false], ['B', 'E', 7, false], ['D', 'E', 3, true], ['D', 'F', 2, true], ['C', 'F', 3, false]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = Object.entries(N).map(([k, [x, z, d]]) => router(x, z, 0.08 + d * 0.1 * u, k === 'A' ? { pig: 'violet', k: 1, tint: 0.5 } : {}));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    for (const [a, b, c, tree] of E) { link(ctx, cam, [N[a][0], N[a][1]], [N[b][0], N[b][1]], tree ? PIG.violet : PIG.graphite_t, tree ? 2 : 1, tree ? 0.85 : 0.45); words(ctx, cam, String(c), [(N[a][0] + N[b][0]) / 2 + 0.12, 0.02, (N[a][1] + N[b][1]) / 2 - 0.08], PIG.graphite_t, 9.5, 'center', 0.9, 500); }
    render(ctx, cam, S);
    for (const [, [x, z, d]] of Object.entries(N)) words(ctx, cam, String(d), [x, 0.08 + d * 0.1 * u, z + 0.1], PIG.ink, 11, 'center', 0.9, 650);
  },
};
export default world;
