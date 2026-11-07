// IP addresses, subnets and CIDR: an address is 32 bits (the row of cells); the first part names the network (cobalt,
// here 24 bits: /24), the rest the host. Below, the network's addresses as a strip cut into four equal subnets (/26).
// Seen from above at rest; in the world, the prefix rises.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const D = 0.22, P = 24;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (let i = 0; i < 32; i++) { const x = i * D + Math.floor(i / 8) * 0.12; S.push(box(x, 0, 0, x + D - 0.03, 0.06 + (i < P ? 0.3 : 0.06) * u, 0.5, i < P ? { pig: 'cobalt', k: 1, tint: 0.5 } : { shade: 0.6 })); }
    const x0 = 24 * D + 3 * 0.12, x1 = 32 * D + 3 * 0.12;
    ['violet', 'teal', 'ochre', 'cobalt'].forEach((pig, k) => S.push(box(x0 - 3.6 + k * ((x1 - x0 + 3.6) / 4), 0, 1.3, x0 - 3.6 + (k + 1) * ((x1 - x0 + 3.6) / 4) - 0.06, 0.06 + 0.12 * u, 1.75, { pig, k: 1, tint: 0.4 })));
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, 0, -0.45]]);
    render(ctx, cam, S);
    ink(ctx, cam, [[x0, 0.06, 0.55], [x0 - 3.6, 0.06, 1.25]], PIG.graphite_t, 0.9, 0.5, true);
    ink(ctx, cam, [[x1 - 0.03, 0.06, 0.55], [x1 - 0.03, 0.06, 1.25]], PIG.graphite_t, 0.9, 0.5, true);
    words(ctx, cam, '/24', [P * D / 2 + 0.2, 0.06 + 0.3 * u, -0.15], PIG.cobalt, 12, 'center', 0.95, 650);
    words(ctx, cam, '/26 × 4', [x0 - 1.8, 0.06, 2.15], PIG.ink, 10.5, 'center', 0.85);
  },
};
export default world;
