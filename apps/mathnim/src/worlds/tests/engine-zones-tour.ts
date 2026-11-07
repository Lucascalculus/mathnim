// The three zones (an engine test): one page where text (lines), a formula (its parts, cobalt and teal) and a figure
// (a curve on its card) sit side by side, each in its own zone. Seen from above at rest; in the world, the zones lift.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 2.2, 3.0, { shade: 0.6 }, 0, 0.05 + 0.1 * u), card(2.5, 0, 4.7, 3.0, { shade: 0.6 }, 0, 0.05 + 0.2 * u), card(5.0, 0, 7.2, 3.0, { shade: 0.6 }, 0, 0.05 + 0.3 * u)];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const y1 = 0.052 + 0.1 * u, y2 = 0.052 + 0.2 * u, y3 = 0.052 + 0.3 * u;
    [0.9, 0.75, 0.95, 0.6, 0.85, 0.7].forEach((s, i) => ink(ctx, cam, [[0.25, y1, 0.45 + i * 0.38], [0.25 + 1.7 * s, y1, 0.45 + i * 0.38]], PIG.graphite_t, 1.2, 0.55));
    words(ctx, cam, 'a² + b²', [3.6, y2, 1.25], PIG.cobalt, 13, 'center', 0.95, 650);
    words(ctx, cam, '= c²', [3.6, y2, 1.95], PIG.teal, 13, 'center', 0.95, 650);
    const curve: [number, number, number][] = []; for (let i = 0; i <= 30; i++) { const t = i / 30; curve.push([5.3 + t * 1.6, y3, 2.6 - 1.9 * (0.5 - 0.5 * Math.cos(Math.PI * t)) * (0.6 + 0.4 * t)]); }
    ink(ctx, cam, [[5.3, y3, 0.35], [5.3, y3, 2.65], [6.95, y3, 2.65]], PIG.ink, 1, 0.6);
    ink(ctx, cam, curve, PIG.violet, 1.8, 0.9);
  },
};
export default world;
