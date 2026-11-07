// Why this firm can do what others cannot, and for how long: its resources (cubes) pass four gates: valuable, rare,
// hard to imitate, organised to use (V, R, I, O). Fewer get through each gate; what passes all four (teal) is an
// advantage that lasts. Seen from above at rest; in the world, the gates stand.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

const LEFT = [6, 4, 3, 2, 1], GATES = ['V', 'R', 'I', 'O'];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], dx = 1.5;
    GATES.forEach((_, g) => { const x = 0.85 + g * dx; S.push(box(x - 0.06, 0, -1.7, x + 0.06, 0.08 + 0.7 * u, -0.25 - g * 0.18, { shade: 0.6 }), box(x - 0.06, 0, 0.25 + g * 0.18, x + 0.06, 0.08 + 0.7 * u, 1.7, { shade: 0.6 })); });
    LEFT.forEach((n, s) => { for (let k = 0; k < n; k++) { const x = s * dx + (k % 2) * 0.32 - 0.16 + 0.05, z = (Math.floor(k / 2) - (Math.ceil(n / 2) - 1) / 2) * 0.36, last = s === LEFT.length - 1; S.push(box(x - 0.13, 0, z - 0.13, x + 0.13, 0.26, z + 0.13, last ? { pig: 'teal', k: 1, tint: 0.6 } : { pig: 'cobalt', k: 1, tint: 0.2 + 0.08 * s })); } });
    frame(cam, S, w, h, [12, 22, 12, 12], [[0.85, 0, -2.1]]);
    render(ctx, cam, S);
    GATES.forEach((t, g) => words(ctx, cam, t, [0.85 + g * dx, 0.08 + 0.7 * u, -1.85], PIG.ink, 12, 'center', 0.9, 650));
  },
};
export default world;
