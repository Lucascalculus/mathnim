// Decision trees: each question splits the space with a straight cut along one attribute (ink lines, the first cut
// thickest), until each box holds mostly one class (its tint). The tree is the order of the cuts. Seen from above at
// rest; in the world, each box rises to its depth in the tree.
import { PIG, extrude, render, turned, type Solid, type V3 } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink } from '../_kit';
import { cloud, form } from './_ml';

// boxes: x0, z0, x1, z1, class, depth
const BOX: [number, number, number, number, number, number][] = [[0, 0, 2.6, 2.3, 0, 2], [0, 2.3, 2.6, 4.1, 1, 2], [2.6, 0, 6, 1.5, 0, 2], [2.6, 1.5, 4.3, 4.1, 1, 3], [4.3, 1.5, 6, 4.1, 0, 3]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 6, 4.1, { bias: -10 })], g = 0.04;
    for (const [x0, z0, x1, z1, c, d] of BOX) S.push(extrude([[x0 + g, 0.05, z0 + g], [x1 - g, 0.05, z0 + g], [x1 - g, 0.05, z1 - g], [x0 + g, 0.05, z1 - g]] as V3[], [0, 0.004 + 0.1 * d * u, 0], { pig: c ? 'ochre' : 'cobalt', k: 1, tint: 0.14, shade: 0.6, bias: -5 }));
    BOX.forEach(([x0, z0, x1, z1, c, d], i) => cloud(70 + i * 20, 4, (x0 + x1) / 2, (z0 + z1) / 2, 0.32).forEach(([x, z], k) => {
      const cx = Math.min(x1 - 0.25, Math.max(x0 + 0.25, x)), cz = Math.min(z1 - 0.25, Math.max(z0 + 0.25, z)), s = form(cx, cz, k === 3 && i === 3 ? 0 : c, 0.18, 0.11);
      const lift = 0.004 + 0.1 * d * u; for (const p of s.pts) p[1] += lift; s.c[1] += lift; S.push(s);
    }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const y = 0.054;
    ink(ctx, cam, [[2.6, y, 0], [2.6, y, 4.1]], PIG.ink, 2.4, 0.9);
    ink(ctx, cam, [[0, y, 2.3], [2.6, y, 2.3]], PIG.ink, 1.6, 0.8);
    ink(ctx, cam, [[2.6, y, 1.5], [6, y, 1.5]], PIG.ink, 1.6, 0.8);
    ink(ctx, cam, [[4.3, y, 1.5], [4.3, y, 4.1]], PIG.ink, 1.1, 0.7);
  },
};
export default world;
