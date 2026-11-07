// Transforming graphs: y = f(x) (grey) and y = f(x − h) + k (cobalt), the same shape moved h to the right (not to the
// left: the trap) and k up; the two moves drawn as arrows. Seen from above at rest, the plot on its card.
import { PIG, render, turned } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, curve, frame, ink, on, words } from '../_kit';

const C: [number, number, number, number] = [0, 0, 6, 3.6];
const f = (x: number) => 0.12 + 0.5 * Math.exp(-((x - 0.3) ** 2) / 0.012);
const H = 0.32, K = 0.22;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), S = [card(...C)];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, [on(C, 0.06, 0.95), on(C, 0.06, 0.06), on(C, 0.97, 0.06)], PIG.ink, 0.9, 0.7);
    ink(ctx, cam, curve(C, f, 0.07, 0.96, 72), PIG.graphite_t, 1.6, 0.85);
    ink(ctx, cam, curve(C, (x) => f(x - H) + K, 0.07, 0.96, 72), PIG.cobalt, 2, 0.95);
    const p = 0.3, top = f(p);
    arrow3(ctx, cam, on(C, p + 0.02, top + 0.06), on(C, p + H - 0.01, top + 0.06), PIG.ink, 1.1, 0.75, true);
    arrow3(ctx, cam, on(C, p + H + 0.035, top + 0.02), on(C, p + H + 0.035, top + K - 0.02), PIG.ink, 1.1, 0.75, true);
    words(ctx, cam, 'h', on(C, p + H / 2, top + 0.1), PIG.ink, 12, 'center', 0.85, 650);
    words(ctx, cam, 'k', on(C, p + H + 0.065, top + K / 2 - 0.02), PIG.ink, 12, 'left', 0.85, 650);
    words(ctx, cam, 'f(x)', on(C, 0.12, 0.42), PIG.graphite_t, 11.5, 'center', 0.9, 500);
    words(ctx, cam, 'f(x − h) + k', on(C, 0.8, 0.5), PIG.cobalt, 11.5, 'left');
  },
};
export default world;
