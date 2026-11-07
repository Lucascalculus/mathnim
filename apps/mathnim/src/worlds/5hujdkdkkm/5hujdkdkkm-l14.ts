// DNS, turning a name into an address: the name servers as a tree, the root at the top, then .com, then the server
// for the site itself. A resolver asks each in turn (the numbered arrows), and each points it one level down, until
// the last gives the address. Seen from above at rest; in the world, the servers stand.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { host, link } from './_it';

const N: Record<string, [number, number]> = { root: [3.2, 0], com: [2.0, 1.4], org: [4.4, 1.4], site: [1.2, 2.8], other: [2.8, 2.8], res: [6.0, 2.8] };
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = Object.entries(N).map(([k, [x, z]]) => host(x, z, 0.1 + (k === 'res' ? 0.45 : 0.3) * u, k === 'res' ? { pig: 'violet', k: 1, tint: 0.3 } : k === 'site' ? { pig: 'teal', k: 1, tint: 0.35 } : {}));
    frame(cam, S, w, h, [12, 12, 12, 12], [[3.2, 0, -0.5]]);
    for (const [a, b] of [['root', 'com'], ['root', 'org'], ['com', 'site'], ['com', 'other']]) link(ctx, cam, N[a], N[b], PIG.graphite_t, 1, 0.5);
    render(ctx, cam, S);
    (['root', 'com', 'site'] as const).forEach((k, i) => { const [x, z] = N[k]; arrow3(ctx, cam, [N.res[0] - 0.4, 0.06, N.res[1] - 0.1 - i * 0.05], [x + 0.4, 0.06, z + 0.1], PIG.violet, 1.1, 0.75); words(ctx, cam, String(i + 1), [(N.res[0] + x) / 2, 0.06, (N.res[1] + z) / 2 - 0.08], PIG.violet, 10.5, 'center', 0.95, 650); });
    words(ctx, cam, '.', [N.root[0], 0.1 + 0.3 * u, N.root[1] - 0.34], PIG.ink, 14, 'center', 0.9, 650);
    words(ctx, cam, '.com', [N.com[0], 0.1 + 0.3 * u, N.com[1] - 0.34], PIG.ink, 10.5, 'center', 0.9, 600);
  },
};
export default world;
