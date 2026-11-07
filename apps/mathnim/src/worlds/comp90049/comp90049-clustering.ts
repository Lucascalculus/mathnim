// Clustering: no labels, only the data (studs); k-means finds k = 3 centres (rings) and gives each point to its nearest
// (the tints), the borders between them (dashes) halfway between centres. Seen from above at rest; in the world, each
// cluster rises as its own group.
import { PIG, cylinder_y, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink } from '../_kit';
import { cloud } from './_ml';

const CEN: [number, number, string][] = [[1.4, 1.2, 'teal'], [4.4, 1.3, 'ochre'], [2.9, 3.0, 'violet']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 6, 4.1, { bias: -10 })];
    const pts = CEN.flatMap(([x, z], k) => cloud(600 + k * 30, 11, x, z, 0.5));
    for (const [x, z] of pts) {
      if (x < 0.2 || x > 5.8 || z < 0.2 || z > 3.9) continue;
      const k = CEN.map(([cx, cz]) => Math.hypot(x - cx, z - cz)).reduce((b, d, i, a) => (d < a[b] ? i : b), 0);
      S.push(cylinder_y(x, z, 0.1, 0.05, 0.05 + 0.06 + (0.15 + 0.15 * k) * u, 12, { pig: CEN[k][2], k: 1, tint: 0.55, shadow: false }));
    }
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const mid = (a: number, b: number) => { const [ax, az] = CEN[a], [bx, bz] = CEN[b]; return [(ax + bx) / 2, (az + bz) / 2, -(bz - az), bx - ax]; };
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) { const [mx, mz, dx, dz] = mid(a, b), l = Math.hypot(dx, dz); ink(ctx, cam, [[mx - dx / l * 0.9, 0.052, mz - dz / l * 0.9], [mx + dx / l * 0.9, 0.052, mz + dz / l * 0.9]], PIG.ink, 1, 0.45, true); }
    for (const [x, z, pig] of CEN) { const p = cam.p([x, 0.06, z]); ring_dot(ctx, p[0], p[1], 6, PIG[pig], 0, 2); }
  },
};
export default world;
