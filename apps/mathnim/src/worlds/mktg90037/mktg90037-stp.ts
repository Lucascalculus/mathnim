// Whom we serve, and how they see us: the market as people in groups (segments); one group chosen (teal, the target);
// and on a map of what buyers care about (right), where our brand sits among the others (cobalt): its position.
// Seen from above at rest; in the world, the people stand.
import { PIG, cylinder_y, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';

const GROUPS: [number, number, number][] = [[0.9, 0.9, 7], [2.6, 0.7, 6], [1.7, 2.5, 8]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(4.2, 0, 7.6, 3.4, { bias: -10 })];
    GROUPS.forEach(([cx, cz, n], g) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, r = 0.32 + (i % 2) * 0.2; S.push(cylinder_y(cx + r * Math.cos(a), cz + r * Math.sin(a), 0.11, 0, 0.06 + 0.4 * u, 12, g === 2 ? { pig: 'teal', k: 1, tint: 0.6 } : { shade: 0.6 })); } });
    frame(cam, S, w, h, [12, 12, 12, 12], [[1.7, 0, 3.4]]);
    render(ctx, cam, S);
    const y = 0.052;
    ink(ctx, cam, [[5.9, y, 0.2], [5.9, y, 3.2]], PIG.ink, 1, 0.6); ink(ctx, cam, [[4.4, y, 1.7], [7.4, y, 1.7]], PIG.ink, 1, 0.6);
    for (const [x, z] of [[4.9, 0.7], [6.8, 2.6], [5.2, 2.4], [7.0, 1.1]]) { const p = cam.p([x, y, z]); ring_dot(ctx, p[0], p[1], 4, PIG.graphite_t, 1, 1); }
    const us = cam.p([6.6, y, 0.7]); ring_dot(ctx, us[0], us[1], 6, PIG.cobalt, 1, 1.4);
    words(ctx, cam, say(st, 'target', '目标'), [1.7, 0.06, 3.3], PIG.teal, 10.5);
    words(ctx, cam, say(st, 'us', '我们'), [6.82, y, 0.62], PIG.cobalt, 10.5, 'left');
  },
};
export default world;
